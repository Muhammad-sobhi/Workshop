<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ClientPaymentAllocation extends Model
{
    protected $fillable = [
        'client_payment_id',
        'sales_invoice_id',
        'amount',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
    ];

    public function payment()
    {
        return $this->belongsTo(ClientPayment::class, 'client_payment_id');
    }

    public function salesInvoice()
    {
        return $this->belongsTo(SalesInvoice::class);
    }
}
