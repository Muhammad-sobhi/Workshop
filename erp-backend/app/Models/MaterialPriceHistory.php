<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MaterialPriceHistory extends Model
{
    use HasFactory;

    protected $fillable = [
        'material_id',
        'old_unit_cost',
        'new_unit_cost',
        'apply_to_material_stock',
        'apply_to_products_bom',
        'apply_future_only',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'old_unit_cost' => 'float',
        'new_unit_cost' => 'float',
        'apply_to_material_stock' => 'boolean',
        'apply_to_products_bom' => 'boolean',
        'apply_future_only' => 'boolean',
    ];

    public function material(): BelongsTo
    {
        return $this->belongsTo(Material::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
