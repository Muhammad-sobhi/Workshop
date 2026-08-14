<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ExternalServiceOrder extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'order_number',
        'supplier_id',
        'material_id',
        'product_id',
        'operation_id',
        'item_description',
        'quantity',
        'returned_quantity',
        'rejected_quantity',
        'unit',
        'unit_cost',
        'total_cost',
        'total_paid',
        'balance',
        'status',
        'sent_date',
        'expected_return_date',
        'notes',
    ];

    protected static function booted()
    {
        static::creating(function ($order) {
            if (empty($order->order_number)) {
                $order->order_number = static::generateNextOrderNumber();
            }
        });
    }

    public static function generateNextOrderNumber(): string
    {
        $year = \Illuminate\Support\Carbon::now()->year;
        $prefix = "ESO-{$year}-";

        $existing = \Illuminate\Support\Facades\DB::table('external_service_orders')
            ->where('order_number', 'LIKE', "{$prefix}%")
            ->pluck('order_number')
            ->map(function ($num) use ($prefix) {
                $suffix = substr($num, strlen($prefix));
                return is_numeric($suffix) ? (int)$suffix : 0;
            });

        $nextSeq = ($existing->isNotEmpty() ? $existing->max() : 0) + 1;

        do {
            $esoNo = $prefix . str_pad($nextSeq, 4, '0', STR_PAD_LEFT);
            $exists = \Illuminate\Support\Facades\DB::table('external_service_orders')->where('order_number', $esoNo)->exists();
            if ($exists) {
                $nextSeq++;
            }
        } while ($exists);

        return $esoNo;
    }

    protected $casts = [
        'quantity' => 'decimal:2',
        'returned_quantity' => 'decimal:2',
        'rejected_quantity' => 'decimal:2',
        'unit_cost' => 'decimal:2',
        'total_cost' => 'decimal:2',
        'total_paid' => 'decimal:2',
        'balance' => 'decimal:2',
        'sent_date' => 'date',
        'expected_return_date' => 'date',
    ];

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function material()
    {
        return $this->belongsTo(Material::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function operation()
    {
        return $this->belongsTo(Operation::class);
    }

    public function payments()
    {
        return $this->hasMany(ExternalServicePayment::class);
    }

    public function calculateBalance()
    {
        $this->total_paid = $this->payments()->sum('amount');
        $this->balance = $this->total_cost - $this->total_paid;
        $this->save();
    }
}
