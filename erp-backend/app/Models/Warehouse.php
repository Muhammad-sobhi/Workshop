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
        return static::where('code', 'WSH-M')->first()
            ?? static::where('code', 'WH-RAW')->first()
            ?? static::where('name', 'like', '%المواد الخام%')->first()
            ?? static::where('name', 'like', '%مواد خام%')->first()
            ?? static::where('name', 'like', '%خام%')->first()
            ?? static::first();
    }

    public static function productsWarehouse(): ?self
    {
        return static::where('code', 'WSH-P')->first() 
            ?? static::where('code', 'WH-PROD')->first()
            ?? static::where('name', 'like', '%المنتجات الجاهزة%')->first()
            ?? static::where('name', 'like', '%منتجات نهائية%')->first()
            ?? static::where('name', 'like', '%جاهزة%')->first()
            ?? static::first();
    }

    public static function clientOrdersWarehouse(): ?self
    {
        return static::where('code', 'WH-FIN')->first()
            ?? static::where('code', 'WH-ORDERS')->first()
            ?? static::where('name', 'like', '%طلبيات%')->first()
            ?? static::where('name', 'like', '%تسليم%')->first()
            ?? static::first();
    }
}
