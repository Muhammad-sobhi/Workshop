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
        'stock_quantity',
        'sale_price',
        'category_id',
        'description',
        'image_path',
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
