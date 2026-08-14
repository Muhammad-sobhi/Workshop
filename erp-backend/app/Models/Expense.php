<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Expense extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'expense_number',
        'amount',
        'expense_date',
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
        static::creating(function ($expense) {
            if (empty($expense->expense_number)) {
                $expense->expense_number = static::generateNextExpenseNumber();
            }
        });
    }

    public static function generateNextExpenseNumber(): string
    {
        $year = \Illuminate\Support\Carbon::now()->year;
        $prefix = "EXP-{$year}-";

        // Query raw DB table directly to bypass SoftDeletes and guarantee uniqueness
        $existing = \Illuminate\Support\Facades\DB::table('expenses')
            ->where('expense_number', 'LIKE', "{$prefix}%")
            ->pluck('expense_number')
            ->map(function ($num) use ($prefix) {
                $suffix = substr($num, strlen($prefix));
                return is_numeric($suffix) ? (int)$suffix : 0;
            });

        $nextSeq = ($existing->isNotEmpty() ? $existing->max() : 0) + 1;

        do {
            $expNo = $prefix . str_pad($nextSeq, 4, '0', STR_PAD_LEFT);
            $exists = \Illuminate\Support\Facades\DB::table('expenses')->where('expense_number', $expNo)->exists();
            if ($exists) {
                $nextSeq++;
            }
        } while ($exists);

        return $expNo;
    }

    public function client()
    {
        return $this->belongsTo(Client::class);
    }

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }
}
