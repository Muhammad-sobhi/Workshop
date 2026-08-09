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
