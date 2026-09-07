<?php

namespace App\Services;

use App\Models\Operation;
use App\Models\OperationPayment;
use App\Models\Product;
use App\Models\Warehouse;
use App\Services\TreasuryService;
use App\Services\InventoryService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class OperationService
{
    /**
     * Move a pending operation into production AND immediately issue (consume)
     * all raw materials and sub-products from stock.
     *
     * GAP-6 Fix: Materials are consumed at START (not completion), which matches
     * the standard manufacturing accounting flow:
     *   Start  → issue materials  (Work-in-Progress)
     *   Complete → receive finished goods
     *
     * Must be called inside a DB::transaction.
     */
    public static function startProduction(Operation $operation): Operation
    {
        return DB::transaction(function () use ($operation) {
            $user = auth()->id();
            $whProd = Warehouse::productsWarehouse();
            $prodWhId = $whProd ? $whProd->id : $operation->warehouse_id;

            // Reload with full relations
            $operation->loadMissing([
                'operationProducts.product.materials',
                'operationProducts.product.bomItems.subProduct',
                'product.materials',
                'product.bomItems.subProduct',
            ]);

            $items = static::resolveOperationItems($operation);

            // ── Validate everything before touching stock ──────────────────
            foreach ($items as $item) {
                $product       = $item['product'];
                $qtyToMake     = $item['qtyToManufacture'];
                if ($qtyToMake <= 0) continue;

                // Check raw materials
                foreach ($product->materials as $mat) {
                    if ($mat->type === 'service') continue;
                    $req   = (float) $mat->pivot->quantity * $qtyToMake;
                    $avail = InventoryService::getStock('material', $mat->id, $operation->warehouse_id);
                    if ($avail < $req) {
                        throw new \InvalidArgumentException(
                            "لا يمكن بدء التصنيع: ينقص ({$mat->name}). المطلوب: {$req}، المتوفر: {$avail}"
                        );
                    }
                }

                // Check sub-products
                $subLines = $product->bomItems()->whereNotNull('sub_product_id')->with('subProduct')->get();
                foreach ($subLines as $bomLine) {
                    $sub = $bomLine->subProduct;
                    if (!$sub) continue;
                    $req   = (float) $bomLine->quantity * $qtyToMake;
                    $avail = InventoryService::getStock('product', $sub->id, $prodWhId);
                    if ($avail < $req) {
                        throw new \InvalidArgumentException(
                            "لا يمكن بدء التصنيع: ينقص المنتج الفرعي ({$sub->name}). المطلوب: {$req}، المتوفر: {$avail}"
                        );
                    }
                }
            }

            // ── Issue (consume) materials and sub-products ─────────────────
            foreach ($items as $item) {
                $product   = $item['product'];
                $qtyToMake = $item['qtyToManufacture'];
                if ($qtyToMake <= 0) continue;

                // Raw materials
                foreach ($product->materials as $mat) {
                    if ($mat->type === 'service') continue;
                    $qtyNeeded = (float) $mat->pivot->quantity * $qtyToMake;
                    if ($qtyNeeded <= 0) continue;

                    $fifo = InventoryService::consumeFifoQuantity('material', $mat->id, $operation->warehouse_id, $qtyNeeded);

                    $layers = !empty($fifo['consumed_layers']) ? $fifo['consumed_layers'] : [[
                        'quantity_consumed' => $qtyNeeded,
                        'unit_cost'         => (float) $mat->unit_cost,
                    ]];
                    foreach ($layers as $cLayer) {
                        InventoryService::recordMovement(
                            warehouseId:     $operation->warehouse_id,
                            materialId:      $mat->id,
                            productId:       null,
                            movementType:    'Production_Consumption',
                            quantity:        $cLayer['quantity_consumed'],
                            unitCost:        $cLayer['unit_cost'],
                            referenceNumber: $operation->operation_number,
                            notes:           "إصدار خامة للإنتاج (GAP-6) - أمر {$operation->operation_number} — {$product->name} ×{$qtyToMake}",
                            userId:          $user
                        );
                    }
                }

                // Sub-products
                $subLines = $product->bomItems()->whereNotNull('sub_product_id')->with('subProduct')->get();
                foreach ($subLines as $bomLine) {
                    $sub = $bomLine->subProduct;
                    if (!$sub) continue;
                    $subQty = (float) $bomLine->quantity * $qtyToMake;
                    if ($subQty <= 0) continue;

                    $fifo = InventoryService::consumeFifoQuantity('product', $sub->id, $prodWhId, $subQty);

                    $layers = !empty($fifo['consumed_layers']) ? $fifo['consumed_layers'] : [[
                        'quantity_consumed' => $subQty,
                        'unit_cost'         => (float) $sub->unit_cost,
                    ]];
                    foreach ($layers as $cLayer) {
                        InventoryService::recordMovement(
                            warehouseId:     $prodWhId,
                            materialId:      null,
                            productId:       $sub->id,
                            movementType:    'Production_Consumption',
                            quantity:        $cLayer['quantity_consumed'],
                            unitCost:        $cLayer['unit_cost'],
                            referenceNumber: $operation->operation_number,
                            notes:           "إصدار منتج فرعي للإنتاج (GAP-6) - أمر {$operation->operation_number} — {$product->name} ×{$qtyToMake}",
                            userId:          $user
                        );
                    }
                }
            }

            $operation->update([
                'status'     => 'In_Progress',
                'start_date' => Carbon::now(),
            ]);

            return $operation;
        });
    }

    /**
     * Check whether an operation can be started/completed right now.
     *
     * GAP-7 Fix: Sub-product shortage check is now RECURSIVE. If a sub-product
     * itself has sub-product BOM lines (depth > 2), the check goes all the way
     * down to find the leaf-level raw materials needed.
     */
    public static function checkReadiness(Operation $operation): array
    {
        // If the operation is already In_Progress, all required materials and sub-products
        // were ALREADY issued and consumed into production at startProduction().
        // Therefore, it does NOT require additional warehouse stock to complete.
        if ($operation->status === 'In_Progress' || $operation->status === 'Completed') {
            return [
                'can_complete'         => true,
                'missing_sub_products' => [],
                'missing_materials'    => [],
                'already_in_progress'  => true,
            ];
        }

        $whProd   = Warehouse::productsWarehouse();
        $prodWhId = $whProd ? $whProd->id : $operation->warehouse_id;
        $items    = static::resolveOperationItems($operation);

        $missingSubProducts = [];
        $missingMaterials   = [];

        foreach ($items as $item) {
            $product          = $item['product'];
            $qtyToManufacture = $item['qtyToManufacture'];
            if ($qtyToManufacture <= 0) continue;

            // Recursively check the full BOM tree
            static::checkBomNodeReadiness(
                $product, $qtyToManufacture, $prodWhId, $operation->warehouse_id,
                $missingSubProducts, $missingMaterials
            );
        }

        // Promote blocking materials from un-producible sub-products as hard blockers
        foreach ($missingSubProducts as $sp) {
            if (!$sp['can_produce']) {
                foreach ($sp['blocking_materials'] as $bm) {
                    $missingMaterials[] = $bm;
                }
            }
        }

        $canComplete = empty($missingSubProducts) && empty($missingMaterials);

        return [
            'can_complete'         => $canComplete,
            'missing_sub_products' => $missingSubProducts,
            'missing_materials'    => $missingMaterials,
        ];
    }

    /**
     * Internal recursive helper for checkReadiness.
     * Walks down one BOM node, recurses into sub-products.
     */
    private static function checkBomNodeReadiness(
        Product $product,
        float   $qtyToMake,
        int     $prodWhId,
        int     $rawWhId,
        array   &$missingSubProducts,
        array   &$missingMaterials,
        int     $depth = 0
    ): void {
        if ($depth > 10) return;

        // ── Sub-product BOM lines ──
        $subLines = $product->bomItems()
            ->whereNotNull('sub_product_id')
            ->with(['subProduct.materials', 'subProduct.bomItems.subProduct'])
            ->get();

        foreach ($subLines as $bomLine) {
            $sub = $bomLine->subProduct;
            if (!$sub) continue;

            $required  = (float) $bomLine->quantity * $qtyToMake;
            $available = InventoryService::getStock('product', $sub->id, $prodWhId);
            $shortage  = max(0.0, round($required - $available, 4));

            if ($shortage > 0) {
                $canProduce        = true;
                $blockingMaterials = [];

                // Check this sub-product's raw materials
                foreach ($sub->materials as $mat) {
                    if ($mat->type === 'service') continue;
                    $matReq   = (float) $mat->pivot->quantity * $shortage;
                    $matAvail = InventoryService::getStock('material', $mat->id, $rawWhId);
                    if ($matAvail < $matReq) {
                        $canProduce          = false;
                        $blockingMaterials[] = [
                            'material_id'   => $mat->id,
                            'material_name' => $mat->name,
                            'required'      => $matReq,
                            'available'     => $matAvail,
                            'shortage'      => round($matReq - $matAvail, 4),
                        ];
                    }
                }

                $missingSubProducts[] = [
                    'product_id'         => $sub->id,
                    'product_name'       => $sub->name,
                    'required'           => $required,
                    'available'          => $available,
                    'shortage'           => $shortage,
                    'can_produce'        => $canProduce,
                    'blocking_materials' => $blockingMaterials,
                    'depth'              => $depth,
                ];

                // GAP-7: recurse into the sub-product's own BOM (for depth > 2)
                static::checkBomNodeReadiness(
                    $sub, $shortage, $prodWhId, $rawWhId,
                    $missingSubProducts, $missingMaterials, $depth + 1
                );
            }
        }

        // ── Direct raw-material BOM lines ──
        foreach ($product->materials as $material) {
            if ($material->type === 'service') continue;
            $required  = (float) $material->pivot->quantity * $qtyToMake;
            $available = InventoryService::getStock('material', $material->id, $rawWhId);
            if ($available < $required) {
                $missingMaterials[] = [
                    'material_id'   => $material->id,
                    'material_name' => $material->name,
                    'required'      => $required,
                    'available'     => $available,
                    'shortage'      => round($required - $available, 4),
                ];
            }
        }
    }

    /**
     * Auto-produce any sub-products that are short for this operation.
     *
     * GAP-7 Fix: This method is now RECURSIVE. If a sub-product itself has
     * sub-product BOM lines (depth > 2), those are also auto-produced first
     * before the current level is produced.
     *
     * Must be called inside the same DB::transaction as startProduction.
     * Throws \InvalidArgumentException if raw materials are insufficient.
     */
    public static function autoProduceSubProducts(Operation $parentOperation, int $depth = 0): void
    {
        // Never auto-produce for an operation that is already In_Progress or Completed,
        // because its required sub-products were already issued/consumed into production at startProduction().
        if ($parentOperation->status === 'In_Progress' || $parentOperation->status === 'Completed') {
            return;
        }

        if ($depth > 10) {
            throw new \InvalidArgumentException('تجاوز الحد الأقصى لعمق BOM المتداخل (10 مستويات).');
        }

        $whProd   = Warehouse::productsWarehouse();
        $prodWhId = $whProd ? $whProd->id : $parentOperation->warehouse_id;

        $items = static::resolveOperationItems($parentOperation);

        foreach ($items as $item) {
            $product          = $item['product'];
            $qtyToManufacture = $item['qtyToManufacture'];
            if ($qtyToManufacture <= 0) continue;

            $subProductLines = $product->bomItems()
                ->whereNotNull('sub_product_id')
                ->with(['subProduct.materials', 'subProduct.bomItems.subProduct'])
                ->get();

            foreach ($subProductLines as $bomLine) {
                $subProduct = $bomLine->subProduct;
                if (!$subProduct) continue;

                $required  = (float) $bomLine->quantity * $qtyToManufacture;
                $available = InventoryService::getStock('product', $subProduct->id, $prodWhId);
                $shortage  = max(0.0, round($required - $available, 4));

                if ($shortage <= 0) continue;

                // ── GAP-7: Recursively produce the sub-product's own sub-products first ──
                // Create a temporary shell operation representing the sub-product shortfall
                $childOp = Operation::create([
                    'product_id'          => $subProduct->id,
                    'quantity'            => $shortage,
                    'warehouse_id'        => $parentOperation->warehouse_id,
                    'status'              => 'Pending',
                    'notes'               => "أمر تشغيل فرعي تلقائي (مستوى {$depth}) — نقص ({$subProduct->name}) في {$parentOperation->operation_number}",
                    'parent_operation_id' => $parentOperation->id,
                ]);
                $childOp->load(['product.materials', 'product.bomItems.subProduct']);

                // Recursively handle the child's own sub-products first
                static::autoProduceSubProducts($childOp, $depth + 1);

                // Now validate that raw materials exist for this child
                foreach ($subProduct->materials as $mat) {
                    if ($mat->type === 'service') continue;
                    $matRequired  = (float) $mat->pivot->quantity * $shortage;
                    $matAvailable = InventoryService::getStock('material', $mat->id, $parentOperation->warehouse_id);
                    if ($matAvailable < $matRequired) {
                        throw new \InvalidArgumentException(
                            "لا يمكن إنتاج ({$subProduct->name}): ينقص {$mat->name}. " .
                            "المطلوب: {$matRequired}، المتوفر: {$matAvailable}"
                        );
                    }
                }

                // Start + complete the child operation (materials issued at start, goods received at complete)
                static::startProduction($childOp);
                static::completeProduction($childOp);
            }
        }
    }

    /**
     * Complete an operation: record the finished-goods Production_Receipt.
     *
     * GAP-6 Note: raw materials and sub-products were already issued at startProduction.
     * We compute the true FIFO batch cost by summing the Production_Consumption movements
     * already recorded against this operation's reference number.
     *
     * BUG-3 Fix: after recording the receipt we update product.unit_cost to the
     * actual per-unit FIFO production cost of this batch.
     */
    public static function completeProduction(Operation $operation): Operation
    {
        return DB::transaction(function () use ($operation) {
            // If operation was never started (still Pending), start it first to issue materials
            if ($operation->status === 'Pending') {
                static::startProduction($operation);
                $operation->refresh();
            }

            $user = auth()->id();
            $whFin  = \App\Models\Warehouse::clientOrdersWarehouse();
            $whProd = \App\Models\Warehouse::productsWarehouse();

            $isForStock        = empty($operation->client_id);
            $targetWarehouseId = ($isForStock && $whProd)
                ? $whProd->id
                : ($whFin ? $whFin->id : $operation->warehouse_id);
            $sourceWhId = $whProd ? $whProd->id : $operation->warehouse_id;

            $itemsToProcess = static::resolveOperationItems($operation);

            // Service-material cost additions (services are not issued at start)
            foreach ($itemsToProcess as $item) {
                $product   = $item['product'];
                $toProduce = $item['qtyToManufacture'];
                $fromStock = $item['qtyFromStock'];

                if ($toProduce > 0) {
                    // ── Compute actual FIFO batch cost from already-recorded movements ──
                    // Sum all Production_Consumption movements recorded against this op
                    // (both raw materials and sub-products) to get true total cost.
                    $alreadyConsumedCost = (float) \App\Models\InventoryMovement::where(
                        'reference_number', $operation->operation_number
                    )->where('movement_type', 'Production_Consumption')->sum(
                        \Illuminate\Support\Facades\DB::raw('quantity * unit_cost')
                    );

                    // Add service-material costs (they were not consumed at start)
                    $serviceCost = 0.0;
                    foreach ($product->materials as $material) {
                        if ($material->type !== 'service') continue;
                        $qtyNeeded = (float) ($material->pivot->quantity ?? 1) * $toProduce;
                        $serviceCost += round($qtyNeeded * (float) $material->unit_cost, 2);
                    }

                    $totalBatchCost = $alreadyConsumedCost + $serviceCost;

                    $laborPerUnit       = $operation->quantity > 0
                        ? round((float) $operation->labor_cost / (float) $operation->quantity, 2)
                        : 0.0;
                    $materialUnitCost   = $toProduce > 0 ? round($totalBatchCost / $toProduce, 2) : 0.0;
                    $actualBatchUnitCost = round($materialUnitCost + $laborPerUnit, 2);

                    InventoryService::recordMovement(
                        warehouseId:     $targetWarehouseId,
                        materialId:      null,
                        productId:       $product->id,
                        movementType:    'Production_Receipt',
                        quantity:        $toProduce,
                        unitCost:        $actualBatchUnitCost,
                        referenceNumber: $operation->operation_number,
                        notes:           "توريد إنتاج تام FIFO (تكلفة حقيقية) - أمر تشغيل {$operation->operation_number}",
                        userId:          $user
                    );

                    // BUG-3 Fix: update the product's unit_cost to the real production cost
                    if ($actualBatchUnitCost > 0) {
                        Product::where('id', $product->id)->update(['unit_cost' => $actualBatchUnitCost]);
                    }
                }

                // Stock items: transfer between warehouses if needed
                if ($fromStock > 0 && $targetWarehouseId !== $sourceWhId) {
                    $fifoStock     = InventoryService::consumeFifoQuantity('product', $product->id, $sourceWhId, $fromStock);
                    $stockUnitCost = $fifoStock['blended_unit_cost'] > 0 ? $fifoStock['blended_unit_cost'] : (float) $product->unit_cost;

                    InventoryService::recordMovement(
                        warehouseId:     $sourceWhId,
                        materialId:      null,
                        productId:       $product->id,
                        movementType:    'Transfer_Out',
                        quantity:        $fromStock,
                        unitCost:        $stockUnitCost,
                        referenceNumber: $operation->operation_number,
                        notes:           "نقل منتج جاهز من المخزن إلى طلبيات العملاء لأمر {$operation->operation_number}",
                        userId:          $user
                    );

                    InventoryService::recordMovement(
                        warehouseId:     $targetWarehouseId,
                        materialId:      null,
                        productId:       $product->id,
                        movementType:    'Transfer_In',
                        quantity:        $fromStock,
                        unitCost:        $stockUnitCost,
                        referenceNumber: $operation->operation_number,
                        notes:           "استلام منتج جاهز لتغطية طلبية عميل لأمر {$operation->operation_number}",
                        userId:          $user
                    );
                }
            }

            $operation->update([
                'status'          => 'Completed',
                'completion_date' => Carbon::now(),
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
                // Pending / In_Progress:
                // GAP-6 Fix: if the operation was In_Progress, materials were already issued at
                // startProduction → we must reverse those Production_Consumption movements.
                // If still Pending, there are no movements to revert.
                if ($operation->status === 'In_Progress') {
                    $movements = \App\Models\InventoryMovement::where('reference_number', $operation->operation_number)
                        ->where('movement_type', 'Production_Consumption')
                        ->get();
                    foreach ($movements as $m) {
                        // Reverse: record equal incoming movement to put stock back
                        InventoryService::recordMovement(
                            warehouseId:     $m->warehouse_id,
                            materialId:      $m->material_id,
                            productId:       $m->product_id,
                            movementType:    'Stock_Adjustment',
                            quantity:        $m->quantity,
                            unitCost:        $m->unit_cost,
                            referenceNumber: $operation->operation_number . '-CANCEL',
                            notes:           "إعادة مواد أمر ملغى ({$operation->operation_number}) - تراجع عن إصدار المواد",
                            userId:          $user
                        );
                    }
                } else {
                    // Pending — no movements were recorded yet, nothing to revert
                    $movements = \App\Models\InventoryMovement::where('reference_number', $operation->operation_number)->get();
                    foreach ($movements as $m) {
                        $m->delete();
                        InventoryService::syncCachedStock($m->material_id, $m->product_id);
                    }
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

    /**
     * Resolve the list of product items an operation needs to manufacture.
     * Shared by checkReadiness, autoProduceSubProducts, and completeProduction.
     *
     * Each entry: ['product', 'totalQuantity', 'qtyFromStock', 'qtyToManufacture']
     */
    private static function resolveOperationItems(Operation $operation): array
    {
        $whProd    = Warehouse::productsWarehouse();
        $sourceWhId = $whProd ? $whProd->id : $operation->warehouse_id;

        $items = [];

        if ($operation->operationProducts && $operation->operationProducts->count() > 0) {
            foreach ($operation->operationProducts as $opProd) {
                $product = $opProd->product;
                if (!$product) continue;

                $totalQty     = (float) $opProd->quantity;
                $qtyFromStock = (float) ($opProd->quantity_taken_from_stock ?? 0);

                if ($qtyFromStock == 0 && $operation->use_stock && is_null($opProd->quantity_taken_from_stock)) {
                    $avail        = InventoryService::getStock('product', $product->id, $sourceWhId);
                    $qtyFromStock = min($totalQty, max(0.0, $avail));
                }

                $items[] = [
                    'product'          => $product,
                    'totalQuantity'    => $totalQty,
                    'qtyFromStock'     => $qtyFromStock,
                    'qtyToManufacture' => max(0.0, $totalQty - $qtyFromStock),
                ];
            }
        } elseif ($operation->product) {
            $product      = $operation->product;
            $totalQty     = (float) ($operation->quantity ?? 1);
            $qtyFromStock = 0.0;

            if ($operation->use_stock) {
                $avail        = InventoryService::getStock('product', $product->id, $sourceWhId);
                $qtyFromStock = min($totalQty, max(0.0, $avail));
            }

            $items[] = [
                'product'          => $product,
                'totalQuantity'    => $totalQty,
                'qtyFromStock'     => $qtyFromStock,
                'qtyToManufacture' => max(0.0, $totalQty - $qtyFromStock),
            ];
        }

        return $items;
    }
}
