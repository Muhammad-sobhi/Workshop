<?php

namespace App\Models;

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
}
