<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Supplier extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'contact_person',
        'phone',
        'email',
        'address',
        'notes',
        'debt_amount',
        'debt_due_date',
    ];

    public function purchaseOrders(): HasMany
    {
        return $this->hasMany(PurchaseOrder::class);
    }

    public function externalServiceOrders(): HasMany
    {
        return $this->hasMany(ExternalServiceOrder::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(SupplierPayment::class);
    }

    public function materials(): BelongsToMany
    {
        return $this->belongsToMany(Material::class, 'supplier_materials')
            ->withPivot('price', 'notes')
            ->withTimestamps();
    }

    /**
     * Calculate and synchronize the exact live debt owed to this supplier.
     */
    public function recalculateDebt(): float
    {
        // 1. Purchase Orders remaining balance (excluding cancelled orders)
        $poDebt = (float) $this->purchaseOrders()
            ->whereNotIn('status', ['cancelled'])
            ->selectRaw('SUM(total_amount - COALESCE(deposit_paid, 0)) as remaining')
            ->value('remaining') ?? 0.0;

        // 2. External Service Orders remaining balance (excluding cancelled orders)
        $esoDebt = (float) $this->externalServiceOrders()
            ->whereNotIn('status', ['cancelled'])
            ->sum('balance');

        // 3. Direct unallocated supplier payments
        $directPayments = (float) $this->payments()
            ->whereNull('purchase_order_id')
            ->sum('amount');

        $finalDebt = max(0.0, round($poDebt + $esoDebt - $directPayments, 2));

        $this->update(['debt_amount' => $finalDebt]);

        return $finalDebt;
    }
}
