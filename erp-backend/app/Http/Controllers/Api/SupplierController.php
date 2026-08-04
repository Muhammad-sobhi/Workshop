<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Supplier;
use App\Models\Material;
use App\Models\Expense;
use App\Models\PurchaseOrder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;

class SupplierController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 10);
        $suppliers = Supplier::withCount('purchaseOrders')
            ->with([
                'materials' => function ($q) {
                    $q->select('materials.id', 'materials.name', 'materials.unit', 'materials.code')
                      ->withPivot('price', 'notes');
                },
                'purchaseOrders' => function ($q) {
                    $q->where('status', 'Received')->select('id', 'supplier_id', 'total_amount', 'deposit_paid');
                }
            ])
            ->orderBy('name')
            ->paginate($perPage);

        // Compute live outstanding debt for each supplier from received purchase orders
        $suppliers->each(function ($supplier) {
            $outstanding = $supplier->purchaseOrders->sum(function ($po) {
                return max(0, floatval($po->total_amount) - floatval($po->deposit_paid ?? 0));
            });
            // Sync the debt_amount field so it matches real data
            if ($supplier->debt_amount != $outstanding) {
                $supplier->update(['debt_amount' => $outstanding]);
            }
            $supplier->debt_amount = $outstanding;
        });

        return response()->json($suppliers);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'           => 'required|string|max:255',
            'contact_person' => 'nullable|string|max:255',
            'phone'          => 'nullable|string|max:30',
            'email'          => 'nullable|email|max:255',
            'address'        => 'nullable|string',
            'notes'          => 'nullable|string',
            'debt_amount'    => 'nullable|numeric|min:0',
            'debt_due_date'  => 'nullable|date',
        ]);

        $validated['debt_amount'] = $validated['debt_amount'] ?? 0;

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
            'name'           => 'required|string|max:255',
            'contact_person' => 'nullable|string|max:255',
            'phone'          => 'nullable|string|max:30',
            'email'          => 'nullable|email|max:255',
            'address'        => 'nullable|string',
            'notes'          => 'nullable|string',
            'debt_amount'    => 'nullable|numeric|min:0',
            'debt_due_date'  => 'nullable|date',
        ]);

        $validated['debt_amount'] = $validated['debt_amount'] ?? 0;

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
            'price'       => 'nullable|numeric|min:0',
            'notes'       => 'nullable|string',
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
        $suppliers = Supplier::with(['materials' => function ($q) {
            $q->select('materials.id', 'materials.name', 'materials.unit', 'materials.code')
              ->withPivot('price');
        }])->orderBy('name')->get();

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
            $paymentAmount = (float)$validated['amount'];
            $remainingPayment = $paymentAmount;

            // Get received purchase orders with outstanding debt for this supplier
            $orders = PurchaseOrder::where('supplier_id', $supplier->id)
                ->where('status', 'Received')
                ->get();

            foreach ($orders as $order) {
                $debt = (float)$order->total_amount - (float)($order->deposit_paid ?? 0.00);
                if ($debt <= 0) {
                    continue;
                }

                $apply = min($remainingPayment, $debt);
                $order->increment('deposit_paid', $apply);
                $remainingPayment -= $apply;

                if ($remainingPayment <= 0) {
                    break;
                }
            }

            // Create Expense
            $desc = 'تسديد دين للمورد (' . $supplier->name . ')';
            if (!empty($validated['notes'])) {
                $desc .= ' - ' . $validated['notes'];
            }

            $expense = Expense::create([
                'expense_number' => $expNo,
                'amount' => $paymentAmount,
                'expense_date' => $validated['payment_date'],
                'category' => 'تسديد ديون موردين',
                'description' => $desc,
                'reference_number' => 'SUPP-' . $supplier->id,
                'payment_method' => $validated['payment_method'],
                'supplier_id' => $supplier->id,
                'receipt_path' => $receiptPath,
            ]);

            return response()->json([
                'message' => 'تم تسجيل سداد الدين بنجاح وتحديث حساب المورد والمصروفات',
                'expense' => $expense,
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
                    'amount' => (float)$e->amount,
                    'date' => $e->expense_date,
                    'category' => $e->category,
                    'description' => $e->description,
                    'payment_method' => $e->payment_method,
                    'receipt_path' => $e->receipt_path,
                ];
            })->toArray();

        $deposits = PurchaseOrder::where('supplier_id', $id)
            ->where('deposit_paid', '>', 0)
            ->get()
            ->map(function ($po) {
                return [
                    'id' => 'deposit-' . $po->id,
                    'type' => 'deposit',
                    'number' => $po->order_number,
                    'amount' => (float)$po->deposit_paid,
                    'date' => $po->order_date,
                    'category' => 'عربون طلب شراء',
                    'description' => 'عربون مدفوع لطلب الشراء رقم ' . $po->order_number . ($po->notes ? ' - ' . $po->notes : ''),
                    'payment_method' => $po->payment_method ?? 'cash',
                    'receipt_path' => null,
                ];
            })->toArray();

        $merged = array_merge($expenses, $deposits);
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
