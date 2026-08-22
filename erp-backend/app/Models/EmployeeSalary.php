<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class EmployeeSalary extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'employee_id',
        'type',             // 'salary' or 'advance'
        'product_id',
        'payment_date',
        'start_date',
        'end_date',
        'week_start',       // anchor for weekly payouts
        'base_salary',
        'production_quantity',
        'production_rate',
        'deductions',
        'deduction_reason',
        'net_salary',
        'payment_method',
        'receipt_path',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'payment_date' => 'date',
        'start_date' => 'date',
        'end_date' => 'date',
        'week_start' => 'date',
    ];

    protected $attributes = [
        'type' => 'salary', // backward-compatible default for new records
    ];

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
