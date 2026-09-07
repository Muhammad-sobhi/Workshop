<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductMaterial extends Model
{
    use HasFactory;

    protected $table = 'product_materials';

    protected $fillable = [
        'product_id',
        'material_id',
        'sub_product_id', // FK → products.id — set when this BOM line is a manufactured sub-product
        'quantity',
    ];

    protected $casts = [
        'quantity' => 'decimal:4',
    ];

    /**
     * True when this BOM line references a manufactured sub-product rather than a raw material.
     */
    public function isSubProduct(): bool
    {
        return !is_null($this->sub_product_id);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function material(): BelongsTo
    {
        return $this->belongsTo(Material::class);
    }

    /**
     * The manufactured sub-product used as a component in this BOM line.
     */
    public function subProduct(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'sub_product_id');
    }
}
