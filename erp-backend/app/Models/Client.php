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
        'opening_balance',
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
            // 1. Auto-synchronize any unallocated client payments to open unpaid invoices (FIFO: oldest first)
            if (Schema::hasTable('client_payments') && Schema::hasTable('sales_invoices')) {
                $unallocatedPayments = $this->payments()
                    ->whereNull('operation_id')
                    ->whereNull('sales_invoice_id')
                    ->orderBy('payment_date', 'asc')
                    ->orderBy('id', 'asc')
                    ->get();

                foreach ($unallocatedPayments as $unallocPay) {
                    $unallocAmt = (float)$unallocPay->amount;
                    $openInvs = $this->salesInvoices()
                        ->where('remaining_amount', '>', 0)
                        ->orderBy('invoice_date', 'asc')
                        ->orderBy('id', 'asc')
                        ->get();

                    foreach ($openInvs as $openInv) {
                        if ($unallocAmt <= 0) break;
                        $alloc = min($unallocAmt, (float)$openInv->remaining_amount);
                        $openInv->paid_amount = (float)$openInv->paid_amount + $alloc;
                        $openInv->remaining_amount = max(0.0, (float)$openInv->total_amount - (float)$openInv->paid_amount);
                        $openInv->save();

                        if (!$unallocPay->sales_invoice_id) {
                            $unallocPay->sales_invoice_id = $openInv->id;
                            $unallocPay->save();
                        }
                        $unallocAmt -= $alloc;
                    }
                }
            }

            // 2. All Sales Invoices remaining balance (every invoice has its live remaining_amount)
            $invoiceDebt = 0.0;
            $invoicedOpIds = [];
            if (Schema::hasTable('sales_invoices')) {
                $invoiceDebt = (float) $this->salesInvoices()->sum('remaining_amount');
                $invoicedOpIds = $this->salesInvoices()->whereNotNull('operation_id')->pluck('operation_id')->toArray();
            }

            // 3. Uninvoiced Operations (Pending, Active, In_Progress, Completed without invoice)
            // Rule: No positive debt until Delivered (invoiced).
            // Any deposits or stage payments collected are a CREDIT (negative debt) owed to the client.
            $opCredit = 0.0;
            if (Schema::hasTable('operations')) {
                $uninvoicedOps = $this->operations()
                    ->whereNotIn('id', $invoicedOpIds)
                    ->whereNotIn('status', ['Cancelled', 'cancelled'])
                    ->with('payments')
                    ->get();

                foreach ($uninvoicedOps as $op) {
                    $depositPaid = (float) ($op->deposit_paid ?? 0);
                    $stagePaid = (float) ($op->payments ? $op->payments->sum('amount_paid') : 0);
                    $totalCollected = $depositPaid + $stagePaid;
                    $opCredit += $totalCollected;
                }
            }

            // 4. Direct general client payments that are still unassigned to any open invoice or operation
            $directPayments = 0.0;
            if (Schema::hasTable('client_payments')) {
                $directPayments = (float) $this->payments()
                    ->whereNull('operation_id')
                    ->whereNull('sales_invoice_id')
                    ->sum('amount');
            }

            // 5. Opening Balance (pre-system snapshot)
            $openingBalance = (float) ($this->opening_balance ?? 0.0);

            $finalDebt = round($invoiceDebt - $opCredit - $directPayments + $openingBalance, 2);

            $this->update(['debt_amount' => $finalDebt]);

            return $finalDebt;
        } catch (\Throwable $e) {
            Log::warning("Client {$this->id} recalculateDebt error: " . $e->getMessage());
            return (float) ($this->debt_amount ?? 0.0);
        }
    }
}

