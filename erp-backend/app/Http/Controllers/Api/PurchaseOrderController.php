<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\InventoryMovement;
use App\Models\Warehouse;
use App\Models\Expense;
use App\Models\Supplier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class PurchaseOrderController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 20);
        $paginator = PurchaseOrder::with(['supplier', 'items.material'])
            ->orderBy('created_at', 'desc')
            ->paginate($perPage);

        $paginator->setCollection(
            $paginator->getCollection()->map(function ($ord) {
                return [
                    'id' => $ord->id,
                    'order_number' => $ord->order_number,
                    'supplier_id' => $ord->supplier_id,
                    'supplier_name' => $ord->supplier->name ?? '',
                    'status' => $ord->status,
                    'order_date' => $ord->order_date,
                    'total_amount' => (float)$ord->total_amount,
                    'deposit_paid' => (float)($ord->deposit_paid ?? 0.00),
                    'items_count' => $ord->items->count(),
                    'notes' => $ord->notes,
                ];
            })
        );

        return response()->json($paginator);
    }

    public function show(string $id): JsonResponse
    {
        $order = PurchaseOrder::with(['supplier', 'items.material.category'])->findOrFail($id);
        return response()->json($order);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'supplier_id' => 'required|exists:suppliers,id',
            'order_date' => 'required|date',
            'notes' => 'nullable|string',
            'deposit_paid' => 'nullable|numeric|min:0',
            'items' => 'required|array|min:1',
            'items.*.material_id' => 'required|exists:materials,id',
            'items.*.quantity' => 'required|numeric|min:0.01',
            'items.*.unit_cost' => 'required|numeric|min:0',
        ]);

        return DB::transaction(function () use ($validated) {
            $poNo = 'PO-' . Carbon::now()->year . '-' . str_pad(PurchaseOrder::count() + 1, 4, '0', STR_PAD_LEFT);
            
            // Calculate total amount
            $totalAmount = 0;
            foreach ($validated['items'] as $item) {
                $totalAmount += $item['quantity'] * $item['unit_cost'];
            }

            $order = PurchaseOrder::create([
                'order_number' => $poNo,
                'supplier_id' => $validated['supplier_id'],
                'status' => 'Pending',
                'order_date' => $validated['order_date'],
                'total_amount' => $totalAmount,
                'deposit_paid' => $validated['deposit_paid'] ?? 0.00,
                'notes' => $validated['notes'],
            ]);

            foreach ($validated['items'] as $item) {
                PurchaseOrderItem::create([
                    'purchase_order_id' => $order->id,
                    'material_id' => $item['material_id'],
                    'quantity' => $item['quantity'],
                    'unit_cost' => $item['unit_cost'],
                    'total_cost' => $item['quantity'] * $item['unit_cost'],
                ]);
            }

            return response()->json([
                'message' => 'تم إنشاء طلب الشراء بنجاح بانتظار الاعتماد والاستلام',
                'order' => $order
            ], 201);
        });
    }

    public function receiveOrder(string $id): JsonResponse
    {
        $order = PurchaseOrder::with(['items.material', 'supplier'])->findOrFail($id);

        if ($order->status === 'Received') {
            return response()->json(['message' => 'هذا الطلب تم استلامه مسبقاً.'], 400);
        }

        return DB::transaction(function () use ($order) {
            $user = auth()->id();

            // Find warehouse WH-RAW
            $whRaw = Warehouse::where('code', 'WH-RAW')->first();
            $warehouseId = $whRaw ? $whRaw->id : Warehouse::first()->id;

             // 1. Create inventory movements for each item
             $mvCount = InventoryMovement::count();
             foreach ($order->items as $item) {
                 if ($item->material && $item->material->type === 'service') {
                     continue; // Services don't go to storage, skip inventory movement
                 }
                 $mvNo = 'MV-' . str_pad(++$mvCount, 5, '0', STR_PAD_LEFT);
                 InventoryMovement::create([
                     'movement_number' => $mvNo,
                     'movement_date' => Carbon::now(),
                     'warehouse_id' => $warehouseId,
                     'material_id' => $item->material_id,
                     'product_id' => null,
                     'movement_type' => 'Purchase_Receipt', // increases stock
                     'quantity' => $item->quantity,
                     'unit_cost' => $item->unit_cost,
                     'total_cost' => $item->quantity * $item->unit_cost,
                     'reference_number' => $order->order_number,
                     'notes' => 'توريد مشتريات تلقائي - فاتورة رقم ' . $order->order_number,
                     'created_by' => $user
                 ]);
             }

            // 2. Create financial expense record
            // Recalculate expense amount excluding inside-workshop services
            $expenseAmount = 0;
            foreach ($order->items as $item) {
                if ($item->material) {
                    if ($item->material->type === 'service') {
                        if ($item->material->service_location === 'outside') {
                            $expenseAmount += $item->quantity * $item->unit_cost;
                        }
                    } else {
                        $expenseAmount += $item->quantity * $item->unit_cost;
                    }
                }
            }

            $expNo = 'EXP-' . Carbon::now()->year . '-' . str_pad(Expense::count() + 1, 4, '0', STR_PAD_LEFT);
            Expense::create([
                'expense_number' => $expNo,
                'amount' => $order->deposit_paid > 0 ? $order->deposit_paid : $expenseAmount, // record cash paid as direct expense if deposit exists, otherwise fall back to full amount
                'expense_date' => Carbon::now(),
                'category' => 'شراء مواد خام',
                'description' => 'تكلفة دفعة فاتورة مشتريات من المورد (' . $order->supplier->name . ') رقم ' . $order->order_number,
                'reference_number' => $order->order_number
            ]);

            // 3. Update supplier debt by the unpaid portion
            $debt = max(0, $order->total_amount - $order->deposit_paid);
            if ($debt > 0 && $order->supplier) {
                $order->supplier->increment('debt_amount', $debt);
            }

            // 4. Update order status
            $order->update(['status' => 'Received']);

            return response()->json([
                'message' => 'تم استلام طلب الشراء بنجاح وتوريد البضاعة للمستودع، وتسجيل الدفعة في المصروفات، وإضافة المتبقي لدين المورد تلقائياً.'
            ]);
        });
    }
}
