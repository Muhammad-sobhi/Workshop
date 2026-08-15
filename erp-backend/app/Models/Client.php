<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Log;

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
        try {
            // 1. Invoices remaining balance (excluding invoices linked to operations to avoid double counting)
            $invoiceDebt = 0.0;
            if (Schema::hasTable('sales_invoices')) {
                $invoiceDebt = (float) $this->salesInvoices()
                    ->whereNull('operation_id')
                    ->sum('remaining_amount');
            }

            // 2. Production Orders remaining balance (excluding cancelled orders)
            $opDebt = 0.0;
            if (Schema::hasTable('operations')) {
                $ops = $this->operations()
                    ->whereNotIn('status', ['Cancelled', 'cancelled'])
                    ->with('payments')
                    ->get();

                foreach ($ops as $op) {
                    $totalOrderPrice = (float) ($op->total_price ?? 0);
                    $depositPaid = (float) ($op->deposit_paid ?? 0);
                    $stagePaid = (float) ($op->payments ? $op->payments->sum('amount_paid') : 0);
                    $remaining = max(0.0, $totalOrderPrice - ($depositPaid + $stagePaid));
                    $opDebt += $remaining;
                }
            }

            // 3. Direct client payments that are unassigned
            $directPayments = 0.0;
            if (Schema::hasTable('client_payments')) {
                $directPayments = (float) $this->payments()
                    ->whereNull('operation_id')
                    ->whereNull('sales_invoice_id')
                    ->sum('amount');
            }

            $finalDebt = round($invoiceDebt + $opDebt - $directPayments, 2);

            $this->update(['debt_amount' => $finalDebt]);

            return $finalDebt;
        } catch (\Throwable $e) {
            Log::warning("Client {$this->id} recalculateDebt error: " . $e->getMessage());
            return (float) ($this->debt_amount ?? 0.0);
        }
    }
}
