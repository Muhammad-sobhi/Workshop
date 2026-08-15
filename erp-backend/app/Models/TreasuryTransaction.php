<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class TreasuryTransaction extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'transaction_number',
        'transaction_date',
        'type', // inflow | outflow
        'amount',
        'payment_method', // cash, instapay, vodafone_cash, bank_transfer, postal_transfer
        'category',
        'description',
        'source_type',
        'source_id',
        'reference_number',
        'receipt_path',
        'created_by',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'transaction_date' => 'date',
    ];

    protected static function booted()
    {
        static::creating(function ($trx) {
            if (empty($trx->transaction_number)) {
                $trx->transaction_number = static::generateNextNumber();
            }
        });
    }

    public static function generateNextNumber(): string
    {
        $year = Carbon::now()->year;
        $prefix = "TRX-{$year}-";

        $latest = DB::table('treasury_transactions')
            ->where('transaction_number', 'LIKE', "{$prefix}%")
            ->orderBy('id', 'desc')
            ->value('transaction_number');

        $nextSeq = 1;
        if ($latest && preg_match('/TRX-\d{4}-(\d+)/', $latest, $matches)) {
            $nextSeq = ((int)$matches[1]) + 1;
        }

        do {
            $num = $prefix . str_pad($nextSeq, 5, '0', STR_PAD_LEFT);
            $exists = DB::table('treasury_transactions')->where('transaction_number', $num)->exists();
            if ($exists) {
                $nextSeq++;
            }
        } while ($exists);

        return $num;
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
