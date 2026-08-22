<?php

namespace App\Models;

use App\Services\EmployeeLedgerService;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Employee extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'phone',
        'salary_cycle',
        'rate',
        'status',
        'notes',
        'created_by',
    ];

    public function salaries(): HasMany
    {
        return $this->hasMany(EmployeeSalary::class);
    }

    public function attendances(): HasMany
    {
        return $this->hasMany(EmployeeAttendance::class);
    }

    public function productionLogs(): HasMany
    {
        return $this->hasMany(EmployeeProductionLog::class);
    }

    public function ledgerEntries(): HasMany
    {
        return $this->hasMany(EmployeeLedgerEntry::class);
    }

    // Outstanding balance the workshop owes the employee (live, single employee lookup only).
    // NOTE: For bulk listings or stats, NEVER call this in a loop; use EmployeeLedgerService
    // grouped queries instead to prevent N+1 queries.
    public function outstandingBalance(): float
    {
        return EmployeeLedgerService::outstandingBalance($this->id);
    }
}
