<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
class Operation extends Model
{
    use HasFactory;

    protected $fillable = [
        'operation_number',
        'product_id',
        'quantity',
        'warehouse_id',
        'status', // Pending, In_Progress, Completed
        'start_date',
        'completion_date',
        'notes',
        'client_id',
        'deposit_paid',
        'total_price',
    ];

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function operationProducts()
    {
        return $this->hasMany(OperationProduct::class);
    }

    public function payments()
    {
        return $this->hasMany(OperationPayment::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }
}
