<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ExternalServiceOrder;
use App\Models\ExternalServicePayment;
use App\Models\Warehouse;
use App\Services\TreasuryService;
use App\Services\InventoryService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

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
            $user = auth()->id();
            $orderNumber = ExternalServiceOrder::generateNextOrderNumber();
            $totalCost = round($validated['quantity'] * $validated['unit_cost'], 2);
            $userInitialPayment = floatval($validated['initial_payment'] ?? 0.00);

            $order = ExternalServiceOrder::create([
                'order_number' => $orderNumber,
                'supplier_id' => $validated['supplier_id'],
                'material_id' => $validated['material_id'] ?? null,
                'product_id' => $validated['product_id'] ?? null,
                'operation_id' => $validated['operation_id'] ?? null,
                'item_description' => $validated['item_description'],
                'quantity' => $validated['quantity'],
                'unit' => $validated['unit'],
                'unit_cost' => $validated['unit_cost'],
                'total_cost' => $totalCost,
                'total_paid' => $userInitialPayment,
                'balance' => max(0, $totalCost - $userInitialPayment),
                'status' => 'sent',
                'sent_date' => $validated['sent_date'],
                'expected_return_date' => $validated['expected_return_date'] ?? null,
                'notes' => $validated['notes'] ?? null,
            ]);

            // Handle Initial Payment if > 0
            if ($userInitialPayment > 0) {
                $receiptPath = null;
                if ($request->hasFile('receipt_image')) {
                    $receiptPath = $request->file('receipt_image')->store('receipts', 'public');
                }

                $payMethod = $validated['payment_method'] ?? 'instapay';

                $payment = ExternalServicePayment::create([
                    'external_service_order_id' => $order->id,
                    'amount' => $userInitialPayment,
                    'payment_method' => $payMethod,
                    'transaction_reference' => $validated['transaction_reference'] ?? null,
                    'receipt_image_path' => $receiptPath,
                    'payment_date' => $validated['sent_date'],
                    'notes' => 'دفعة مقدمة لأمر تشغيل خارجي ' . $orderNumber,
                ]);

                // Record Treasury Outflow
                TreasuryService::recordOutflow(
                    amount: $userInitialPayment,
                    paymentMethod: $payMethod,
                    category: 'خدمات خارجية / ورش',
                    description: "دفعة مقدمة لأمر تشغيل خارجي ({$orderNumber}) - {$validated['item_description']}",
                    sourceType: ExternalServicePayment::class,
                    sourceId: $payment->id,
                    referenceNumber: $orderNumber,
                    transactionDate: $validated['sent_date'],
                    receiptPath: $receiptPath,
                    userId: $user
                );
            }

            // Sync Supplier Debt
            if ($order->balance > 0 && $order->supplier) {
                $order->supplier->increment('debt_amount', (float)$order->balance);
            }

            return response()->json([
                'message' => 'تم إنشاء أمر التشغيل الخارجي بنجاح وتسجيل الدفعة في الخزينة',
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
            $user = auth()->id();
            $receiptPath = null;
            if ($request->hasFile('receipt_image')) {
                $receiptPath = $request->file('receipt_image')->store('receipts', 'public');
            }

            $amount = (float)$validated['amount'];
            $payMethod = $validated['payment_method'];

            $payment = ExternalServicePayment::create([
                'external_service_order_id' => $order->id,
                'amount' => $amount,
                'payment_method' => $payMethod,
                'transaction_reference' => $validated['transaction_reference'] ?? null,
                'receipt_image_path' => $receiptPath,
                'payment_date' => $validated['payment_date'],
                'notes' => $validated['notes'] ?? null,
            ]);

            $order->calculateBalance();

            // Record Treasury Outflow
            TreasuryService::recordOutflow(
                amount: $amount,
                paymentMethod: $payMethod,
                category: 'خدمات خارجية / ورش',
                description: "دفعة مسددة لأمر تشغيل خارجي ({$order->order_number}) - {$order->item_description}",
                sourceType: ExternalServicePayment::class,
                sourceId: $payment->id,
                referenceNumber: $order->order_number,
                transactionDate: $validated['payment_date'],
                receiptPath: $receiptPath,
                userId: $user
            );

            // Deduct Supplier Debt
            if ($order->supplier) {
                $order->supplier->decrement('debt_amount', min($amount, (float)$order->supplier->debt_amount));
            }

            return response()->json([
                'message' => 'تم تسجيل الدفعة وتحديث الخزينة وحساب المورد بنجاح',
                'order' => $order->fresh()->load(['supplier', 'material', 'product', 'payments']),
            ]);
        });
    }

    public function deletePayment($id, $paymentId)
    {
        $order = ExternalServiceOrder::findOrFail($id);
        $payment = ExternalServicePayment::where('external_service_order_id', $order->id)->findOrFail($paymentId);

        return DB::transaction(function () use ($order, $payment) {
            $amount = (float)$payment->amount;
            TreasuryService::revertBySource(ExternalServicePayment::class, $payment->id);
            $payment->delete();
            $order->calculateBalance();

            // Re-increase Supplier Debt
            if ($order->supplier) {
                $order->supplier->increment('debt_amount', $amount);
            }

            return response()->json([
                'message' => 'تم إلغاء الدفعة وتعديل رصيد الخزينة وحساب المورد بنجاح',
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
        $order = ExternalServiceOrder::with('payments')->findOrFail($id);

        DB::transaction(function () use ($order) {
            if ($order->balance > 0 && $order->supplier) {
                $order->supplier->decrement('debt_amount', min((float)$order->balance, (float)$order->supplier->debt_amount));
            }

            foreach ($order->payments as $payment) {
                TreasuryService::revertBySource(ExternalServicePayment::class, $payment->id);
            }
            $order->payments()->delete();
            $order->forceDelete();
        });

        return response()->json(['message' => 'تم حذف أمر التشغيل الخارجي وإلغاء قيوده بالخزينة بنجاح']);
    }
}
