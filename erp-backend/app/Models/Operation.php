<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Operation extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'operation_number',
        'product_id',
        'quantity',
        'warehouse_id',
        'status', // Pending, In_Progress, Completed
        'start_date',
        'completion_date',
        'notes',
        'client_id',
        'deposit_paid',
        'deposit_payment_method',
        'use_stock',
        'total_price',
        'labor_cost', // accumulated employee labor cost from EmployeeProductionLog rows
    ];

    protected $casts = [
        'labor_cost' => 'decimal:2',
    ];

    protected static function booted()
    {
        static::creating(function ($operation) {
            if (empty($operation->operation_number)) {
                $operation->operation_number = static::generateNextOperationNumber();
            }
        });
    }

    public static function generateNextOperationNumber(): string
    {
        $year = \Illuminate\Support\Carbon::now()->year;
        $prefix = "OP-{$year}-";

        // Query raw DB table directly to bypass SoftDeletes and guarantee uniqueness
        $existing = \Illuminate\Support\Facades\DB::table('operations')
            ->where('operation_number', 'LIKE', "{$prefix}%")
            ->pluck('operation_number')
            ->map(function ($num) use ($prefix) {
                $suffix = substr($num, strlen($prefix));
                return is_numeric($suffix) ? (int)$suffix : 0;
            });

        $nextSeq = ($existing->isNotEmpty() ? $existing->max() : 0) + 1;

        do {
            $opNo = $prefix . str_pad($nextSeq, 4, '0', STR_PAD_LEFT);
            $exists = \Illuminate\Support\Facades\DB::table('operations')->where('operation_number', $opNo)->exists();
            if ($exists) {
                $nextSeq++;
            }
        } while ($exists);

        return $opNo;
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function operationProducts()
    {
        return $this->hasMany(OperationProduct::class);
    }

    public function externalServiceOrders()
    {
        return $this->hasMany(ExternalServiceOrder::class);
    }

    public function payments()
    {
        return $this->hasMany(OperationPayment::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }
}
