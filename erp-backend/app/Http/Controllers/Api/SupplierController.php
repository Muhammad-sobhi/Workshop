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

        foreach ($suppliers->items() as $supplier) {
            $supplier->recalculateDebt();
        }

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

        return DB::transaction(function () use ($supplier, $validated, $request) {
            $user = auth()->id();
            $receiptPath = null;
            if ($request->hasFile('receipt')) {
                $path = $request->file('receipt')->store('receipts', 'public');
                $receiptPath = '/storage/' . $path;
            }

            $paymentAmount = (float) $validated['amount'];

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

            // 2. Reduce supplier debt
            $supplier->decrement('debt_amount', min($paymentAmount, (float)$supplier->debt_amount));

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
        $supplier = Supplier::findOrFail($supplierId);
        $payment = SupplierPayment::where('supplier_id', $supplier->id)->findOrFail($paymentId);

        return DB::transaction(function () use ($supplier, $payment) {
            $amount = (float)$payment->amount;

            // Revert Treasury Outflow
            TreasuryService::revertBySource(SupplierPayment::class, $payment->id);

            // Re-increase supplier debt
            $supplier->increment('debt_amount', $amount);

            $payment->delete();

            return response()->json(['message' => 'تم التراجع عن دفعة السداد وإلغاء القيد المالي بالخزينة بنجاح.']);
        });
    }

    public function getSupplierTransactions(string $id): JsonResponse
    {
        $supplier = Supplier::findOrFail($id);

        // 1. Direct Supplier Payments
        $payments = SupplierPayment::where('supplier_id', $id)->get()->map(function ($p) {
            $dStr = $p->payment_date instanceof \DateTimeInterface ? $p->payment_date->format('Y-m-d') : substr((string)$p->payment_date, 0, 10);
            return [
                'id' => 'pay-' . $p->id,
                'type' => $p->purchase_order_id ? 'deposit' : 'payment',
                'number' => $p->payment_number,
                'amount' => (float) $p->amount,
                'total_amount' => (float) $p->amount,
                'date' => $dStr ?: date('Y-m-d'),
                'category' => $p->purchase_order_id ? 'دفعة عربون / مقدم' : 'سداد دفعة للمورد',
                'description' => $p->notes ?: 'سداد دفعة نقدية',
                'payment_method' => $p->payment_method,
                'receipt_path' => $p->receipt_path,
                'items_summary' => [],
            ];
        })->toArray();

        // 2. Purchase Orders
        $pos = PurchaseOrder::where('supplier_id', $id)->with('items.material')->get()->map(function ($po) {
            $dStr = $po->order_date instanceof \DateTimeInterface ? $po->order_date->format('Y-m-d') : substr((string)$po->order_date, 0, 10);
            return [
                'id' => 'po-' . $po->id,
                'type' => 'purchase_order',
                'number' => $po->order_number,
                'amount' => (float) $po->total_amount,
                'total_amount' => (float) $po->total_amount,
                'deposit_paid' => (float) ($po->deposit_paid ?? 0),
                'date' => $dStr ?: date('Y-m-d'),
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

        // 3. External Service Orders and their Payments
        $esoPayments = [];
        $esos = ExternalServiceOrder::where('supplier_id', $id)->with('payments')->get()->map(function ($eso) use (&$esoPayments) {
            $dStr = $eso->sent_date instanceof \DateTimeInterface ? $eso->sent_date->format('Y-m-d') : substr((string)$eso->sent_date, 0, 10);

            // Collect child payments for this ESO
            foreach ($eso->payments as $ep) {
                $epDate = $ep->payment_date instanceof \DateTimeInterface ? $ep->payment_date->format('Y-m-d') : substr((string)$ep->payment_date, 0, 10);
                $esoPayments[] = [
                    'id' => 'eso-pay-' . $ep->id,
                    'type' => 'payment',
                    'number' => $eso->order_number,
                    'amount' => (float) $ep->amount,
                    'total_amount' => (float) $ep->amount,
                    'date' => $epDate ?: date('Y-m-d'),
                    'category' => 'سداد أمر تشغيل خارجي',
                    'description' => "سداد لأمر تشغيل خارجي ({$eso->order_number})",
                    'payment_method' => $ep->payment_method ?: 'cash',
                    'receipt_path' => $ep->receipt_image_path,
                    'items_summary' => [],
                ];
            }

            return [
                'id' => 'eso-' . $eso->id,
                'type' => 'eso',
                'number' => $eso->order_number,
                'amount' => (float) $eso->total_cost,
                'paid_amount' => (float) $eso->total_paid,
                'date' => $dStr ?: date('Y-m-d'),
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

        $merged = array_merge($payments, $pos, $esos, $esoPayments);
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
}
