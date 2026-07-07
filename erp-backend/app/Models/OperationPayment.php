<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OperationPayment extends Model
{
    protected $fillable = [
        'operation_id',
        'amount_paid',
        'payment_date',
        'notes',
        'receipt_path',
        'payment_method',
    ];

    public function operation(): BelongsTo
    {
        return $this->belongsTo(Operation::class);
    }
}
