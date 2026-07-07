<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
class Product extends Model
{
    use HasFactory;

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
        if (!$warehouseId) {
            return (float) $this->stock_quantity;
        }

        $query = InventoryMovement::where('product_id', $this->id)->where('warehouse_id', $warehouseId);

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
