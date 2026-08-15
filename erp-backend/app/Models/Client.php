<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Client extends Model
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

    public function salesInvoices(): HasMany
    {
        return $this->hasMany(SalesInvoice::class);
    }

    public function operations(): HasMany
    {
        return $this->hasMany(Operation::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(ClientPayment::class);
    }

    /**
     * Calculate and synchronize the exact live debt of this client.
     */
    public function recalculateDebt(): float
    {
        // 1. Invoices remaining balance (excluding invoices linked to operations to avoid double counting)
        $invoiceDebt = (float) $this->salesInvoices()
            ->whereNull('operation_id')
            ->sum('remaining_amount');

        // 2. Production Orders remaining balance (excluding cancelled orders)
        $ops = $this->operations()
            ->whereNotIn('status', ['Cancelled'])
            ->with('payments')
            ->get();

        $opDebt = 0.0;
        foreach ($ops as $op) {
            $totalOrderPrice = (float) ($op->total_price ?? 0);
            $depositPaid = (float) ($op->deposit_paid ?? 0);
            $stagePaid = (float) ($op->payments ? $op->payments->sum('amount_paid') : 0);
            $remaining = max(0.0, $totalOrderPrice - ($depositPaid + $stagePaid));
            $opDebt += $remaining;
        }

        // 3. Direct client payments that are unassigned
        $directPayments = (float) $this->payments()
            ->whereNull('operation_id')
            ->whereNull('sales_invoice_id')
            ->sum('amount');

        $finalDebt = max(0.0, round($invoiceDebt + $opDebt - $directPayments, 2));

        $this->update(['debt_amount' => $finalDebt]);

        return $finalDebt;
    }
}
