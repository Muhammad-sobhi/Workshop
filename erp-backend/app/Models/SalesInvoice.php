<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class SalesInvoice extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'invoice_number',
        'invoice_date',
        'client_id',
        'invoice_type', // direct_sale, order_delivery, historical_opening
        'total_amount',
        'total_cogs',
        'paid_amount',
        'remaining_amount',
        'payment_method',
        'operation_id',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'total_amount' => 'decimal:2',
        'total_cogs' => 'decimal:2',
        'paid_amount' => 'decimal:2',
        'remaining_amount' => 'decimal:2',
        'invoice_date' => 'date',
    ];

    protected static function booted()
    {
        static::creating(function ($inv) {
            if (empty($inv->invoice_number)) {
                $inv->invoice_number = static::generateNextInvoiceNumber();
            }
        });
    }

    public static function generateNextInvoiceNumber(string $typePrefix = 'INV'): string
    {
        $year = Carbon::now()->year;
        $prefix = "{$typePrefix}-{$year}-";

        $latest = DB::table('sales_invoices')
            ->where('invoice_number', 'LIKE', "{$prefix}%")
            ->orderBy('id', 'desc')
            ->value('invoice_number');

        $nextSeq = 1;
        if ($latest && preg_match('/' . preg_quote($typePrefix, '/') . '-\d{4}-(\d+)/', $latest, $matches)) {
            $nextSeq = ((int) $matches[1]) + 1;
        }

        do {
            $num = $prefix . str_pad($nextSeq, 4, '0', STR_PAD_LEFT);
            $exists = DB::table('sales_invoices')->where('invoice_number', $num)->exists();
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

    public function items()
    {
        return $this->hasMany(SalesInvoiceItem::class);
    }

    public function operation()
    {
        return $this->belongsTo(Operation::class);
    }

    public function payments()
    {
        return $this->hasMany(ClientPayment::class, 'sales_invoice_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}

