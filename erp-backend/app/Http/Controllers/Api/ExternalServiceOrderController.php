<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ExternalServiceOrder;
use App\Models\ExternalServicePayment;
use App\Models\Expense;
use App\Models\Supplier;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class ExternalServiceOrderController extends Controller
{
    public function index(Request $request)
    {
        $query = ExternalServiceOrder::with(['supplier', 'material', 'product', 'payments']);

        if ($request->has('search') && !empty($request->search)) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('order_number', 'like', "%{$search}%")
                  ->orWhere('item_description', 'like', "%{$search}%")
                  ->orWhereHas('supplier', function ($sq) use ($search) {
                      $sq->where('name', 'like', "%{$search}%");
                  });
            });
        }

        if ($request->has('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        if ($request->has('supplier_id') && !empty($request->supplier_id)) {
            $query->where('supplier_id', $request->supplier_id);
        }

        $orders = $query->orderBy('id', 'desc')->paginate($request->get('per_page', 20));

        // Stats calculations across all matching records
        $allMatching = ExternalServiceOrder::query();
        if ($request->has('supplier_id') && !empty($request->supplier_id)) {
            $allMatching->where('supplier_id', $request->supplier_id);
        }

        $stats = [
            'total_orders' => (clone $allMatching)->count(),
            'total_cost' => (float) (clone $allMatching)->sum('total_cost'),
            'total_paid' => (float) (clone $allMatching)->sum('total_paid'),
            'total_balance' => (float) (clone $allMatching)->sum('balance'),
        ];

        return response()->json([
            'orders' => $orders,
            'stats' => $stats,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'supplier_id' => 'required|exists:suppliers,id',
            'material_id' => 'nullable|exists:materials,id',
            'product_id' => 'nullable|exists:products,id',
            'operation_id' => 'nullable|exists:operations,id',
            'item_description' => 'required|string|max:255',
            'quantity' => 'required|numeric|min:0.01',
            'unit' => 'required|string|max:50',
            'unit_cost' => 'required|numeric|min:0',
            'sent_date' => 'required|date',
            'expected_return_date' => 'nullable|date',
            'notes' => 'nullable|string',
            'initial_payment' => 'nullable|numeric|min:0',
            'payment_method' => 'nullable|string',
            'transaction_reference' => 'nullable|string',
            'receipt_image' => 'nullable|file|image|max:5120',
        ]);

        return DB::transaction(function () use ($validated, $request) {
            // Generate auto order number safely: ESO-YEAR-COUNT
            $year = date('Y');
            $prefix = 'ESO-' . $year . '-';
            
            $latestESO = DB::table('external_service_orders')
                ->where('order_number', 'LIKE', $prefix . '%')
                ->orderBy('id', 'desc')
                ->lockForUpdate()
                ->first();

            $nextNum = 1;
            if ($latestESO && preg_match('/ESO-\d{4}-(\d+)/', $latestESO->order_number, $matches)) {
                $nextNum = (int)$matches[1] + 1;
            }

            do {
                $orderNumber = $prefix . str_pad($nextNum, 4, '0', STR_PAD_LEFT);
                $exists = DB::table('external_service_orders')->where('order_number', $orderNumber)->exists();
                if ($exists) {
                    $nextNum++;
                }
            } while ($exists);

            $totalCost = $validated['quantity'] * $validated['unit_cost'];
            $userInitialPayment = floatval($validated['initial_payment'] ?? 0.00);
            $totalPaid = $userInitialPayment;

            // Check if supplier has available credit (debt_amount < 0)
            $supplier = Supplier::find($validated['supplier_id']);
            $appliedCredit = 0;
            if ($supplier && floatval($supplier->debt_amount) < 0) {
                $availableCredit = abs(floatval($supplier->debt_amount));
                $needed = max(0, $totalCost - $userInitialPayment);
                if ($needed > 0 && $availableCredit > 0) {
                    $appliedCredit = min($availableCredit, $needed);
                    $totalPaid += $appliedCredit;
                }
            }

            $balance = max(0, $totalCost - $totalPaid);
            $notesText = $validated['notes'] ?? '';
            if ($appliedCredit > 0) {
                $notesText = trim($notesText . ' | تم خصم رصيد دائن للمورد بمبلغ ' . number_format($appliedCredit, 2) . ' EGP تلقائياً');
            }

            $order = ExternalServiceOrder::create([
                'order_number' => $orderNumber,
                'supplier_id' => $validated['supplier_id'],
                'material_id' => $validated['material_id'] ?? null,
                'product_id' => $validated['product_id'] ?? null,
                'item_description' => $validated['item_description'],
                'quantity' => $validated['quantity'],
                'unit' => $validated['unit'],
                'unit_cost' => $validated['unit_cost'],
                'total_cost' => $totalCost,
                'total_paid' => $totalPaid,
                'balance' => $balance,
                'status' => 'sent',
                'sent_date' => $validated['sent_date'],
                'expected_return_date' => $validated['expected_return_date'] ?? null,
                'notes' => $notesText,
            ]);

            // Handle Initial Payment if user paid cash/deposit > 0
            if ($userInitialPayment > 0) {
                $receiptPath = null;
                if ($request->hasFile('receipt_image')) {
                    $receiptPath = $request->file('receipt_image')->store('receipts', 'public');
                }

                ExternalServicePayment::create([
                    'external_service_order_id' => $order->id,
                    'amount' => $userInitialPayment,
                    'payment_method' => $validated['payment_method'] ?? 'instapay',
                    'transaction_reference' => $validated['transaction_reference'] ?? null,
                    'receipt_image_path' => $receiptPath,
                    'payment_date' => $validated['sent_date'],
                    'notes' => 'دفعة مقدمة لأمر تشغيل خارجي ' . $orderNumber,
                ]);

                // Create Expense Entry safely
                $expPrefix = 'EXP-' . $year . '-';
                $latestExp = DB::table('expenses')
                    ->where('expense_number', 'LIKE', $expPrefix . '%')
                    ->orderBy('id', 'desc')
                    ->lockForUpdate()
                    ->first();

                $nextExpNum = 1;
                if ($latestExp && preg_match('/EXP-\d{4}-(\d+)/', $latestExp->expense_number, $matches)) {
                    $nextExpNum = (int)$matches[1] + 1;
                }

                do {
                    $expNo = $expPrefix . str_pad($nextExpNum, 4, '0', STR_PAD_LEFT);
                    $exists = DB::table('expenses')->where('expense_number', $expNo)->exists();
                    if ($exists) {
                        $nextExpNum++;
                    }
                } while ($exists);

                Expense::create([
                    'expense_number' => $expNo,
                    'category' => 'خدمات خارجية',
                    'amount' => $userInitialPayment,
                    'expense_date' => $validated['sent_date'],
                    'payment_method' => $validated['payment_method'] ?? 'instapay',
                    'description' => 'دفعة خدمة خارجية لأمر ' . $orderNumber . ' - ' . $validated['item_description'],
                    'reference_number' => $orderNumber,
                    'supplier_id' => $validated['supplier_id'],
                ]);
            }

            return response()->json([
                'message' => 'تم إنشاء أمر التشغيل الخارجي بنجاح',
                'order' => $order->load(['supplier', 'material', 'product', 'payments']),
            ], 201);
        });
    }

    public function show($id)
    {
        $order = ExternalServiceOrder::with(['supplier', 'material', 'product', 'payments'])->findOrFail($id);
        return response()->json($order);
    }

    public function recordPayment(Request $request, $id)
    {
        $order = ExternalServiceOrder::findOrFail($id);

        $validated = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'payment_method' => 'required|string',
            'transaction_reference' => 'nullable|string',
            'payment_date' => 'required|date',
            'notes' => 'nullable|string',
            'receipt_image' => 'nullable|file|image|max:5120',
        ]);

        return DB::transaction(function () use ($order, $validated, $request) {
            $receiptPath = null;
            if ($request->hasFile('receipt_image')) {
                $receiptPath = $request->file('receipt_image')->store('receipts', 'public');
            }

            $payment = ExternalServicePayment::create([
                'external_service_order_id' => $order->id,
                'amount' => $validated['amount'],
                'payment_method' => $validated['payment_method'],
                'transaction_reference' => $validated['transaction_reference'] ?? null,
                'receipt_image_path' => $receiptPath,
                'payment_date' => $validated['payment_date'],
                'notes' => $validated['notes'] ?? null,
            ]);

            // Update order financial summary
            $order->calculateBalance();

            // Create Expense Entry safely
            $year = date('Y');
            $expPrefix = 'EXP-' . $year . '-';
            $latestExp = DB::table('expenses')
                ->where('expense_number', 'LIKE', $expPrefix . '%')
                ->orderBy('id', 'desc')
                ->lockForUpdate()
                ->first();

            $nextExpNum = 1;
            if ($latestExp && preg_match('/EXP-\d{4}-(\d+)/', $latestExp->expense_number, $matches)) {
                $nextExpNum = (int)$matches[1] + 1;
            }

            do {
                $expNo = $expPrefix . str_pad($nextExpNum, 4, '0', STR_PAD_LEFT);
                $exists = DB::table('expenses')->where('expense_number', $expNo)->exists();
                if ($exists) {
                    $nextExpNum++;
                }
            } while ($exists);

            Expense::create([
                'expense_number' => $expNo,
                'category' => 'خدمات خارجية',
                'amount' => $validated['amount'],
                'expense_date' => $validated['payment_date'],
                'payment_method' => $validated['payment_method'],
                'description' => 'دفعة خدمة خارجية لأمر ' . $order->order_number . ' (' . $order->item_description . ')',
                'reference_number' => $order->order_number,
                'supplier_id' => $order->supplier_id,
            ]);

            return response()->json([
                'message' => 'تم تسجيل الدفعة بنجاح',
                'order' => $order->fresh()->load(['supplier', 'material', 'product', 'payments']),
            ]);
        });
    }

    public function deletePayment($id, $paymentId)
    {
        $order = ExternalServiceOrder::findOrFail($id);
        $payment = ExternalServicePayment::where('external_service_order_id', $order->id)->findOrFail($paymentId);

        return DB::transaction(function () use ($order, $payment) {
            $amount = floatval($payment->amount);

            // 1. Delete linked Expense entry
            Expense::where('supplier_id', $order->supplier_id)
                ->where('amount', $amount)
                ->where(function($q) use ($order) {
                    $q->where('reference_number', $order->order_number)
                      ->orWhere('description', 'like', '%' . $order->order_number . '%');
                })
                ->delete();

            // 2. Delete payment
            $payment->delete();

            // 3. Recalculate ESO balance
            $order->calculateBalance();

            return response()->json([
                'message' => 'تم إلغاء الدفعة وتعديل رصيد أمر الخدمة الخارجية والمصروفات بنجاح',
                'order' => $order->fresh()->load(['supplier', 'material', 'product', 'payments']),
            ]);
        });
    }

    public function updateStatus(Request $request, $id)
    {
        $order = ExternalServiceOrder::findOrFail($id);

        $validated = $request->validate([
            'status' => 'required|in:sent,partially_received,completed,cancelled',
        ]);

        $order->status = $validated['status'];
        $order->save();

        return response()->json([
            'message' => 'تم تحديث حالة الأمر بنجاح',
            'order' => $order->load(['supplier', 'material', 'product', 'payments']),
        ]);
    }

    public function updateReturns(Request $request, $id)
    {
        $order = ExternalServiceOrder::findOrFail($id);

        $validated = $request->validate([
            'returned_quantity' => 'required|numeric|min:0',
            'rejected_quantity' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string',
        ]);

        $returned = floatval($validated['returned_quantity']);
        $rejected = floatval($validated['rejected_quantity'] ?? 0);
        $totalQty = floatval($order->quantity);

        $order->returned_quantity = $returned;
        $order->rejected_quantity = $rejected;
        if (!empty($validated['notes'])) {
            $order->notes = ($order->notes ? $order->notes . "\n" : '') . 'تحديث الاستلام: ' . $validated['notes'];
        }

        // Auto update status based on returned count
        if (($returned + $rejected) >= $totalQty) {
            $order->status = 'completed';
        } else if ($returned > 0 || $rejected > 0) {
            $order->status = 'partially_received';
        }

        $order->save();

        return response()->json([
            'message' => 'تم تسجيل استلام الأصناف وتحديث الجودة بنجاح',
            'order' => $order->fresh()->load(['supplier', 'material', 'product', 'payments']),
        ]);
    }

    public function analytics()
    {
        $topSuppliers = DB::table('external_service_orders')
            ->join('suppliers', 'external_service_orders.supplier_id', '=', 'suppliers.id')
            ->whereNull('external_service_orders.deleted_at')
            ->select(
                'suppliers.id',
                'suppliers.name',
                DB::raw('COUNT(external_service_orders.id) as total_orders'),
                DB::raw('SUM(external_service_orders.total_cost) as total_spent'),
                DB::raw('SUM(external_service_orders.balance) as total_debt')
            )
            ->groupBy('suppliers.id', 'suppliers.name')
            ->orderBy('total_spent', 'desc')
            ->limit(5)
            ->get();

        $statusBreakdown = DB::table('external_service_orders')
            ->whereNull('deleted_at')
            ->select('status', DB::raw('COUNT(*) as count'))
            ->groupBy('status')
            ->pluck('count', 'status');

        $overall = [
            'total_spent' => (float) ExternalServiceOrder::sum('total_cost'),
            'total_paid' => (float) ExternalServiceOrder::sum('total_paid'),
            'total_balance' => (float) ExternalServiceOrder::sum('balance'),
            'total_orders' => ExternalServiceOrder::count(),
            'status_breakdown' => $statusBreakdown,
            'top_suppliers' => $topSuppliers,
        ];

        return response()->json($overall);
    }

    public function destroy($id)
    {
        $order = ExternalServiceOrder::findOrFail($id);
        
        DB::transaction(function () use ($order) {
            // Delete associated expense entries logged for this order
            Expense::where('reference_number', $order->order_number)
                ->orWhere(function($q) use ($order) {
                    $q->where('category', 'خدمات خارجية')
                      ->where('description', 'LIKE', '%' . $order->order_number . '%');
                })->delete();

            $order->payments()->delete();
            $order->delete();
        });

        return response()->json(['message' => 'تم حذف أمر التشغيل الخارجي بنجاح']);
    }
}
