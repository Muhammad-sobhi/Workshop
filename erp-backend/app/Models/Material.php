<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
class Material extends Model
{
    use HasFactory;

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
            if ($material->isDirty('unit_cost')) {
                // Recalculate cost of all products that use this material
                $products = $material->products()->get();
                foreach ($products as $product) {
                    $product->recalculateCost();
                }
            }
        });
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
        if (!$warehouseId) {
            return (float) $this->stock_quantity;
        }

        $query = InventoryMovement::where('material_id', $this->id)->where('warehouse_id', $warehouseId);

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

        return $incoming - $outgoing;
    }
}
