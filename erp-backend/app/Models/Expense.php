<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
class Expense extends Model
{
    use HasFactory;

    protected $fillable = [
        'expense_number',
        'amount',
        'expense_date',
        'category',
        'description',
        'reference_number',
        'payment_method',
    ];
}
