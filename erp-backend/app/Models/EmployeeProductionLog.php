<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class EmployeeProductionLog extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'employee_id',
        'work_date',
        'product_id',
        'operation_id',
        'labor_service_id',
        'quantity',
        'piece_rate',       // SNAPSHOT at save time
        'gross_wage',       // quantity × piece_rate (stored)
        'deductions',
        'deduction_reason',
        'net_wage',         // gross_wage − deductions (stored)
        'notes',
    ];

    protected $casts = [
        'work_date' => 'date',
        'quantity' => 'decimal:2',
        'piece_rate' => 'decimal:2',
        'gross_wage' => 'decimal:2',
        'deductions' => 'decimal:2',
        'net_wage' => 'decimal:2',
    ];

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function operation(): BelongsTo
    {
        return $this->belongsTo(Operation::class);
    }

    public function laborService(): BelongsTo
    {
        return $this->belongsTo(Material::class, 'labor_service_id');
    }

    public function ledgerEntries(): MorphMany
    {
        return $this->morphMany(EmployeeLedgerEntry::class, 'source');
    }
}
