<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ExternalServiceOrder;
use App\Models\ExternalServicePayment;
use App\Models\Expense;
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
            $count = ExternalServiceOrder::whereYear('created_at', $year)->count() + 1;
            do {
                $orderNumber = 'ESO-' . $year . '-' . str_pad($count, 4, '0', STR_PAD_LEFT);
                $exists = ExternalServiceOrder::where('order_number', $orderNumber)->exists();
                if ($exists) {
                    $count++;
                }
            } while ($exists);

            $totalCost = $validated['quantity'] * $validated['unit_cost'];
            $initialPayment = $validated['initial_payment'] ?? 0.00;
            $balance = $totalCost - $initialPayment;

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
                'total_paid' => $initialPayment,
                'balance' => $balance,
                'status' => 'sent',
                'sent_date' => $validated['sent_date'],
                'expected_return_date' => $validated['expected_return_date'] ?? null,
                'notes' => $validated['notes'] ?? null,
            ]);

            // Handle Initial Payment if > 0
            if ($initialPayment > 0) {
                $receiptPath = null;
                if ($request->hasFile('receipt_image')) {
                    $receiptPath = $request->file('receipt_image')->store('receipts', 'public');
                }

                ExternalServicePayment::create([
                    'external_service_order_id' => $order->id,
                    'amount' => $initialPayment,
                    'payment_method' => $validated['payment_method'] ?? 'instapay',
                    'transaction_reference' => $validated['transaction_reference'] ?? null,
                    'receipt_image_path' => $receiptPath,
                    'payment_date' => $validated['sent_date'],
                    'notes' => 'دفعة مقدمة لأمر تشغيل خارجي ' . $orderNumber,
                ]);

                // Create Expense Entry safely
                $expCount = Expense::whereYear('created_at', $year)->count() + 1;
                do {
                    $expNo = 'EXP-' . $year . '-' . str_pad($expCount, 4, '0', STR_PAD_LEFT);
                    $exists = Expense::where('expense_number', $expNo)->exists();
                    if ($exists) {
                        $expCount++;
                    }
                } while ($exists);

                Expense::create([
                    'expense_number' => $expNo,
                    'category' => 'خدمات خارجية',
                    'amount' => $initialPayment,
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
            $expCount = Expense::whereYear('created_at', $year)->count() + 1;
            do {
                $expNo = 'EXP-' . $year . '-' . str_pad($expCount, 4, '0', STR_PAD_LEFT);
                $exists = Expense::where('expense_number', $expNo)->exists();
                if ($exists) {
                    $expCount++;
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

    public function destroy($id)
    {
        $order = ExternalServiceOrder::findOrFail($id);
        
        DB::transaction(function () use ($order) {
            $order->payments()->delete();
            $order->delete();
        });

        return response()->json(['message' => 'تم حذف أمر التشغيل الخارجي بنجاح']);
    }
}
