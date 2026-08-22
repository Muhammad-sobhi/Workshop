<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class EmployeeAttendance extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'employee_id',
        'work_date',
        'status',           // present | absent | half_day | leave | holiday
        'daily_wage',       // wage ACCRUED for this day (snapshot)
        'penalty_amount',   // reduces the accrued wage
        'penalty_reason',
        'advance_amount',   // cash HANDED this day (settles debt)
        'advance_salary_id',
        'notes',
    ];

    protected $casts = [
        'work_date' => 'date',
        'daily_wage' => 'decimal:2',
        'penalty_amount' => 'decimal:2',
        'advance_amount' => 'decimal:2',
    ];

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function advance(): BelongsTo
    {
        return $this->belongsTo(EmployeeSalary::class, 'advance_salary_id');
    }

    public function ledgerEntries(): MorphMany
    {
        return $this->morphMany(EmployeeLedgerEntry::class, 'source');
    }
}
