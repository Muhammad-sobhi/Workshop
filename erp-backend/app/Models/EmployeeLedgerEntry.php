<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class EmployeeLedgerEntry extends Model
{
    use HasFactory, SoftDeletes;

    public const TYPE_CREDIT = 'credit'; // labor accrued (+debt owed to employee)
    public const TYPE_DEBIT = 'debit';   // cash paid out (−debt owed to employee)

    protected $fillable = [
        'employee_id',
        'entry_date',
        'type',
        'amount',
        'description',
        'source_type',
        'source_id',
        'created_by',
    ];

    protected $casts = [
        'entry_date' => 'date',
        'amount' => 'decimal:2',
    ];

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function source(): MorphTo
    {
        return $this->morphTo();
    }

    public function scopeCredits($query)
    {
        return $query->where('type', self::TYPE_CREDIT);
    }

    public function scopeDebits($query)
    {
        return $query->where('type', self::TYPE_DEBIT);
    }
}
