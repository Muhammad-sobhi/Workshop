<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class SupplierPayment extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'payment_number',
        'supplier_id',
        'amount',
        'payment_date',
        'payment_method',
        'purchase_order_id',
        'external_service_order_id',
        'reference_number',
        'notes',
        'receipt_path',
        'created_by',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'payment_date' => 'date',
    ];

    protected static function booted()
    {
        static::creating(function ($payment) {
            if (empty($payment->payment_number)) {
                $payment->payment_number = static::generateNextNumber();
            }
        });
    }

    public static function generateNextNumber(): string
    {
        $year = Carbon::now()->year;
        $prefix = "SPAY-{$year}-";

        $latest = DB::table('supplier_payments')
            ->where('payment_number', 'LIKE', "{$prefix}%")
            ->orderBy('id', 'desc')
            ->value('payment_number');

        $nextSeq = 1;
        if ($latest && preg_match('/SPAY-\d{4}-(\d+)/', $latest, $matches)) {
            $nextSeq = ((int)$matches[1]) + 1;
        }

        do {
            $num = $prefix . str_pad($nextSeq, 4, '0', STR_PAD_LEFT);
            $exists = DB::table('supplier_payments')->where('payment_number', $num)->exists();
            if ($exists) {
                $nextSeq++;
            }
        } while ($exists);

        return $num;
    }

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function purchaseOrder()
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    public function externalServiceOrder()
    {
        return $this->belongsTo(ExternalServiceOrder::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
