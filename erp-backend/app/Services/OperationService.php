<?php

namespace App\Services;

use App\Models\Operation;
use App\Models\OperationPayment;
use App\Services\TreasuryService;
use App\Services\InventoryService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class OperationService
{
    /**
     * Move a pending operation into production.
     */
    public static function startProduction(Operation $operation): Operation
    {
        $operation->update([
            'status' => 'In_Progress',
            'start_date' => Carbon::now()
        ]);

        return $operation;
    }

    /**
     * Complete an operation: consume raw materials via FIFO, receive
     * manufactured products with true FIFO unit cost and transfer stock-taken items.
     */
    public static function completeProduction(Operation $operation): Operation
    {
        return DB::transaction(function () use ($operation) {
            $user = auth()->id();
            $whFin = \App\Models\Warehouse::clientOrdersWarehouse();
            $whProd = \App\Models\Warehouse::productsWarehouse();

            // If order has a client -> goes to WH-FIN (client orders warehouse)
            // If order is FOR STOCK / SHOWROOM (no client) -> goes directly to WSH-P (products warehouse / showroom)
            $isForStock = empty($operation->client_id);
            $targetWarehouseId = ($isForStock && $whProd)
                ? $whProd->id
                : ($whFin ? $whFin->id : $operation->warehouse_id);

            $sourceWhId = $whProd ? $whProd->id : $operation->warehouse_id;

            // 1. Prepare items to process
            $itemsToProcess = [];
            if ($operation->operationProducts && $operation->operationProducts->count() > 0) {
                foreach ($operation->operationProducts as $opProd) {
                    $product = $opProd->product;
                    if (!$product)
                        continue;

                    $totalQty = (float) $opProd->quantity;
                    $qtyFromStock = (float) ($opProd->quantity_taken_from_stock ?? 0);

                    // If quantity_taken_from_stock was not explicitly set on creation and use_stock is true
                    if ($qtyFromStock == 0 && $operation->use_stock && is_null($opProd->quantity_taken_from_stock)) {
                        $avail = InventoryService::getStock('product', $product->id, $sourceWhId);
                        $qtyFromStock = min($totalQty, max(0.0, $avail));
                        $opProd->quantity_taken_from_stock = $qtyFromStock;
                        $opProd->save();
                    }

                    $qtyToManufacture = max(0.0, $totalQty - $qtyFromStock);

                    $itemsToProcess[] = [
                        'product' => $product,
                        'totalQuantity' => $totalQty,
                        'qtyFromStock' => $qtyFromStock,
                        'qtyToManufacture' => $qtyToManufacture,
                    ];
                }
            } elseif ($operation->product) {
                $product = $operation->product;
                $totalQty = (float) ($operation->quantity ?? 1);
                $qtyFromStock = 0.0;
                $qtyToManufacture = $totalQty;

                if ($operation->use_stock) {
                    $avail = InventoryService::getStock('product', $product->id, $sourceWhId);
                    $qtyFromStock = min($totalQty, max(0.0, $avail));
                    $qtyToManufacture = max(0.0, $totalQty - $qtyFromStock);
                }

                $itemsToProcess[] = [
                    'product' => $product,
                    'totalQuantity' => $totalQty,
                    'qtyFromStock' => $qtyFromStock,
                    'qtyToManufacture' => $qtyToManufacture,
                ];
            }

            // 2. Aggregate raw materials needed
            $requiredMaterials = [];
            foreach ($itemsToProcess as $item) {
                $product = $item['product'];
                $prodQty = $item['qtyToManufacture'];
                if ($prodQty <= 0)
                    continue;

                foreach ($product->materials as $material) {
                    if ($material->type === 'service')
                        continue;
                    $req = $material->pivot->quantity * $prodQty;
                    if (!isset($requiredMaterials[$material->id])) {
                        $requiredMaterials[$material->id] = ['material' => $material, 'required' => 0];
                    }
                    $requiredMaterials[$material->id]['required'] += $req;
                }
            }

            // 3. Validate raw materials stock
            foreach ($requiredMaterials as $matId => $data) {
                $material = $data['material'];
                $required = $data['required'];
                $avail = InventoryService::getStock('material', $material->id, $operation->warehouse_id);

                if ($avail < $required) {
                    throw new \InvalidArgumentException("عذراً، لا يمكن إتمام التصنيع لعدم توفر كمية كافية من مادة ({$material->name}). المطلوب: {$required}، المتوفر: {$avail}");
                }
            }

            // 4 & 5. Consume raw materials via FIFO and receive manufactured products with true FIFO unit cost
            foreach ($itemsToProcess as $item) {
                $product = $item['product'];
                $toProduce = $item['qtyToManufacture'];
                $fromStock = $item['qtyFromStock'];

                $actualBatchTotalCost = 0.0;

                if ($toProduce > 0) {
                    // Calculate FIFO consumption of materials for this specific product
                    foreach ($product->materials as $material) {
                        $qtyNeeded = (float) ($material->pivot->quantity ?? 1) * $toProduce;
                        if ($qtyNeeded <= 0) continue;

                        if ($material->type === 'service') {
                            $serviceCost = round($qtyNeeded * (float) $material->unit_cost, 2);
                            $actualBatchTotalCost += $serviceCost;
                        } else {
                            $fifoMat = InventoryService::consumeFifoQuantity('material', $material->id, $operation->warehouse_id, $qtyNeeded);
                            $matCost = $fifoMat['total_cogs'] > 0 ? $fifoMat['total_cogs'] : round($qtyNeeded * (float) $material->unit_cost, 2);
                            $actualBatchTotalCost += $matCost;

                            if (!empty($fifoMat['consumed_layers'])) {
                                foreach ($fifoMat['consumed_layers'] as $cLayer) {
                                    InventoryService::recordMovement(
                                        warehouseId: $operation->warehouse_id,
                                        materialId: $material->id,
                                        productId: null,
                                        movementType: 'Production_Consumption',
                                        quantity: $cLayer['quantity_consumed'],
                                        unitCost: $cLayer['unit_cost'],
                                        referenceNumber: $operation->operation_number,
                                        notes: "استهلاك تصنيع FIFO - أمر {$operation->operation_number} لإنتاج {$toProduce} {$product->name}",
                                        userId: $user
                                    );
                                }
                            } else {
                                InventoryService::recordMovement(
                                    warehouseId: $operation->warehouse_id,
                                    materialId: $material->id,
                                    productId: null,
                                    movementType: 'Production_Consumption',
                                    quantity: $qtyNeeded,
                                    unitCost: (float) $material->unit_cost,
                                    referenceNumber: $operation->operation_number,
                                    notes: "استهلاك تصنيع - أمر {$operation->operation_number}",
                                    userId: $user
                                );
                            }
                        }
                    }

                    $materialUnitCost = $toProduce > 0 ? round($actualBatchTotalCost / $toProduce, 2) : 0.0;
                    $laborPerUnit = $operation->quantity > 0 ? round((float)$operation->labor_cost / (float)$operation->quantity, 2) : 0.0;
                    $actualBatchUnitCost = round($materialUnitCost + $laborPerUnit, 2);

                    if ($laborPerUnit > $materialUnitCost && $materialUnitCost > 0) {
                        \Illuminate\Support\Facades\Log::warning("Operation {$operation->operation_number} has unusual high labor cost per unit", [
                            'labor_per_unit' => $laborPerUnit,
                            'material_unit_cost' => $materialUnitCost
                        ]);
                    }

                    InventoryService::recordMovement(
                        warehouseId: $targetWarehouseId,
                        materialId: null,
                        productId: $product->id,
                        movementType: 'Production_Receipt',
                        quantity: $toProduce,
                        unitCost: $actualBatchUnitCost,
                        referenceNumber: $operation->operation_number,
                        notes: "توريد إنتاج تام FIFO (تكلفة حقيقية) - أمر تشغيل {$operation->operation_number}",
                        userId: $user
                    );
                }

                // If taken from pre-existing stock and target warehouse differs, transfer between them
                if ($fromStock > 0 && $targetWarehouseId !== $sourceWhId) {
                    $fifoStock = InventoryService::consumeFifoQuantity('product', $product->id, $sourceWhId, $fromStock);
                    $stockUnitCost = $fifoStock['blended_unit_cost'] > 0 ? $fifoStock['blended_unit_cost'] : (float) $product->unit_cost;

                    InventoryService::recordMovement(
                        warehouseId: $sourceWhId,
                        materialId: null,
                        productId: $product->id,
                        movementType: 'Transfer_Out',
                        quantity: $fromStock,
                        unitCost: $stockUnitCost,
                        referenceNumber: $operation->operation_number,
                        notes: "نقل منتج جاهز من المخزن إلى طلبيات العملاء لأمر {$operation->operation_number}",
                        userId: $user
                    );

                    InventoryService::recordMovement(
                        warehouseId: $targetWarehouseId,
                        materialId: null,
                        productId: $product->id,
                        movementType: 'Transfer_In',
                        quantity: $fromStock,
                        unitCost: $stockUnitCost,
                        referenceNumber: $operation->operation_number,
                        notes: "استلام منتج جاهز لتغطية طلبية عميل لأمر {$operation->operation_number}",
                        userId: $user
                    );
                }
            }

            $operation->update([
                'status' => 'Completed',
                'completion_date' => Carbon::now()
            ]);

            return $operation->load(['client', 'operationProducts.product']);
        });
    }

    /**
     * Cancel an operation: release manufactured stock back to the showroom
     * or revert staged movements, optionally refunding deposits/payments.
     */
    public static function cancelProduction(Operation $operation, bool $refundDeposit): array
    {
        return DB::transaction(function () use ($operation, $refundDeposit) {
            $user = auth()->id();
            $wasCompleted = $operation->status === 'Completed';
            $whFin = \App\Models\Warehouse::clientOrdersWarehouse();
            $targetFinId = $whFin ? $whFin->id : $operation->warehouse_id;
            $whProd = \App\Models\Warehouse::productsWarehouse();
            $targetProdId = $whProd ? $whProd->id : $operation->warehouse_id;

            if ($wasCompleted) {
                // Option 2: Products were already manufactured. Transfer them from WH-FIN to WSH-P (Showroom)
                $items = $operation->operationProducts;
                if ($items->count() === 0 && $operation->product) {
                    $items = collect([
                        (object) [
                            'product' => $operation->product,
                            'product_id' => $operation->product_id,
                            'quantity' => $operation->quantity ?? 1,
                        ]
                    ]);
                }

                foreach ($items as $opProd) {
                    $product = $opProd->product;
                    if (!$product)
                        continue;

                    $qty = (float) $opProd->quantity;
                    $unitCost = (float) $product->unit_cost;

                    // 1. Transfer Out of WH-FIN (Release client reservation)
                    InventoryService::recordMovement(
                        warehouseId: $targetFinId,
                        materialId: null,
                        productId: $product->id,
                        movementType: 'Transfer_Out',
                        quantity: $qty,
                        unitCost: $unitCost,
                        referenceNumber: $operation->operation_number,
                        notes: "تحويل منتجات أمر ملغى ({$operation->operation_number}) من مستودع الطلبيات إلى مستودع المنتجات الجاهزة",
                        userId: $user
                    );

                    // 2. Transfer In to WSH-P (Available for sale in Showroom)
                    InventoryService::recordMovement(
                        warehouseId: $targetProdId,
                        materialId: null,
                        productId: $product->id,
                        movementType: 'Transfer_In',
                        quantity: $qty,
                        unitCost: $unitCost,
                        referenceNumber: $operation->operation_number,
                        notes: "استلام منتجات أمر ملغى ({$operation->operation_number}) كبضاعة جاهزة للبيع بالمعرض",
                        userId: $user
                    );
                }
            } else {
                // Pending / In_Progress: Revert any staged movements
                $movements = \App\Models\InventoryMovement::where('reference_number', $operation->operation_number)->get();
                foreach ($movements as $m) {
                    $m->delete();
                    InventoryService::syncCachedStock($m->material_id, $m->product_id);
                }
            }

            // Handle Deposit / Payments
            if ($refundDeposit) {
                TreasuryService::revertBySource(Operation::class, $operation->id);
                foreach ($operation->payments as $pay) {
                    TreasuryService::revertBySource(OperationPayment::class, $pay->id);
                }
                $operation->payments()->delete();
            }

            $operation->update(['status' => 'Cancelled']);

            if ($operation->client) {
                $operation->client->recalculateDebt();
            }

            $msg = $wasCompleted
                ? 'تم إلغاء أمر التشغيل بنجاح، ونقل المنتجات المصنعة إلى مستودع المنتجات الجاهزة (المعرض) لتصبح متاحة للبيع لأي عميل آخر.'
                : 'تم إلغاء أمر التشغيل والتراجع عن القيود بنجاح.';

            return [
                'message' => $msg,
                'operation' => $operation,
            ];
        });
    }
}
