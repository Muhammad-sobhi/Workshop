<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryMovement extends Model
{
    use HasFactory;

    protected $fillable = [
        'movement_number',
        'movement_date',
        'warehouse_id',
        'material_id',
        'product_id',
        'movement_type', // Purchase_Receipt, Production_Consumption, Stock_Adjustment, Supplier_Return, Transfer, Damaged, Initial_Balance
        'quantity',
        'unit_cost',
        'total_cost',
        'reference_number',
        'notes',
        'created_by',
    ];

    public static function generateMovementNumber(): string
    {
        do {
            $maxId = static::max('id') ?? 0;
            $candidate = 'MV-' . str_pad($maxId + rand(1, 9999), 6, '0', STR_PAD_LEFT);
        } while (static::where('movement_number', $candidate)->exists());

        return $candidate;
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function material(): BelongsTo
    {
        return $this->belongsTo(Material::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
