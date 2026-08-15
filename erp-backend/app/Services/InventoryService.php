<?php

namespace App\Services;

use App\Models\InventoryMovement;
use App\Models\Material;
use App\Models\Product;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class InventoryService
{
    const INCOMING_TYPES = [
        'Initial_Balance',
        'Purchase_Receipt',
        'Production_Receipt',
        'Transfer_In',
    ];

    const OUTGOING_TYPES = [
        'Production_Consumption',
        'Sales_Issue',
        'Transfer_Out',
        'Damaged',
        'Supplier_Return',
    ];

    /**
     * Record an inventory movement and keep static stock cached accurately.
     */
    public static function recordMovement(
        int $warehouseId,
        ?int $materialId,
        ?int $productId,
        string $movementType,
        float $quantity,
        float $unitCost,
        ?string $referenceNumber = null,
        ?string $notes = null,
        ?string $movementDate = null,
        ?int $userId = null
    ): InventoryMovement {
        if ($quantity <= 0) {
            throw new \InvalidArgumentException('Movement quantity must be greater than zero.');
        }

        $movementDate = $movementDate ? Carbon::parse($movementDate) : Carbon::now();
        $mvNo = InventoryMovement::generateMovementNumber();
        $totalCost = round($quantity * $unitCost, 2);

        $movement = InventoryMovement::create([
            'movement_number' => $mvNo,
            'movement_date' => $movementDate,
            'warehouse_id' => $warehouseId,
            'material_id' => $materialId,
            'product_id' => $productId,
            'movement_type' => $movementType,
            'quantity' => $quantity,
            'unit_cost' => $unitCost,
            'total_cost' => $totalCost,
            'reference_number' => $referenceNumber,
            'notes' => $notes,
            'created_by' => $userId ?? auth()->id(),
        ]);

        // Sync cached stock column
        self::syncCachedStock($materialId, $productId);

        return $movement;
    }

    /**
     * Calculate live mathematical stock from movements (Single Source of Truth).
     */
    public static function getStock(string $type, int $id, ?int $warehouseId = null): float
    {
        $col = $type === 'material' ? 'material_id' : 'product_id';
        $query = InventoryMovement::where($col, $id);

        if ($warehouseId) {
            $query->where('warehouse_id', $warehouseId);
        }

        $incoming = (float) (clone $query)->where(function ($q) {
            $q->whereIn('movement_type', self::INCOMING_TYPES)
              ->orWhere(function ($sq) {
                  $sq->where('movement_type', 'Stock_Adjustment')->where('quantity', '>', 0);
              });
        })->sum('quantity');

        $outgoing = (float) (clone $query)->where(function ($q) {
            $q->whereIn('movement_type', self::OUTGOING_TYPES)
              ->orWhere(function ($sq) {
                  $sq->where('movement_type', 'Stock_Adjustment')->where('quantity', '<', 0);
              });
        })->sum('quantity');

        if ($incoming > 0) {
            return max(0.0, round($incoming - $outgoing, 2));
        }

        if (!InventoryMovement::where($col, $id)->exists()) {
            $model = $type === 'material' ? Material::find($id) : Product::find($id);
            return $model ? max(0.0, (float) ($model->stock_quantity ?? 0)) : 0.0;
        }

        // Only outgoing movements exist on an item created with baseline stock
        $model = $type === 'material' ? Material::find($id) : Product::find($id);
        $base = $model ? (float) ($model->stock_quantity ?? 0) : 0.0;
        return max(0.0, round($base - $outgoing, 2));
    }

    /**
     * Sync static stock_quantity column with live sum so DB column is always truthful.
     */
    public static function syncCachedStock(?int $materialId, ?int $productId): void
    {
        if ($materialId) {
            $incoming = (float) InventoryMovement::where('material_id', $materialId)
                ->where(function ($q) {
                    $q->whereIn('movement_type', self::INCOMING_TYPES)
                      ->orWhere(function ($sq) {
                          $sq->where('movement_type', 'Stock_Adjustment')->where('quantity', '>', 0);
                      });
                })->sum('quantity');

            $outgoing = (float) InventoryMovement::where('material_id', $materialId)
                ->where(function ($q) {
                    $q->whereIn('movement_type', self::OUTGOING_TYPES)
                      ->orWhere(function ($sq) {
                          $sq->where('movement_type', 'Stock_Adjustment')->where('quantity', '<', 0);
                      });
                })->sum('quantity');

            if ($incoming > 0 || !InventoryMovement::where('material_id', $materialId)->exists()) {
                $stock = max(0.0, round($incoming - $outgoing, 2));
            } else {
                $mat = Material::find($materialId);
                $base = $mat ? (float)($mat->stock_quantity ?? 0) : 0.0;
                $stock = max(0.0, round($base - $outgoing, 2));
            }

            DB::table('materials')->where('id', $materialId)->update(['stock_quantity' => $stock]);
        }

        if ($productId) {
            $incoming = (float) InventoryMovement::where('product_id', $productId)
                ->where(function ($q) {
                    $q->whereIn('movement_type', self::INCOMING_TYPES)
                      ->orWhere(function ($sq) {
                          $sq->where('movement_type', 'Stock_Adjustment')->where('quantity', '>', 0);
                      });
                })->sum('quantity');

            $outgoing = (float) InventoryMovement::where('product_id', $productId)
                ->where(function ($q) {
                    $q->whereIn('movement_type', self::OUTGOING_TYPES)
                      ->orWhere(function ($sq) {
                          $sq->where('movement_type', 'Stock_Adjustment')->where('quantity', '<', 0);
                      });
                })->sum('quantity');

            if ($incoming > 0 || !InventoryMovement::where('product_id', $productId)->exists()) {
                $stock = max(0.0, round($incoming - $outgoing, 2));
            } else {
                $prod = Product::find($productId);
                $base = $prod ? (float)($prod->stock_quantity ?? 0) : 0.0;
                $stock = max(0.0, round($base - $outgoing, 2));
            }

            DB::table('products')->where('id', $productId)->update(['stock_quantity' => $stock]);
        }
    }

    /**
     * Retrieve active FIFO batch layers with remaining quantities and historical costs.
     */
    public static function getFifoLayers(string $type, int $id, ?int $warehouseId = null): array
    {
        $col = $type === 'material' ? 'material_id' : 'product_id';

        $inQuery = InventoryMovement::where($col, $id)
            ->where(function ($q) {
                $q->whereIn('movement_type', self::INCOMING_TYPES)
                  ->orWhere(function ($sq) {
                      $sq->where('movement_type', 'Stock_Adjustment')->where('quantity', '>', 0);
                  });
            })
            ->orderBy('movement_date', 'asc')
            ->orderBy('id', 'asc');

        $outQuery = InventoryMovement::where($col, $id)
            ->where(function ($q) {
                $q->whereIn('movement_type', self::OUTGOING_TYPES)
                  ->orWhere(function ($sq) {
                      $sq->where('movement_type', 'Stock_Adjustment')->where('quantity', '<', 0);
                  });
            });

        if ($warehouseId) {
            $inQuery->where('warehouse_id', $warehouseId);
            $outQuery->where('warehouse_id', $warehouseId);
        }

        $incomingMovements = $inQuery->get();
        $totalOutgoing = (float) $outQuery->sum('quantity');

        $layers = [];
        $remainingOutgoing = $totalOutgoing;

        $productModel = $type === 'product' ? Product::find($id) : null;
        $materialModel = $type === 'material' ? Material::find($id) : null;

        // If no incoming movements recorded but baseline stock exists
        if ($incomingMovements->isEmpty()) {
            $model = $productModel ?? $materialModel;
            $baseStock = $model ? (float)($model->stock_quantity ?? 0) : 0.0;
            $netStock = max(0.0, round($baseStock - $totalOutgoing, 2));

            if ($netStock > 0 && $model) {
                $unitCost = (float)($model->unit_cost ?? 0);
                $salePrice = $productModel ? (float)($productModel->sale_price ?? 0) : null;
                $layers[] = [
                    'movement_id' => null,
                    'movement_number' => 'INIT-BASE',
                    'movement_date' => $model->created_at ? $model->created_at->toDateString() : Carbon::now()->toDateString(),
                    'movement_type' => 'Initial_Balance',
                    'type_label' => 'رصيد افتتاحي تأسيسي',
                    'original_quantity' => $baseStock,
                    'remaining_quantity' => $netStock,
                    'unit_cost' => $unitCost,
                    'sale_price' => $salePrice,
                    'total_cost' => round($netStock * $unitCost, 2),
                    'notes' => 'رصيد افتتاحي أولي مسجل في بطاقة الصنف',
                ];
            }
            return $layers;
        }

        foreach ($incomingMovements as $mv) {
            $qty = (float) $mv->quantity;
            $unitCost = (float) $mv->unit_cost;

            if ($remainingOutgoing >= $qty) {
                $remainingOutgoing -= $qty;
                continue; // Layer completely consumed
            }

            $availableInLayer = round($qty - $remainingOutgoing, 2);
            $remainingOutgoing = 0.0;

            if ($availableInLayer > 0) {
                $typeLabels = [
                    'Initial_Balance' => 'رصيد افتتاحي',
                    'Purchase_Receipt' => 'توريد مشتريات',
                    'Production_Receipt' => 'توريد إنتاج ورشة',
                    'Transfer_In' => 'تحويل وارد',
                    'Stock_Adjustment' => 'تسوية جردية موجبة',
                ];

                $salePrice = null;
                if ($type === 'product' && $productModel) {
                    $salePrice = (float)$productModel->sale_price;
                }

                $layers[] = [
                    'movement_id' => $mv->id,
                    'movement_number' => $mv->movement_number,
                    'movement_date' => Carbon::parse($mv->movement_date)->toDateString(),
                    'movement_type' => $mv->movement_type,
                    'type_label' => $typeLabels[$mv->movement_type] ?? $mv->movement_type,
                    'original_quantity' => $qty,
                    'remaining_quantity' => $availableInLayer,
                    'unit_cost' => $unitCost,
                    'sale_price' => $salePrice,
                    'total_cost' => round($availableInLayer * $unitCost, 2),
                    'reference_number' => $mv->reference_number,
                    'notes' => $mv->notes,
                ];
            }
        }

        return $layers;
    }

    /**
     * Consume quantity using FIFO layers and calculate exact COGS and layer breakdown.
     */
    public static function consumeFifoQuantity(string $type, int $id, ?int $warehouseId, float $quantityRequired): array
    {
        $layers = self::getFifoLayers($type, $id, $warehouseId);
        $remainingToConsume = $quantityRequired;
        $totalCogs = 0.0;
        $consumedLayers = [];

        foreach ($layers as $layer) {
            if ($remainingToConsume <= 0) break;

            $take = min($remainingToConsume, (float)$layer['remaining_quantity']);
            $layerCost = round($take * (float)$layer['unit_cost'], 2);

            $totalCogs += $layerCost;
            $consumedLayers[] = [
                'movement_id' => $layer['movement_id'],
                'movement_number' => $layer['movement_number'],
                'movement_date' => $layer['movement_date'],
                'type_label' => $layer['type_label'],
                'quantity_consumed' => $take,
                'unit_cost' => (float)$layer['unit_cost'],
                'sale_price' => $layer['sale_price'],
                'total_cost' => $layerCost,
            ];

            $remainingToConsume -= $take;
        }

        // If requirement exceeds recorded FIFO layers, fallback for the difference
        if ($remainingToConsume > 0) {
            $model = $type === 'material' ? Material::find($id) : Product::find($id);
            $fallbackUnitCost = $model ? (float)$model->unit_cost : 0.0;
            $fallbackCost = round($remainingToConsume * $fallbackUnitCost, 2);
            $totalCogs += $fallbackCost;

            $consumedLayers[] = [
                'movement_id' => null,
                'movement_number' => 'FALLBACK',
                'movement_date' => Carbon::now()->toDateString(),
                'type_label' => 'تكلفة معيارية حالية',
                'quantity_consumed' => $remainingToConsume,
                'unit_cost' => $fallbackUnitCost,
                'sale_price' => $type === 'product' && $model ? (float)$model->sale_price : null,
                'total_cost' => $fallbackCost,
            ];
        }

        $blendedUnitCost = $quantityRequired > 0 ? round($totalCogs / $quantityRequired, 2) : 0.0;

        return [
            'total_cogs' => round($totalCogs, 2),
            'blended_unit_cost' => $blendedUnitCost,
            'consumed_layers' => $consumedLayers,
        ];
    }
}

