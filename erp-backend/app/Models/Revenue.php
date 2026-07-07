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
        'revenue_date',
        'category',
        'description',
        'reference_number',
        'payment_method',
    ];
}
