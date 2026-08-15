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

class Material extends Model
{
    use HasFactory, SoftDeletes;

    public bool $skipBomRecalculation = false;

    protected $fillable = [
        'name',
        'code',
        'sku',
        'unit',
        'unit_cost',
        'stock_quantity',
        'category_id',
        'description',
        'dimension',
        'type',
        'low_stock_limit',
        'service_location',
    ];

    protected static function booted()
    {
        static::creating(function ($material) {
            if (empty($material->code)) {
                $material->code = 'MAT-' . rand(1000, 9999) . '-' . time();
            }
            if (empty($material->sku)) {
                $material->sku = 'SKU-' . $material->code;
            }
        });

        static::updated(function ($material) {
            if ($material->isDirty('unit_cost') && !$material->skipBomRecalculation) {
                // Recalculate cost of all products that use this material
                $products = $material->products()->get();
                foreach ($products as $product) {
                    $product->recalculateCost();
                }
            }
        });
    }

    public function priceHistories(): HasMany
    {
        return $this->hasMany(MaterialPriceHistory::class)->orderBy('created_at', 'desc');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(MaterialCategory::class, 'category_id');
    }

    public function movements(): HasMany
    {
        return $this->hasMany(InventoryMovement::class);
    }

    public function suppliers(): BelongsToMany
    {
        return $this->belongsToMany(Supplier::class, 'supplier_materials')
            ->withPivot('price', 'notes')
            ->withTimestamps();
    }

    public function products(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'product_materials')
                    ->withPivot('quantity')
                    ->withTimestamps();
    }

    public function calculateStock($warehouseId = null)
    {
        $query = InventoryMovement::where('material_id', $this->id);
        if ($warehouseId) {
            $query->where('warehouse_id', $warehouseId);
        }

        $incomingTypes = ['Initial_Balance', 'Purchase_Receipt', 'Transfer_In'];
        $outgoingTypes = ['Production_Consumption', 'Supplier_Return', 'Damaged', 'Transfer_Out'];

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
            return (float) ($incoming - $outgoing);
        }

        // Fallback 1: check warehouse_material pivot
        if (Schema::hasTable('warehouse_material')) {
            $wmQuery = DB::table('warehouse_material')->where('material_id', $this->id);
            if ($warehouseId) {
                $wmQuery->where('warehouse_id', $warehouseId);
            }
            if ($wmQuery->exists()) {
                return (float) $wmQuery->sum('quantity');
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
        $layers = \App\Services\InventoryService::getFifoLayers('material', $this->id, $warehouseId);
        $totalRemainingQty = (float) collect($layers)->sum('remaining_quantity');
        $totalRemainingCost = (float) collect($layers)->sum('total_cost');

        if ($totalRemainingQty > 0 && $totalRemainingCost > 0) {
            return round($totalRemainingCost / $totalRemainingQty, 2);
        }

        if ((float) $this->unit_cost > 0) {
            return (float) $this->unit_cost;
        }

        return 0.00;
    }
}
