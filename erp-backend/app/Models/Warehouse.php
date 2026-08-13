<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Warehouse extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'code',
        'description',
        'address',
        'notes',
    ];

    public function movements(): HasMany
    {
        return $this->hasMany(InventoryMovement::class);
    }

    public static function rawMaterialsWarehouse(): ?self
    {
        return static::where('code', 'WSH-M')
            ->orWhere('name', 'like', '%المواد الخام%')
            ->orWhere('name', 'like', '%مواد خام%')
            ->orWhere('name', 'like', '%خام%')
            ->first() ?? static::first();
    }

    public static function productsWarehouse(): ?self
    {
        return static::where('code', 'WSH-P')
            ->orWhere('name', 'like', '%المنتجات%')
            ->orWhere('name', 'like', '%منتج%')
            ->first() ?? static::first();
    }

    public static function clientOrdersWarehouse(): ?self
    {
        return static::where('code', 'WH-FIN')
            ->orWhere('name', 'like', '%طلبيات%')
            ->orWhere('name', 'like', '%طلب%')
            ->first() ?? static::first();
    }
}
