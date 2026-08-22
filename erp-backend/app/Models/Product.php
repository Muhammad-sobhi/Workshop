<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

class Product extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'code',
        'sku',
        'unit',
        'unit_cost',
        'actual_labor_cost_cache',
        'stock_quantity',
        'sale_price',
        'category_id',
        'description',
        'image_path',
    ];

    protected $casts = [
        'actual_labor_cost_cache' => 'decimal:2',
    ];

    protected static function booted()
    {
        static::creating(function ($product) {
            if (empty($product->code)) {
                $product->code = 'PROD-' . rand(1000, 9999) . '-' . time();
            }
            if (empty($product->sku)) {
                $product->sku = 'SKU-' . $product->code;
            }
        });
    }

    public function recalculateCost()
    {
        $cost = 0;
        foreach ($this->materials()->get() as $material) {
            $cost += ((float) $material->unit_cost) * ((float) $material->pivot->quantity);
        }
        $this->unit_cost = $cost;
        $this->saveQuietly();
    }

    public function getCostPricingAnalysis(): array
    {
        $theoreticalCost = 0.0;
        $materials = $this->materials;
        foreach ($materials as $m) {
            $theoreticalCost += ((float) $m->unit_cost) * ((float) ($m->pivot->quantity ?? 1));
        }
        $theoreticalCost = round($theoreticalCost, 2);

        // 1. Check if there is finished product in stock (across showrooms/orders)
        $prodLayers = \App\Services\InventoryService::getFifoLayers('product', $this->id);
        if (!empty($prodLayers)) {
            $oldestLayer = $prodLayers[0];
            $activeCost = (float) $oldestLayer['unit_cost'];
            $activeUnits = (float) $oldestLayer['remaining_quantity'];
            $hasNext = abs($theoreticalCost - $activeCost) >= 0.50;

            return [
                'unit_cost' => $activeCost,
                'active_cost' => $activeCost,
                'theoretical_cost' => $theoreticalCost,
                'next_cost' => $hasNext ? $theoreticalCost : null,
                'has_next_cost' => $hasNext,
                'next_cost_diff' => $hasNext ? round($theoreticalCost - $activeCost, 2) : 0.0,
                'active_batch_quantity' => $activeUnits,
                'cost_source' => 'finished_goods_fifo',
            ];
        }

        // 2. No finished stock: Check if raw materials are in stock for 1 unit
        $hasRawStock = true;
        $activeRawCost = 0.0;
        $maxUnitsPossible = 999999;

        if ($materials->isEmpty()) {
            $hasRawStock = false;
        }

        foreach ($materials as $m) {
            $qtyNeededPerUnit = (float) ($m->pivot->quantity ?? 1);
            if ($qtyNeededPerUnit <= 0) continue;

            if ($m->type === 'service') {
                $activeRawCost += round($qtyNeededPerUnit * (float) $m->unit_cost, 2);
            } else {
                $matLayers = \App\Services\InventoryService::getFifoLayers('material', $m->id);
                if (empty($matLayers)) {
                    $hasRawStock = false;
                    $activeRawCost += round($qtyNeededPerUnit * (float) $m->unit_cost, 2);
                } else {
                    $oldestMatLayer = $matLayers[0];
                    $availQty = (float) $oldestMatLayer['remaining_quantity'];
                    $possibleUnits = floor($availQty / $qtyNeededPerUnit);
                    $maxUnitsPossible = min($maxUnitsPossible, $possibleUnits);

                    $activeRawCost += round($qtyNeededPerUnit * (float) $oldestMatLayer['unit_cost'], 2);
                }
            }
        }

        if ($hasRawStock && $maxUnitsPossible > 0) {
            $activeCost = round($activeRawCost, 2);
            $hasNext = abs($theoreticalCost - $activeCost) >= 0.50;

            return [
                'unit_cost' => $activeCost,
                'active_cost' => $activeCost,
                'theoretical_cost' => $theoreticalCost,
                'next_cost' => $hasNext ? $theoreticalCost : null,
                'has_next_cost' => $hasNext,
                'next_cost_diff' => $hasNext ? round($theoreticalCost - $activeCost, 2) : 0.0,
                'active_batch_quantity' => $maxUnitsPossible,
                'cost_source' => 'raw_materials_fifo',
            ];
        }

        // 3. Fallback: No stock and no raw materials -> theoretical cost is the current active cost
        return [
            'unit_cost' => $theoreticalCost,
            'active_cost' => $theoreticalCost,
            'theoretical_cost' => $theoreticalCost,
            'next_cost' => null,
            'has_next_cost' => false,
            'next_cost_diff' => 0.0,
            'active_batch_quantity' => 0,
            'cost_source' => 'master_bom',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(ProductCategory::class, 'category_id');
    }

    public function movements(): HasMany
    {
        return $this->hasMany(InventoryMovement::class);
    }

    public function bomItems(): HasMany
    {
        return $this->hasMany(ProductMaterial::class);
    }

    public function materials(): BelongsToMany
    {
        return $this->belongsToMany(Material::class, 'product_materials')
                    ->withPivot('quantity')
                    ->withTimestamps();
    }

    public function calculateStock($warehouseId = null)
    {
        $query = InventoryMovement::where('product_id', $this->id);
        if ($warehouseId) {
            $query->where('warehouse_id', $warehouseId);
        }

        $incomingTypes = ['Initial_Balance', 'Purchase_Receipt', 'Production_Receipt', 'Transfer_In'];
        $outgoingTypes = ['Production_Consumption', 'Sales_Issue', 'Supplier_Return', 'Damaged', 'Transfer_Out'];

        $incoming = (clone $query)->where(function($q) use ($incomingTypes) {
            $q->whereIn('movement_type', $incomingTypes)
              ->orWhere(function($sq) {
                  $sq->where('movement_type', 'Stock_Adjustment')->where('quantity', '>', 0);
              });
        })->sum('quantity');

        $outgoing = (clone $query)->where(function($q) use ($outgoingTypes) {
            $q->whereIn('movement_type', $outgoingTypes)
              ->orWhere(function($sq) {
                  $sq->where('movement_type', 'Stock_Adjustment')->where('quantity', '<', 0);
              });
        })->sum('quantity');

        $movementStock = (float) ($incoming - $outgoing);

        $hasMovements = (clone $query)->exists();
        if ($hasMovements) {
            return max(0.0, (float) ($incoming - $outgoing));
        }

        // Fallback 1: check warehouse_product pivot
        if (Schema::hasTable('warehouse_product')) {
            $wpQuery = DB::table('warehouse_product')->where('product_id', $this->id);
            if ($warehouseId) {
                $wpQuery->where('warehouse_id', $warehouseId);
            }
            if ($wpQuery->exists()) {
                return (float) $wpQuery->sum('quantity');
            }
        }

        // Fallback 2: check main stock_quantity column only if querying all warehouses
        if ($warehouseId === null) {
            return max(0, (float) $this->stock_quantity);
        }

        return 0.0;
    }

    public function calculateStoredUnitCost($warehouseId = null)
    {
        $layers = \App\Services\InventoryService::getFifoLayers('product', $this->id, $warehouseId);
        $totalRemainingQty = (float) collect($layers)->sum('remaining_quantity');
        $totalRemainingCost = (float) collect($layers)->sum('total_cost');

        if ($totalRemainingQty > 0 && $totalRemainingCost > 0) {
            return round($totalRemainingCost / $totalRemainingQty, 2);
        }

        if ((float) $this->unit_cost > 0) {
            return (float) $this->unit_cost;
        }

        if ((float) $this->sale_price > 0) {
            return (float) $this->sale_price;
        }

        return 0.00;
    }
}
