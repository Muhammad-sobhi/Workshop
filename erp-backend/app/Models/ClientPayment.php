<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class ClientPayment extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'payment_number',
        'client_id',
        'amount',
        'payment_date',
        'payment_method',
        'operation_id',
        'sales_invoice_id',
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
        $prefix = "CPAY-{$year}-";

        $latest = DB::table('client_payments')
            ->where('payment_number', 'LIKE', "{$prefix}%")
            ->orderBy('id', 'desc')
            ->value('payment_number');

        $nextSeq = 1;
        if ($latest && preg_match('/CPAY-\d{4}-(\d+)/', $latest, $matches)) {
            $nextSeq = ((int)$matches[1]) + 1;
        }

        do {
            $num = $prefix . str_pad($nextSeq, 4, '0', STR_PAD_LEFT);
            $exists = DB::table('client_payments')->where('payment_number', $num)->exists();
            if ($exists) {
                $nextSeq++;
            }
        } while ($exists);

        return $num;
    }

    public function client()
    {
        return $this->belongsTo(Client::class);
    }

    public function operation()
    {
        return $this->belongsTo(Operation::class);
    }

    public function salesInvoice()
    {
        return $this->belongsTo(SalesInvoice::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
