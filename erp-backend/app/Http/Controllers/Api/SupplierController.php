<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Supplier;
use App\Models\Material;
use App\Models\SupplierPayment;
use App\Models\PurchaseOrder;
use App\Models\ExternalServiceOrder;
use App\Services\TreasuryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

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
                    $q->select('materials.id', 'materials.name', 'materials.unit', 'materials.code', 'materials.unit_cost')
                        ->withPivot('price', 'notes');
                }
            ])
            ->orderBy('name')
            ->paginate($perPage);

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
            'debt_amount' => 'nullable|numeric',
        ]);

        $validated['debt_amount'] = $validated['debt_amount'] ?? 0.00;
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
            'debt_amount' => 'nullable|numeric',
        ]);

        $supplier->update($validated);

        return response()->json(['message' => 'تم تحديث بيانات المورد', 'supplier' => $supplier]);
    }

    public function destroy(string $id): JsonResponse
    {
        $supplier = Supplier::findOrFail($id);
        $supplier->forceDelete();

        return response()->json(['message' => 'تم حذف المورد بنجاح']);
    }

    public function getMaterials(string $id): JsonResponse
    {
        $supplier = Supplier::findOrFail($id);
        $materials = $supplier->materials()
            ->select('materials.id', 'materials.name', 'materials.unit', 'materials.code', 'materials.unit_cost')
            ->withPivot('price', 'notes')
            ->get();

        return response()->json($materials);
    }

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

    public function removeMaterial(string $id, string $materialId): JsonResponse
    {
        $supplier = Supplier::findOrFail($id);
        $supplier->materials()->detach($materialId);

        return response()->json(['message' => 'تم إلغاء ربط المادة من المورد']);
    }

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

        $paymentAmount = (float) $validated['amount'];

        // Protection against rapid duplicate submissions (e.g. double click)
        if (Schema::hasTable('supplier_payments')) {
            $recentDup = SupplierPayment::where('supplier_id', $supplier->id)
                ->where('amount', $paymentAmount)
                ->where('created_at', '>=', now()->subSeconds(4))
                ->first();
            if ($recentDup) {
                return response()->json([
                    'message' => 'تم تسجيل سداد الدفعة للمورد بنجاح وتحديث الخزينة وحساب المورد.',
                    'payment' => $recentDup,
                    'supplier' => $supplier->fresh(),
                ]);
            }
        }

        return DB::transaction(function () use ($supplier, $validated, $request, $paymentAmount) {
            $user = auth()->id();
            $receiptPath = null;
            if ($request->hasFile('receipt')) {
                $path = $request->file('receipt')->store('receipts', 'public');
                $receiptPath = '/storage/' . $path;
            }

            // 1. Create SupplierPayment record
            $payment = SupplierPayment::create([
                'supplier_id' => $supplier->id,
                'amount' => $paymentAmount,
                'payment_date' => $validated['payment_date'],
                'payment_method' => $validated['payment_method'],
                'notes' => $validated['notes'] ?? 'سداد دفعة لحساب المورد',
                'receipt_path' => $receiptPath,
                'created_by' => $user,
            ]);

            // 2. Recalculate supplier debt
            $supplier->recalculateDebt();

            // 3. Record Treasury Outflow
            TreasuryService::recordOutflow(
                amount: $paymentAmount,
                paymentMethod: $validated['payment_method'],
                category: 'تسديد ديون موردين',
                description: "سداد دفعة حساب للمورد ({$supplier->name})" . (!empty($validated['notes']) ? " - {$validated['notes']}" : ''),
                sourceType: SupplierPayment::class,
                sourceId: $payment->id,
                referenceNumber: $payment->payment_number,
                transactionDate: $validated['payment_date'],
                receiptPath: $receiptPath,
                userId: $user
            );

            return response()->json([
                'message' => 'تم تسجيل سداد الدفعة للمورد بنجاح وتحديث الخزينة وحساب المورد.',
                'payment' => $payment,
                'supplier' => $supplier->fresh(),
            ]);
        });
    }

    public function deleteSupplierPayment(string $supplierId, string $paymentId): JsonResponse
    {
        $cleanId = str_replace(['pay-', 'exp-'], '', $paymentId);
        $supplier = Supplier::findOrFail($supplierId);

        $payment = null;
        if (Schema::hasTable('supplier_payments')) {
            $payment = SupplierPayment::where('supplier_id', $supplier->id)->find($cleanId);
        }

        if (!$payment) {
            // Also check Expense table if it was recorded as a legacy expense
            if (Schema::hasTable('expenses')) {
                $expense = \App\Models\Expense::where('supplier_id', $supplier->id)->find($cleanId);
                if ($expense) {
                    return DB::transaction(function () use ($supplier, $expense) {
                        TreasuryService::revertBySource(\App\Models\Expense::class, $expense->id);
                        $expense->delete();
                        $supplier->recalculateDebt();
                        return response()->json(['message' => 'تم التراجع عن دفعة السداد وإلغاء القيد المالي بالخزينة بنجاح.']);
                    });
                }
            }
            return response()->json(['message' => 'لم يتم العثور على حركة السداد المطلوب حذفها.'], 404);
        }

        return DB::transaction(function () use ($supplier, $payment) {
            // Revert Treasury Outflow
            TreasuryService::revertBySource(SupplierPayment::class, $payment->id);

            $payment->delete();

            // Recalculate live supplier debt
            $supplier->recalculateDebt();

            return response()->json(['message' => 'تم التراجع عن دفعة السداد وإلغاء القيد المالي بالخزينة بنجاح.']);
        });
    }

    public function getSupplierTransactions(string $id): JsonResponse
    {
        $supplier = Supplier::findOrFail($id);

        // 1. Direct Supplier Payments
        $payments = [];
        if (Schema::hasTable('supplier_payments')) {
            try {
                $payments = SupplierPayment::where('supplier_id', $id)->get()->map(function ($p) {
                    $dStr = $p->payment_date instanceof \DateTimeInterface ? $p->payment_date->format('Y-m-d') : substr((string) $p->payment_date, 0, 10);
                    $isDeposit = (bool)$p->purchase_order_id;
                    $poParent = $p->purchase_order_id ? 'po-' . $p->purchase_order_id : null;
                    return [
                        'id' => 'pay-' . $p->id,
                        'type' => $isDeposit ? 'deposit' : 'payment',
                        'is_payment' => true,
                        'is_deposit' => $isDeposit,
                        'parent_id' => $poParent,
                        'purchase_order_id' => $poParent,
                        'number' => $p->payment_number,
                        'amount' => (float) $p->amount,
                        'total_amount' => (float) $p->amount,
                        'date' => $dStr ?: date('Y-m-d'),
                        'created_at' => $p->created_at ? $p->created_at->toIso8601String() : $dStr,
                        'category' => $isDeposit ? 'دفعة عربون / مقدم' : 'سداد دفعة للمورد',
                        'description' => $p->notes ?: 'سداد دفعة نقدية',
                        'payment_method' => $p->payment_method,
                        'receipt_path' => $p->receipt_path,
                        'items_summary' => [],
                    ];
                })->toArray();
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning("Error fetching supplier payments for {$id}: " . $e->getMessage());
            }
        }

        // 2. Purchase Orders
        $pos = [];
        if (Schema::hasTable('purchase_orders')) {
            try {
                $pos = PurchaseOrder::where('supplier_id', $id)->with('items.material')->get()->map(function ($po) {
                    $dStr = $po->order_date instanceof \DateTimeInterface ? $po->order_date->format('Y-m-d') : substr((string) $po->order_date, 0, 10);
                    return [
                        'id' => 'po-' . $po->id,
                        'type' => 'purchase_order',
                        'is_payment' => false,
                        'is_deposit' => false,
                        'number' => $po->order_number,
                        'amount' => (float) $po->total_amount,
                        'total_amount' => (float) $po->total_amount,
                        'deposit_paid' => (float) ($po->deposit_paid ?? 0),
                        'date' => $dStr ?: date('Y-m-d'),
                        'created_at' => $po->created_at ? $po->created_at->toIso8601String() : $dStr,
                        'category' => 'أمر شراء مواد خام',
                        'description' => "طلب شراء رقم {$po->order_number} - الحالة: {$po->status}",
                        'payment_method' => $po->payment_method ?? 'cash',
                        'items_summary' => $po->items->map(fn($i) => [
                            'name' => $i->material->name ?? 'مادة خام',
                            'quantity' => (float) $i->quantity,
                            'unit' => $i->material->unit ?? 'وحدة',
                            'unit_cost' => (float) $i->unit_cost,
                            'total_cost' => (float) $i->total_cost,
                        ]),
                    ];
                })->toArray();
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning("Error fetching purchase orders for {$id}: " . $e->getMessage());
            }
        }

        // 3. External Service Orders and their Payments
        $esoPayments = [];
        $esos = [];
        if (Schema::hasTable('external_service_orders')) {
            try {
                $esos = ExternalServiceOrder::where('supplier_id', $id)->with('payments')->get()->map(function ($eso) use (&$esoPayments) {
                    $dStr = $eso->sent_date instanceof \DateTimeInterface ? $eso->sent_date->format('Y-m-d') : substr((string) $eso->sent_date, 0, 10);
                    $hasPayments = false;

                    // Collect child payments for this ESO
                    if ($eso->payments && $eso->payments->count() > 0) {
                        foreach ($eso->payments as $ep) {
                            $hasPayments = true;
                            $epDate = $ep->payment_date instanceof \DateTimeInterface ? $ep->payment_date->format('Y-m-d') : substr((string) $ep->payment_date, 0, 10);
                            $esoPayments[] = [
                                'id' => 'eso-pay-' . $ep->id,
                                'type' => 'payment',
                                'is_payment' => true,
                                'is_deposit' => true,
                                'parent_id' => 'eso-' . $eso->id,
                                'external_service_order_id' => 'eso-' . $eso->id,
                                'number' => $eso->order_number,
                                'amount' => (float) $ep->amount,
                                'total_amount' => (float) $ep->amount,
                                'date' => $epDate ?: date('Y-m-d'),
                                'created_at' => $ep->created_at ? $ep->created_at->toIso8601String() : ($eso->created_at ? $eso->created_at->toIso8601String() : $dStr),
                                'category' => 'سداد أمر تشغيل خارجي',
                                'description' => "سداد لأمر تشغيل خارجي ({$eso->order_number})",
                                'payment_method' => $ep->payment_method ?: 'cash',
                                'receipt_path' => $ep->receipt_image_path,
                                'items_summary' => [],
                            ];
                        }
                    }

                    // If ESO has recorded total_paid but no rows in ESO payments table
                    if (!$hasPayments && (float)$eso->total_paid > 0) {
                        $esoPayments[] = [
                            'id' => 'eso-dep-' . $eso->id,
                            'type' => 'payment',
                            'is_payment' => true,
                            'is_deposit' => true,
                            'parent_id' => 'eso-' . $eso->id,
                            'external_service_order_id' => 'eso-' . $eso->id,
                            'number' => $eso->order_number,
                            'amount' => (float) $eso->total_paid,
                            'total_amount' => (float) $eso->total_paid,
                            'date' => $dStr ?: date('Y-m-d'),
                            'created_at' => $eso->created_at ? $eso->created_at->toIso8601String() : $dStr,
                            'category' => 'دفعة مسددة لأمر تشغيل',
                            'description' => "دفعة مسددة عند إصدار أمر التشغيل ({$eso->order_number})",
                            'payment_method' => 'نقدي',
                            'receipt_path' => null,
                            'items_summary' => [],
                        ];
                    }

                    return [
                        'id' => 'eso-' . $eso->id,
                        'type' => 'eso',
                        'is_payment' => false,
                        'is_deposit' => false,
                        'number' => $eso->order_number,
                        'amount' => (float) $eso->total_cost,
                        'total_amount' => (float) $eso->total_cost,
                        'paid_amount' => (float) $eso->total_paid,
                        'date' => $dStr ?: date('Y-m-d'),
                        'created_at' => $eso->created_at ? $eso->created_at->toIso8601String() : $dStr,
                        'category' => 'أمر تشغيل خارجي',
                        'description' => "أمر تشغيل خارجي رقم {$eso->order_number} - {$eso->item_description}",
                        'payment_method' => $eso->total_paid > 0 ? ($eso->payments->first()?->payment_method ?? 'نقدي') : '-',
                        'items_summary' => [
                            [
                                'name' => $eso->item_description,
                                'quantity' => (float) $eso->quantity,
                                'unit' => $eso->unit ?: 'خدمة',
                                'unit_cost' => (float) $eso->unit_cost,
                                'total_cost' => (float) $eso->total_cost,
                            ]
                        ],
                    ];
                })->toArray();
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning("Error fetching ESO for {$id}: " . $e->getMessage());
            }
        }

        $merged = array_merge($payments, $pos, $esos, $esoPayments);
        usort($merged, function ($a, $b) {
            $dComp = strcmp($a['date'] ?? '', $b['date'] ?? '');
            if ($dComp !== 0) return $dComp;

            $aIsPay = !empty($a['is_payment']);
            $bIsPay = !empty($b['is_payment']);
            $aIsDeposit = !empty($a['is_deposit']);
            $bIsDeposit = !empty($b['is_deposit']);

            // If on same date, an order must come before its own deposit
            if ($aIsPay != $bIsPay) {
                if (!$aIsPay && $bIsDeposit) {
                    $matchParent = ($b['purchase_order_id'] ?? '') === $a['id'] || ($b['external_service_order_id'] ?? '') === $a['id'] || ($b['parent_id'] ?? '') === $a['id'];
                    if ($matchParent) return -1;
                }
                if ($aIsDeposit && !$bIsPay) {
                    $matchParent = ($a['purchase_order_id'] ?? '') === $b['id'] || ($a['external_service_order_id'] ?? '') === $b['id'] || ($a['parent_id'] ?? '') === $b['id'];
                    if ($matchParent) return 1;
                }
            }

            $cA = $a['created_at'] ?? '';
            $cB = $b['created_at'] ?? '';
            $cComp = strcmp($cA, $cB);
            if ($cComp !== 0) return $cComp;

            if ($aIsPay !== $bIsPay) return ($aIsPay ? 1 : 0) - ($bIsPay ? 1 : 0);

            return strcmp($a['id'] ?? '', $b['id'] ?? '');
        });

        // Compute running debt cumulative balance strictly in chronological order
        $runningDebt = 0.0;
        foreach ($merged as &$tx) {
            $amt = (float)($tx['amount'] ?? 0);
            if (!empty($tx['is_payment'])) {
                $runningDebt = round($runningDebt - $amt, 2);
            } else {
                $runningDebt = round($runningDebt + $amt, 2);
            }
            $tx['running_debt'] = $runningDebt;
        }
        unset($tx);

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
}
