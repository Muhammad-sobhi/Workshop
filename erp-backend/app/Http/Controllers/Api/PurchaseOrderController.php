<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\Supplier;
use App\Models\SupplierPayment;
use App\Models\Warehouse;
use App\Services\TreasuryService;
use App\Services\InventoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class PurchaseOrderController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 20);
        $paginator = PurchaseOrder::with(['supplier', 'items.material', 'items.product'])
            ->orderBy('order_date', 'desc')
            ->orderBy('id', 'desc')
            ->paginate($perPage);

        $paginator->setCollection(
            $paginator->getCollection()->map(function ($ord) {
                return [
                    'id' => $ord->id,
                    'order_number' => $ord->order_number,
                    'supplier_id' => $ord->supplier_id,
                    'supplier_name' => $ord->supplier->name ?? '',
                    'supplier_phone' => $ord->supplier->phone ?? '',
                    'supplier_address' => $ord->supplier->address ?? '',
                    'status' => $ord->status,
                    'order_date' => $ord->order_date,
                    'total_amount' => (float) $ord->total_amount,
                    'deposit_paid' => (float) ($ord->deposit_paid ?? 0.00),
                    'payment_method' => $ord->payment_method,
                    'items_count' => $ord->items->count(),
                    'items' => $ord->items->map(fn($item) => [
                        'id' => $item->id,
                        'material_id' => $item->material_id,
                        'product_id' => $item->product_id,
                        'item_type' => $item->product_id ? 'product' : 'material',
                        'material_name' => $item->material->name ?? null,
                        'unit' => ($item->material->unit ?? $item->product?->unit) ?? 'وحدة',
                        'item_name' => $item->material->name ?? ($item->product?->name ?? 'صنف'),
                        'quantity' => (float) $item->quantity,
                        'unit_cost' => (float) $item->unit_cost,
                        'total_cost' => (float) $item->total_cost,
                    ]),
                    'notes' => $ord->notes,
                ];
            })
        );

        return response()->json($paginator);
    }

    public function show(string $id): JsonResponse
    {
        $order = PurchaseOrder::with(['supplier', 'items.material.category', 'items.product'])->findOrFail($id);
        return response()->json($order);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'supplier_id' => 'required|exists:suppliers,id',
            'order_date' => 'required|date',
            'notes' => 'nullable|string',
            'deposit_paid' => 'nullable|numeric|min:0',
            'payment_method' => 'nullable|string|in:cash,instapay,vodafone_cash,bank_transfer,postal_transfer',
            'items' => 'required|array|min:1',
            'items.*.material_id' => 'nullable|required_without:items.*.product_id|exists:materials,id',
            'items.*.product_id' => 'nullable|required_without:items.*.material_id|exists:products,id',
            'items.*.quantity' => 'required|numeric|min:0.01',
            'items.*.unit_cost' => 'required|numeric|min:0',
        ]);

        return DB::transaction(function () use ($validated) {
            $user = auth()->id();
            $poNo = $this->generateOrderNumber();

            // Calculate total amount
            $totalAmount = 0;
            foreach ($validated['items'] as $item) {
                $totalAmount += $item['quantity'] * $item['unit_cost'];
            }

            $userDeposit = floatval($validated['deposit_paid'] ?? 0.00);
            $payMethod = $validated['payment_method'] ?? 'cash';

            $order = PurchaseOrder::create([
                'order_number' => $poNo,
                'supplier_id' => $validated['supplier_id'],
                'status' => 'Pending',
                'order_date' => $validated['order_date'],
                'total_amount' => $totalAmount,
                'deposit_paid' => $userDeposit,
                'payment_method' => $payMethod,
                'notes' => $validated['notes'] ?? null,
            ]);

            foreach ($validated['items'] as $item) {
                PurchaseOrderItem::create([
                    'purchase_order_id' => $order->id,
                    'material_id' => $item['material_id'] ?? null,
                    'product_id' => $item['product_id'] ?? null,
                    'quantity' => $item['quantity'],
                    'unit_cost' => $item['unit_cost'],
                    'total_cost' => $item['quantity'] * $item['unit_cost'],
                ]);
            }

            // Record Treasury Outflow and SupplierPayment if deposit paid
            if ($userDeposit > 0) {
                SupplierPayment::create([
                    'supplier_id' => $validated['supplier_id'],
                    'amount' => $userDeposit,
                    'payment_date' => $validated['order_date'],
                    'payment_method' => $payMethod,
                    'purchase_order_id' => $order->id,
                    'reference_number' => $poNo,
                    'notes' => "دفعة مقدمة (عربون) لأمر الشراء {$poNo}",
                    'created_by' => $user,
                ]);

                TreasuryService::recordOutflow(
                    amount: $userDeposit,
                    paymentMethod: $payMethod,
                    category: 'دفعة مقدمة لشراء خامات (مورد)',
                    description: "عربون شراء مواد خام لأمر {$poNo}",
                    sourceType: PurchaseOrder::class,
                    sourceId: $order->id,
                    referenceNumber: $poNo,
                    transactionDate: $validated['order_date'],
                    userId: $user
                );
            }

            return response()->json([
                'message' => 'تم إنشاء طلب الشراء بنجاح وتسجيل العربون بالخزينة.',
                'order' => $order->load(['supplier', 'items.material', 'items.product']),
            ], 201);
        });
    }

    public function receiveOrder(string $id): JsonResponse
    {
        $order = PurchaseOrder::with(['items.material', 'items.product', 'supplier'])->findOrFail($id);

        if ($order->status === 'Received') {
            return response()->json(['message' => 'هذا الطلب تم استلامه مسبقاً.'], 400);
        }

        return DB::transaction(function () use ($order, $id) {
            // Lock the order row to prevent concurrent double-receive
            $locked = PurchaseOrder::where('id', $id)->lockForUpdate()->first();

            if ($locked->status === 'Received') {
                return response()->json(['message' => 'هذا الطلب تم استلامه مسبقاً.'], 400);
            }

            $user = auth()->id();
            $whRaw = Warehouse::rawMaterialsWarehouse();
            $rawWarehouseId = $whRaw ? $whRaw->id : (Warehouse::first() ? Warehouse::first()->id : 1);
            $whProd = Warehouse::productsWarehouse();
            $prodWarehouseId = $whProd ? $whProd->id : $rawWarehouseId;

            // 1. Receive items into inventory, routed by item type
            foreach ($locked->items as $item) {
                if ($item->product_id) {
                    // Resale product → WSH-P + sync purchase cost as fallback unit_cost
                    InventoryService::recordMovement(
                        warehouseId: $prodWarehouseId,
                        materialId: null,
                        productId: $item->product_id,
                        movementType: 'Purchase_Receipt',
                        quantity: (float) $item->quantity,
                        unitCost: (float) $item->unit_cost,
                        referenceNumber: $locked->order_number,
                        notes: "توريد منتج مشترى لأمر شراء رقم {$locked->order_number}",
                        userId: $user
                    );

                    if ($item->unit_cost > 0) {
                        \App\Models\Product::where('id', $item->product_id)
                            ->update(['unit_cost' => $item->unit_cost]);
                    }
                    continue;
                }

                // Raw material (skip services)
                if ($item->material && $item->material->type === 'service')
                    continue;

                InventoryService::recordMovement(
                    warehouseId: $rawWarehouseId,
                    materialId: $item->material_id,
                    productId: null,
                    movementType: 'Purchase_Receipt',
                    quantity: (float) $item->quantity,
                    unitCost: (float) $item->unit_cost,
                    referenceNumber: $locked->order_number,
                    notes: "توريد مشتريات لأمر شراء رقم {$locked->order_number}",
                    userId: $user
                );

                if ($item->material && $item->unit_cost > 0) {
                    $item->material->update(['unit_cost' => $item->unit_cost]);
                }
            }

            // 2. Increase supplier debt by unpaid balance
            $unpaid = max(0.0, round((float) $locked->total_amount - (float) ($locked->deposit_paid ?? 0), 2));
            if ($unpaid > 0 && $locked->supplier) {
                $locked->supplier->increment('debt_amount', $unpaid);
            }

            $locked->update(['status' => 'Received']);

            return response()->json([
                'message' => 'تم استلام طلب الشراء بنجاح وتوريد البضاعة للمستودع وإضافة المتبقي لدين المورد.',
            ]);
        });
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $order = PurchaseOrder::findOrFail($id);

        if ($order->status === 'Received') {
            return response()->json(['message' => 'عذراً، لا يمكن تعديل طلب شراء تم استلامه وتوريده بالفعل.'], 400);
        }

        $validated = $request->validate([
            'supplier_id' => 'required|exists:suppliers,id',
            'order_date' => 'required|date',
            'notes' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.material_id' => 'nullable|required_without:items.*.product_id|exists:materials,id',
            'items.*.product_id' => 'nullable|required_without:items.*.material_id|exists:products,id',
            'items.*.quantity' => 'required|numeric|min:0.01',
            'items.*.unit_cost' => 'required|numeric|min:0',
        ]);

        return DB::transaction(function () use ($order, $validated) {
            $order->items()->delete();
            $totalAmount = 0;

            foreach ($validated['items'] as $item) {
                $totalAmount += $item['quantity'] * $item['unit_cost'];
                PurchaseOrderItem::create([
                    'purchase_order_id' => $order->id,
                    'material_id' => $item['material_id'] ?? null,
                    'product_id' => $item['product_id'] ?? null,
                    'quantity' => $item['quantity'],
                    'unit_cost' => $item['unit_cost'],
                    'total_cost' => $item['quantity'] * $item['unit_cost'],
                ]);
            }

            $order->update([
                'supplier_id' => $validated['supplier_id'],
                'order_date' => $validated['order_date'],
                'total_amount' => $totalAmount,
                'notes' => $validated['notes'] ?? null,
            ]);

            return response()->json([
                'message' => 'تم تحديث طلب الشراء بنجاح',
                'order' => $order->load(['items.material', 'items.product']),
            ]);
        });
    }

    public function destroy(string $id): JsonResponse
    {
        $order = PurchaseOrder::with(['supplier', 'items.material', 'items.product'])->findOrFail($id);

        return DB::transaction(function () use ($order) {
            // 1. Revert Inventory Movements
            $movements = \App\Models\InventoryMovement::where('reference_number', $order->order_number)->get();
            foreach ($movements as $m) {
                $m->delete();
                InventoryService::syncCachedStock($m->material_id, $m->product_id);
            }

            // 2. Revert Treasury Outflow
            TreasuryService::revertBySource(PurchaseOrder::class, $order->id);

            // 3. Revert Supplier Debt if received
            if ($order->status === 'Received' && $order->supplier) {
                $unpaid = max(0.0, (float) $order->total_amount - (float) ($order->deposit_paid ?? 0));
                if ($unpaid > 0) {
                    $order->supplier->decrement('debt_amount', min($unpaid, (float) $order->supplier->debt_amount));
                }
            }

            $order->items()->delete();
            $order->forceDelete();

            return response()->json(['message' => 'تم حذف أمر الشراء بنجاح وإلغاء جميع متعلقاته.']);
        });
    }

    private function generateOrderNumber(): string
    {
        $year = Carbon::now()->year;
        $prefix = "PO-{$year}-";

        $existing = PurchaseOrder::withTrashed()
            ->where('order_number', 'LIKE', "{$prefix}%")
            ->pluck('order_number')
            ->map(function ($num) use ($prefix) {
                $suffix = substr($num, strlen($prefix));
                return is_numeric($suffix) ? (int) $suffix : 0;
            });

        $maxSeq = $existing->isNotEmpty() ? $existing->max() : 0;
        $nextSeq = $maxSeq + 1;
        $poNo = $prefix . str_pad($nextSeq, 4, '0', STR_PAD_LEFT);

        while (
            PurchaseOrder::withTrashed()->where('order_number', $poNo)->exists() ||
            DB::table('purchase_orders')->where('order_number', $poNo)->exists()
        ) {
            $nextSeq++;
            $poNo = $prefix . str_pad($nextSeq, 4, '0', STR_PAD_LEFT);
        }

        return $poNo;
    }
}
