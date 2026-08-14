<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Revenue extends Model
{
    use HasFactory;

    protected $fillable = [
        'revenue_number',
        'amount',
        'cogs',
        'revenue_date',
        'category',
        'description',
        'reference_number',
        'payment_method',
        'client_id',
        'supplier_id',
        'receipt_path',
    ];

    protected static function booted()
    {
        static::creating(function ($revenue) {
            if (empty($revenue->revenue_number)) {
                $revenue->revenue_number = static::generateNextRevenueNumber();
            }
        });
    }

    public static function generateNextRevenueNumber(string $prefixType = 'REV'): string
    {
        $year = \Illuminate\Support\Carbon::now()->year;
        $prefix = "{$prefixType}-{$year}-";

        $existing = \Illuminate\Support\Facades\DB::table('revenues')
            ->where('revenue_number', 'LIKE', "{$prefix}%")
            ->pluck('revenue_number')
            ->map(function ($num) use ($prefix) {
                $suffix = substr($num, strlen($prefix));
                return is_numeric($suffix) ? (int)$suffix : 0;
            });

        $nextSeq = ($existing->isNotEmpty() ? $existing->max() : 0) + 1;

        do {
            $revNo = $prefix . str_pad($nextSeq, 4, '0', STR_PAD_LEFT);
            $exists = \Illuminate\Support\Facades\DB::table('revenues')->where('revenue_number', $revNo)->exists();
            if ($exists) {
                $nextSeq++;
            }
        } while ($exists);

        return $revNo;
    }

    protected $casts = [
        'amount' => 'float',
        'cogs' => 'float',
    ];

    public function client()
    {
        return $this->belongsTo(Client::class);
    }

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }
}
