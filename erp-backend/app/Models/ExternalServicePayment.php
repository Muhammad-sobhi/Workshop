<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ExternalServicePayment extends Model
{
    use HasFactory;

    protected $fillable = [
        'external_service_order_id',
        'amount',
        'payment_method',
        'transaction_reference',
        'receipt_image_path',
        'payment_date',
        'notes',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'payment_date' => 'date',
    ];

    public function order()
    {
        return $this->belongsTo(ExternalServiceOrder::class, 'external_service_order_id');
    }
}
