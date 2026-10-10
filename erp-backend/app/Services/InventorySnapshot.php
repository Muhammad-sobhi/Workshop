<?php

namespace App\Services;

use App\Models\InventoryMovement;
use App\Models\Material;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Read-only stock/cost figures for many items from one movements query.
 *
 * Each method gives the same result as its per-item counterpart:
 *  - calculateStock()  → Material/Product::calculateStock()
 *  - storedUnitCost()  → Material/Product::calculateStoredUnitCost()
 *  - liveStock()       → InventoryService::getStock()
 *
 * Quantities are summed in cents so totals equal the SQL decimal SUM() the per-item versions use.
 */
class InventorySnapshot
{
    private string $type;
    private string $modelClass;
    private Collection $movements;
    private ?bool $hasPivotTable = null;

    private function __construct(string $type, Collection $movements)
    {
        $this->type = $type;
        $this->modelClass = $type === 'material' ? Material::class : \App\Models\Product::class;
        $this->movements = $movements;
    }

    public static function for(string $type, $models): self
    {
        $col = $type === 'material' ? 'material_id' : 'product_id';
        $movements = InventoryMovement::whereIn($col, collect($models)->pluck('id'))
            ->orderBy('movement_date', 'asc')
            ->orderBy('id', 'asc')
            ->get(['id', $col, 'warehouse_id', 'movement_type', 'quantity', 'unit_cost'])
            ->groupBy($col);

        return new self($type, $movements);
    }

    private function movementsOf($model, ?int $warehouseId = null): Collection
    {
        $all = $this->movements->get($model->id, collect());
        return $warehouseId ? $all->where('warehouse_id', $warehouseId)->values() : $all;
    }

    /** Sum (in cents) of movements matching the given type lists, plus signed Stock_Adjustment rows. */
    private static function sumCents(Collection $movements, array $types, bool $positiveAdjustments): int
    {
        $cents = 0;
        foreach ($movements as $mv) {
            $qty = (float) $mv->quantity;
            $isAdjustment = $mv->movement_type === 'Stock_Adjustment'
                && ($positiveAdjustments ? $qty > 0 : $qty < 0);
            if ($isAdjustment || in_array($mv->movement_type, $types, true)) {
                $cents += (int) round($qty * 100);
            }
        }
        return $cents;
    }

    public function calculateStock($model): float
    {
        $class = $this->modelClass;
        $movements = $this->movementsOf($model);
        $incoming = self::sumCents($movements, $class::STOCK_INCOMING_TYPES, true) / 100;
        $outgoing = self::sumCents($movements, $class::STOCK_OUTGOING_TYPES, false) / 100;

        if ($movements->isNotEmpty()) {
            return $this->type === 'material'
                ? (float) ($incoming - $outgoing)
                : max(0.0, (float) ($incoming - $outgoing));
        }

        // Fallback 1: warehouse pivot table (same query as the model)
        $pivot = $this->type === 'material' ? 'warehouse_material' : 'warehouse_product';
        $this->hasPivotTable ??= Schema::hasTable($pivot);
        if ($this->hasPivotTable) {
            $query = DB::table($pivot)->where($this->type . '_id', $model->id);
            if ($query->exists()) {
                return (float) $query->sum('quantity');
            }
        }

        // Fallback 2: main stock_quantity column
        return (float) max(0, (float) $model->stock_quantity);
    }

    public function liveStock($model, ?int $warehouseId = null): float
    {
        $movements = $this->movementsOf($model, $warehouseId);
        $incoming = self::sumCents($movements, InventoryService::INCOMING_TYPES, true) / 100;
        $outgoing = self::sumCents($movements, InventoryService::OUTGOING_TYPES, false) / 100;

        if ($incoming > 0) {
            return max(0.0, round($incoming - $outgoing, 2));
        }

        $base = (float) ($model->stock_quantity ?? 0);
        // getStock() checks for movements in any warehouse here
        if ($this->movementsOf($model)->isEmpty()) {
            return max(0.0, $base);
        }

        return max(0.0, round($base - $outgoing, 2));
    }

    public function storedUnitCost($model): float
    {
        $movements = $this->movementsOf($model);
        $outgoing = self::sumCents($movements, InventoryService::OUTGOING_TYPES, false) / 100;
        $incomingMovements = $movements->filter(fn ($mv) => in_array($mv->movement_type, InventoryService::INCOMING_TYPES, true)
            || ($mv->movement_type === 'Stock_Adjustment' && (float) $mv->quantity > 0));

        // Remaining FIFO layers (same rules as InventoryService::getFifoLayers)
        $layersQty = 0;
        $layersCost = 0;
        if ($incomingMovements->isEmpty()) {
            $baseStock = (float) ($model->stock_quantity ?? 0);
            $netStock = max(0.0, round($baseStock - $outgoing, 2));
            if ($netStock > 0) {
                $layersQty += $netStock;
                $layersCost += round($netStock * (float) ($model->unit_cost ?? 0), 2);
            }
        } else {
            $remainingOutgoing = $outgoing;
            foreach ($incomingMovements as $mv) {
                $qty = (float) $mv->quantity;
                if ($remainingOutgoing >= $qty) {
                    $remainingOutgoing -= $qty;
                    continue;
                }
                $available = round($qty - $remainingOutgoing, 2);
                $remainingOutgoing = 0.0;
                if ($available > 0) {
                    $layersQty += $available;
                    $layersCost += round($available * (float) $mv->unit_cost, 2);
                }
            }
        }

        $layersQty = (float) $layersQty;
        $layersCost = (float) $layersCost;
        if ($layersQty > 0 && $layersCost > 0) {
            return round($layersCost / $layersQty, 2);
        }
        if ((float) $model->unit_cost > 0) {
            return (float) $model->unit_cost;
        }
        return 0.00;
    }
}
