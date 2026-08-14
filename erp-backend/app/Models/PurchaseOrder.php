<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class PurchaseOrder extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'order_number',
        'supplier_id',
        'status', // Pending, Approved, Received
        'order_date',
        'total_amount',
        'deposit_paid',
        'payment_method',
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
        $prefix = "PO-{$year}-";

        // Query raw DB table directly to bypass SoftDeletes and guarantee uniqueness
        $existing = \Illuminate\Support\Facades\DB::table('purchase_orders')
            ->where('order_number', 'LIKE', "{$prefix}%")
            ->pluck('order_number')
            ->map(function ($num) use ($prefix) {
                $suffix = substr($num, strlen($prefix));
                return is_numeric($suffix) ? (int)$suffix : 0;
            });

        $nextSeq = ($existing->isNotEmpty() ? $existing->max() : 0) + 1;

        do {
            $poNo = $prefix . str_pad($nextSeq, 4, '0', STR_PAD_LEFT);
            $exists = \Illuminate\Support\Facades\DB::table('purchase_orders')->where('order_number', $poNo)->exists();
            if ($exists) {
                $nextSeq++;
            }
        } while ($exists);

        return $poNo;
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(PurchaseOrderItem::class);
    }
}
