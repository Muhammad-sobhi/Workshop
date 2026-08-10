<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Supplier;
use App\Models\Material;
use App\Models\Expense;
use App\Models\PurchaseOrder;
use App\Models\ExternalServiceOrder;
use App\Models\ExternalServicePayment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Carbon;

class SupplierController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 20);
        if ($perPage <= 0 || $request->boolean('all')) {
            $perPage = 10000;
        }
        $suppliers = Supplier::withCount('purchaseOrders')
            ->with([
                'materials' => function ($q) {
                    $q->select('materials.id', 'materials.name', 'materials.unit', 'materials.code')
                        ->withPivot('price', 'notes');
                },
                'purchaseOrders' => function ($q) {
                    $q->where('status', 'Received')->select('id', 'supplier_id', 'order_number', 'total_amount', 'deposit_paid');
                }
            ])
            ->orderBy('name')
            ->paginate($perPage);

        $hasESOTable = Schema::hasTable('external_service_orders');
        $hasSupplierIdInExpenses = Schema::hasColumn('expenses', 'supplier_id');

        // Compute live outstanding debt for each supplier safely
        $suppliers->getCollection()->each(function ($supplier) use ($hasESOTable, $hasSupplierIdInExpenses) {
            try {
                // Total PO cost for received orders
                $totalPOCost = $supplier->purchaseOrders ? $supplier->purchaseOrders->sum(function ($po) {
                    return floatval($po->total_amount);
                }) : 0;

                // Total paid via deposits and partial payments on POs
                $totalDepositsOnPOs = $supplier->purchaseOrders ? $supplier->purchaseOrders->sum(function ($po) {
                    return floatval($po->deposit_paid ?? 0);
                }) : 0;

                // Total External Service Orders debt (total_cost - total_paid)
                $totalESODebt = 0;
                if ($hasESOTable) {
                    $totalESODebt = ExternalServiceOrder::where('supplier_id', $supplier->id)
                        ->where('status', '!=', 'cancelled')
                        ->get()
                        ->sum(function ($eso) {
                            return floatval($eso->balance);
                        });
                }

                // Total bulk settlements/expenses paid directly to supplier that are NOT already applied to POs/ESOs
                $totalUnallocatedExpenses = 0;
                if ($hasSupplierIdInExpenses) {
                    $totalBulkExpenses = Expense::where('supplier_id', $supplier->id)->sum('amount');
                    $totalUnallocatedExpenses = max(0, floatval($totalBulkExpenses) - $totalDepositsOnPOs);
                }

                // Remaining debt = (Total PO Cost - Total Paid on POs) + (ESO Debt) - (Unallocated Excess Payments)
                $outstanding = max(0, $totalPOCost - $totalDepositsOnPOs) + $totalESODebt - $totalUnallocatedExpenses;

                // Sync the debt_amount field so it matches real data (negative value = credit balance)
                if (abs(floatval($supplier->debt_amount) - $outstanding) > 0.001) {
                    $supplier->update(['debt_amount' => $outstanding]);
                }
                $supplier->debt_amount = $outstanding;
            } catch (\Throwable $th) {
                // Graceful fallback if any calculation fails for a supplier row
            }
        });

        return response()->json($suppliers);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'contact_person' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:30',
            'email' => 'nullable|email|max:255',
            'address' => 'nullable|string',
            'notes' => 'nullable|string',
            'debt_due_date' => 'nullable|date',
        ]);

        $validated['debt_amount'] = 0.00;

        $supplier = Supplier::create($validated);

        return response()->json(['message' => 'تم إضافة المورد بنجاح', 'supplier' => $supplier], 201);
    }

    public function show(string $id): JsonResponse
    {
        $supplier = Supplier::with([
            'materials' => function ($q) {
                $q->select('materials.id', 'materials.name', 'materials.unit', 'materials.code', 'materials.unit_cost')
                    ->withPivot('price', 'notes');
            },
            'purchaseOrders' => function ($q) {
                $q->orderBy('created_at', 'desc')->limit(10);
            }
        ])->findOrFail($id);

        return response()->json($supplier);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $supplier = Supplier::findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'contact_person' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:30',
            'email' => 'nullable|email|max:255',
            'address' => 'nullable|string',
            'notes' => 'nullable|string',
            'debt_due_date' => 'nullable|date',
        ]);

        $supplier->update($validated);

        return response()->json(['message' => 'تم تحديث بيانات المورد', 'supplier' => $supplier]);
    }

    public function destroy(string $id): JsonResponse
    {
        $supplier = Supplier::findOrFail($id);
        $supplier->delete();
        return response()->json(['message' => 'تم حذف المورد بنجاح']);
    }

    // GET /suppliers/{id}/materials — list materials of a specific supplier
    public function getMaterials(string $id): JsonResponse
    {
        $supplier = Supplier::findOrFail($id);
        $materials = $supplier->materials()
            ->select('materials.id', 'materials.name', 'materials.unit', 'materials.code', 'materials.unit_cost')
            ->withPivot('price', 'notes')
            ->get();

        return response()->json($materials);
    }

    // POST /suppliers/{id}/materials — add/update material link to supplier
    public function addMaterial(Request $request, string $id): JsonResponse
    {
        $supplier = Supplier::findOrFail($id);

        $validated = $request->validate([
            'material_id' => 'required|exists:materials,id',
            'price' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string',
        ]);

        $supplier->materials()->syncWithoutDetaching([
            $validated['material_id'] => [
                'price' => $validated['price'] ?? 0,
                'notes' => $validated['notes'] ?? null,
            ]
        ]);

        return response()->json(['message' => 'تم ربط المادة بالمورد بنجاح']);
    }

    // DELETE /suppliers/{id}/materials/{materialId}
    public function removeMaterial(string $id, string $materialId): JsonResponse
    {
        $supplier = Supplier::findOrFail($id);
        $supplier->materials()->detach($materialId);

        return response()->json(['message' => 'تم إلغاء ربط المادة من المورد']);
    }

    // GET /suppliers/all-with-materials — for purchase order form
    public function allWithMaterials(): JsonResponse
    {
        $suppliers = Supplier::with([
            'materials' => function ($q) {
                $q->select('materials.id', 'materials.name', 'materials.unit', 'materials.code')
                    ->withPivot('price');
            }
        ])->orderBy('name')->get();

        return response()->json($suppliers);
    }

    public function paySupplierDebt(Request $request, string $id): JsonResponse
    {
        $supplier = Supplier::findOrFail($id);

        $validated = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'payment_method' => 'required|string|in:cash,instapay,vodafone_cash,bank_transfer,postal_transfer',
            'payment_date' => 'required|date',
            'receipt' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:5120',
            'notes' => 'nullable|string',
        ]);

        $receiptPath = null;
        if ($request->hasFile('receipt')) {
            $path = $request->file('receipt')->store('receipts', 'public');
            $receiptPath = '/storage/' . $path;
        }

        return DB::transaction(function () use ($supplier, $validated, $receiptPath) {
            $paymentAmount = (float) $validated['amount'];
            $remainingPayment = $paymentAmount;

            // Get received purchase orders with outstanding debt for this supplier
            $orders = PurchaseOrder::where('supplier_id', $supplier->id)
                ->where('status', 'Received')
                ->get();

            $settledOrders = [];
            foreach ($orders as $order) {
                $debt = (float) $order->total_amount - (float) ($order->deposit_paid ?? 0.00);
                if ($debt <= 0) {
                    continue;
                }

                $apply = min($remainingPayment, $debt);
                $order->increment('deposit_paid', $apply);
                $remainingPayment -= $apply;
                $settledOrders[] = $order->order_number;

                if ($remainingPayment <= 0) {
                    break;
                }
            }

            // Note: In standard accounting, paying a supplier settles an Accounts Payable liability (Supplier Debt ↓, Cash ↓).
            // It is not an operating expense in P&L.
            return response()->json([
                'message' => 'تم تسجيل سداد الدين بنجاح وتحديث حساب المورد',
                'supplier' => $supplier,
            ]);
        });
    }

    public function getSupplierTransactions(string $id): JsonResponse
    {
        $supplier = Supplier::findOrFail($id);

        $expenses = Expense::where('supplier_id', $id)
            ->get()
            ->map(function ($e) {
                return [
                    'id' => 'exp-' . $e->id,
                    'type' => 'expense',
                    'number' => $e->expense_number,
                    'amount' => (float) $e->amount,
                    'date' => $e->expense_date,
                    'category' => $e->category,
                    'description' => $e->description,
                    'payment_method' => $e->payment_method,
                    'receipt_path' => $e->receipt_path,
                    'items_summary' => [],
                ];
            })->toArray();

        $deposits = [];
        $pos = PurchaseOrder::where('supplier_id', $id)
            ->with('items.material')
            ->get();

        foreach ($pos as $po) {
            $remaining = max(0, (float) $po->total_amount - (float) $po->deposit_paid);
            $itemsArr = $po->items->map(function ($i) {
                return [
                    'name' => $i->material->name ?? 'مادة خام',
                    'quantity' => (float) $i->quantity,
                    'unit' => $i->material->unit ?? 'وحدة',
                    'unit_cost' => (float) $i->unit_cost,
                    'total_cost' => (float) $i->total_cost,
                ];
            })->toArray();

            $itemsText = count($itemsArr) > 0
                ? implode(', ', array_map(fn($i) => "{$i['name']} ({$i['quantity']} {$i['unit']} × {$i['unit_cost']})", $itemsArr))
                : '';

            $poTotal = (float) $po->total_amount;

            // Add main purchase order header
            $deposits[] = [
                'id' => 'po-' . $po->id,
                'type' => 'purchase_order',
                'number' => $po->order_number,
                'amount' => $poTotal,
                'total_amount' => $poTotal,
                'remaining_debt' => $remaining,
                'date' => $po->order_date,
                'category' => 'أمر شراء / توريد',
                'description' => 'طلب شراء رقم ' . $po->order_number
                    . ($itemsText ? ' | المواد: ' . $itemsText : '')
                    . ' (إجمالي: ' . number_format($poTotal, 2) . ')'
                    . ($po->notes ? ' - ' . $po->notes : ''),
                'payment_method' => $po->payment_method ?? 'cash',
                'receipt_path' => null,
                'items_summary' => $itemsArr,
            ];

            // Subtract expenses matching this PO from deposit_paid to isolate the original initial deposit
            $poExpensesSum = array_reduce($expenses, function ($sum, $exp) use ($po) {
                if (isset($exp['description']) && str_contains($exp['description'], $po->order_number)) {
                    return $sum + (float) $exp['amount'];
                }
                return $sum;
            }, 0.0);

            $initialDeposit = max(0, floatval($po->deposit_paid) - $poExpensesSum);

            // Add deposit payment item if initial deposit was paid on PO
            if ($initialDeposit > 0) {
                $deposits[] = [
                    'id' => 'po-dep-' . $po->id,
                    'type' => 'deposit',
                    'number' => $po->order_number,
                    'amount' => $initialDeposit,
                    'total_amount' => $initialDeposit,
                    'date' => $po->order_date,
                    'category' => 'دفعة عربون / مقدم',
                    'description' => 'دفعة مقدمة (عربون) لأمر شراء (' . $po->order_number . ')',
                    'payment_method' => $po->payment_method ?? 'cash',
                    'receipt_path' => null,
                    'items_summary' => [],
                ];
            }
        }

        $esoOrders = [];
        if (Schema::hasTable('external_service_orders')) {
            $esoOrders = ExternalServiceOrder::where('supplier_id', $id)
                ->where('status', '!=', 'cancelled')
                ->get()
                ->map(function ($eso) {
                    return [
                        'id' => 'eso-' . $eso->id,
                        'type' => 'eso',
                        'number' => $eso->order_number,
                        'amount' => (float) $eso->total_cost,
                        'total_amount' => (float) $eso->total_cost,
                        'remaining_debt' => (float) $eso->balance,
                        'date' => $eso->sent_date ? $eso->sent_date->format('Y-m-d') : date('Y-m-d'),
                        'category' => 'أمر تشغيل خارجي',
                        'description' => 'أمر تشغيل خارجي رقم ' . $eso->order_number . ' | ' . $eso->item_description . ' (' . $eso->quantity . ' ' . $eso->unit . ' × ' . $eso->unit_cost . ' EGP)',
                        'payment_method' => 'instapay',
                        'receipt_path' => null,
                        'items_summary' => [],
                    ];
                })->toArray();
        }

        $esoPayments = [];
        if (Schema::hasTable('external_service_payments')) {
            $esoPayments = ExternalServicePayment::whereHas('order', function ($q) use ($id) {
                $q->where('supplier_id', $id);
            })
            ->with('order')
            ->get()
            ->map(function ($p) {
                return [
                    'id' => 'eso-pay-' . $p->id,
                    'type' => 'deposit',
                    'number' => $p->order->order_number ?? 'ESO',
                    'amount' => (float) $p->amount,
                    'date' => $p->payment_date ? $p->payment_date->format('Y-m-d') : $p->created_at->format('Y-m-d'),
                    'category' => 'تسديد دفعة خدمة خارجية',
                    'description' => 'دفعة مسددة لأمر التشغيل الخارجي (' . ($p->order->order_number ?? '') . ')' . ($p->notes ? ' - ' . $p->notes : ''),
                    'payment_method' => $p->payment_method ?? 'instapay',
                    'receipt_path' => $p->receipt_image_path,
                    'items_summary' => [],
                ];
            })->toArray();
        }

        $merged = array_merge($expenses, $deposits, $esoOrders, $esoPayments);
        usort($merged, function ($a, $b) {
            return strcmp($b['date'], $a['date']);
        });

        return response()->json($merged);
    }

    public function bulkImportSuppliers(Request $request): JsonResponse
    {
        $request->validate([
            'items' => 'required|array',
            'items.*.name' => 'required|string|max:255',
            'items.*.phone' => 'nullable|string|max:100',
            'items.*.email' => 'nullable|string|email|max:255',
            'items.*.company' => 'nullable|string|max:255',
            'items.*.debt_amount' => 'nullable|numeric|min:0',
        ]);

        return DB::transaction(function () use ($request) {
            $importedCount = 0;
            foreach ($request->input('items') as $item) {
                Supplier::create([
                    'name' => $item['name'],
                    'phone' => $item['phone'] ?? null,
                    'email' => $item['email'] ?? null,
                    'company' => $item['company'] ?? null,
                    'debt_amount' => $item['debt_amount'] ?? 0.00,
                ]);
                $importedCount++;
            }

            return response()->json(['message' => "تم استيراد {$importedCount} من الموردين بنجاح"]);
        });
    }

    public function settleBulkDebt(Request $request, $id): JsonResponse
    {
        $supplier = Supplier::findOrFail($id);

        $validated = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'payment_method' => 'required|string',
            'payment_date' => 'nullable|date',
            'transaction_reference' => 'nullable|string',
            'notes' => 'nullable|string',
        ]);

        $paymentAmount = floatval($validated['amount']);
        $remainingPool = $paymentAmount;
        $paymentDate = $validated['payment_date'] ?? date('Y-m-d');

        return DB::transaction(function () use ($supplier, $paymentAmount, &$remainingPool, $paymentDate, $validated, $request) {
            // 1. Settle open Purchase Orders first (FIFO by order_date)
            $pos = PurchaseOrder::where('supplier_id', $supplier->id)
                ->where('status', 'Received')
                ->get()
                ->filter(function ($po) {
                    return floatval($po->total_amount) > floatval($po->deposit_paid ?? 0);
                })
                ->sortBy('order_date');

            $settledOrders = [];
            foreach ($pos as $po) {
                if ($remainingPool <= 0)
                    break;
                $poDebt = floatval($po->total_amount) - floatval($po->deposit_paid ?? 0);
                $apply = min($remainingPool, $poDebt);
                $po->deposit_paid = floatval($po->deposit_paid ?? 0) + $apply;
                $po->save();
                $remainingPool -= $apply;
                $settledOrders[] = $po->order_number;
            }

            // 2. Settle open External Service Orders next (FIFO by sent_date)
            if ($remainingPool > 0 && Schema::hasTable('external_service_orders')) {
                $esos = ExternalServiceOrder::where('supplier_id', $supplier->id)
                    ->where('status', '!=', 'cancelled')
                    ->where('balance', '>', 0)
                    ->orderBy('sent_date', 'asc')
                    ->get();

                foreach ($esos as $eso) {
                    if ($remainingPool <= 0)
                        break;
                    $esoDebt = floatval($eso->balance);
                    $apply = min($remainingPool, $esoDebt);

                    ExternalServicePayment::create([
                        'external_service_order_id' => $eso->id,
                        'amount' => $apply,
                        'payment_method' => $validated['payment_method'],
                        'transaction_reference' => $validated['transaction_reference'] ?? null,
                        'payment_date' => $paymentDate,
                        'notes' => 'دفعة مجمعة لحساب المورد: ' . ($validated['notes'] ?? ''),
                    ]);

                    $eso->calculateBalance();
                    $remainingPool -= $apply;
                }
            }

            // Note: In standard accounting, bulk supplier payments settle liabilities (Accounts Payable ↓, Cash ↓). No operating Expense entry is logged.

            return response()->json([
                'message' => 'تم تسديد دفعة الحساب للمورد بنجاح وتحديث الرصيد التراكمي',
                'amount_paid' => $paymentAmount,
                'unallocated_credit' => max(0, $remainingPool),
            ]);
        });
    }

    public function deleteSupplierPayment(string $supplierId, string $expenseId): JsonResponse
    {
        $supplier = Supplier::findOrFail($supplierId);
        $expense = Expense::where('supplier_id', $supplier->id)->findOrFail($expenseId);

        return DB::transaction(function () use ($supplier, $expense) {
            $amount = (float) $expense->amount;

            // 1. If this expense was created for an External Service Order (ESO)
            $esoOrderNum = $expense->reference_number;
            if (empty($esoOrderNum) && preg_match('/(ESO-\d+-\d+)/i', $expense->description, $matches)) {
                $esoOrderNum = $matches[1];
            }

            if (!empty($esoOrderNum) && Schema::hasTable('external_service_orders')) {
                $eso = ExternalServiceOrder::where('supplier_id', $supplier->id)
                    ->where('order_number', $esoOrderNum)
                    ->first();

                if ($eso) {
                    // Delete matching payment on ESO
                    ExternalServicePayment::where('external_service_order_id', $eso->id)
                        ->where('amount', $amount)
                        ->latest()
                        ->first()?->delete();

                    $eso->calculateBalance();
                }
            }

            // 2. Reverse PO deposit_paid allocations (LIFO order)
            $pos = PurchaseOrder::where('supplier_id', $supplier->id)
                ->where('deposit_paid', '>', 0)
                ->orderBy('order_date', 'desc')
                ->get();

            $rem = $amount;
            foreach ($pos as $po) {
                if ($rem <= 0)
                    break;
                $dep = (float) $po->deposit_paid;
                $rev = min($rem, $dep);
                $po->deposit_paid = max(0, $dep - $rev);
                $po->save();
                $rem -= $rev;
            }

            // 3. Reverse any ESO bulk payments if remaining
            if ($rem > 0 && Schema::hasTable('external_service_orders')) {
                $esoPayments = ExternalServicePayment::whereHas('externalServiceOrder', function ($q) use ($supplier) {
                    $q->where('supplier_id', $supplier->id);
                })->latest()->get();

                foreach ($esoPayments as $esp) {
                    if ($rem <= 0)
                        break;
                    $pAmt = (float) $esp->amount;
                    $rev = min($rem, $pAmt);
                    if ($rev >= $pAmt) {
                        $espOrder = $esp->externalServiceOrder;
                        $esp->delete();
                        $espOrder->calculateBalance();
                    }
                    $rem -= $rev;
                }
            }

            // 4. Delete Expense
            $expense->delete();

            return response()->json([
                'message' => 'تم التراجع عن دفعة السداد وإلغاء القيد المالي بنجاح وتحديث مديونية المورد وأوامر التشغيل.'
            ]);
        });
    }
}
