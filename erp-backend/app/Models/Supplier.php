<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Log;

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
        'opening_balance',
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

    public function products(): BelongsToMany
    {
        return $this->belongsToMany(\App\Models\Product::class, 'supplier_products')
            ->withPivot('price', 'notes')
            ->withTimestamps();
    }

    /**
     * Calculate and synchronize the exact live debt owed to this supplier.
     */
    public function recalculateDebt(): float
    {
        try {
            // 1. Purchase Orders (Received = Positive Debt, Pending deposit = Negative Debt/Credit)
            $poDebt = 0.0;
            $pendingCredit = 0.0;
            if (Schema::hasTable('purchase_orders')) {
                // We owe supplier for received goods minus what was already paid as deposit
                $poDebt = (float) $this->purchaseOrders()
                    ->where('status', 'Received')
                    ->selectRaw('SUM(total_amount - COALESCE(deposit_paid, 0)) as remaining')
                    ->value('remaining') ?? 0.0;

                // Pending POs where we paid a deposit acts as a credit against the supplier
                $pendingCredit = (float) $this->purchaseOrders()
                    ->where('status', 'Pending')
                    ->selectRaw('SUM(COALESCE(deposit_paid, 0)) as credit')
                    ->value('credit') ?? 0.0;
            }

            // 2. External Service Orders remaining balance (excluding cancelled orders)
            $esoDebt = 0.0;
            if (Schema::hasTable('external_service_orders')) {
                $esoDebt = (float) $this->externalServiceOrders()
                    ->whereNotIn('status', ['cancelled', 'Cancelled'])
                    ->sum('balance');
            }

            // 3. Direct unallocated supplier payments
            $directPayments = 0.0;
            if (Schema::hasTable('supplier_payments')) {
                $directPayments = (float) $this->payments()
                    ->whereNull('purchase_order_id')
                    ->sum('amount');
            }

            // 4. Opening Balance
            $openingBalance = (float) ($this->opening_balance ?? 0.0);

            $finalDebt = round($poDebt + $esoDebt - $pendingCredit - $directPayments + $openingBalance, 2);
            \Log::info("Supplier {$this->id} Debt Calc: poDebt=$poDebt, esoDebt=$esoDebt, pendingCredit=$pendingCredit, directPayments=$directPayments, openingBalance=$openingBalance, final=$finalDebt");


            $this->update(['debt_amount' => $finalDebt]);

            return $finalDebt;
        } catch (\Throwable $e) {
            Log::warning("Supplier {$this->id} recalculateDebt error: " . $e->getMessage());
            return (float) ($this->debt_amount ?? 0.0);
        }
    }
}
