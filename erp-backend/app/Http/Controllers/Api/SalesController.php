<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Revenue;
use App\Models\Client;
use App\Models\Product;
use App\Models\InventoryMovement;
use App\Models\Warehouse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class SalesController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 500); // Fetch all or paginate
        
        $query = Revenue::with(['client', 'supplier'])->orderBy('revenue_date', 'desc');

        if ($request->filled('start_date')) {
            $query->where('revenue_date', '>=', $request->query('start_date'));
        }

        if ($request->filled('end_date')) {
            $query->where('revenue_date', '<=', $request->query('end_date'));
        }

        $sales = $query->get()->map(function ($s) {
            return [
                'id' => $s->id,
                'type' => 'revenue',
                'revenue_number' => $s->revenue_number,
                'amount' => (float)$s->amount,
                'revenue_date' => $s->revenue_date,
                'category' => $s->category,
                'description' => $s->description,
                'reference_number' => $s->reference_number,
                'payment_method' => $s->payment_method,
                'client_name' => $s->client->name ?? '',
                'supplier_name' => $s->supplier->name ?? '',
                'receipt_path' => $s->receipt_path,
            ];
        })->toArray();

        $opQuery = \App\Models\OperationPayment::with('operation.client')
            ->orderBy('payment_date', 'desc');

        if ($request->filled('start_date')) {
            $opQuery->where('payment_date', '>=', $request->query('start_date'));
        }

        if ($request->filled('end_date')) {
            $opQuery->where('payment_date', '<=', $request->query('end_date'));
        }

        $opPayments = $opQuery->get()->map(function ($p) {
            return [
                'id' => 'op-' . $p->id,
                'type' => 'revenue',
                'revenue_number' => $p->operation->operation_number ?? 'OP',
                'amount' => (float)$p->amount_paid,
                'revenue_date' => $p->payment_date,
                'category' => 'دفعة عميل على أمر تشغيل',
                'description' => 'دفعة مستلمة لأمر التشغيل ' . ($p->operation->operation_number ?? '') . ' للعميل (' . ($p->operation->client->name ?? 'غير محدد') . ')' . ($p->notes ? ' - ' . $p->notes : ''),
                'reference_number' => $p->operation->operation_number ?? '',
                'payment_method' => $p->payment_method,
                'client_name' => $p->operation->client->name ?? '',
                'supplier_name' => '',
                'receipt_path' => $p->receipt_path,
            ];
        })->toArray();

        // Deposits from operations
        $depQuery = \App\Models\Operation::with('client')
            ->where('deposit_paid', '>', 0)
            ->whereNotIn('status', ['Cancelled']);

        if ($request->filled('start_date')) {
            $depQuery->whereDate('created_at', '>=', $request->query('start_date'));
        }

        if ($request->filled('end_date')) {
            $depQuery->whereDate('created_at', '<=', $request->query('end_date'));
        }

        $opDeposits = $depQuery->get()->map(function ($op) {
            return [
                'id' => 'op-dep-' . $op->id,
                'type' => 'revenue',
                'revenue_number' => $op->operation_number,
                'amount' => (float)$op->deposit_paid,
                'revenue_date' => $op->created_at->toDateString(),
                'category' => 'عربون أمر تشغيل',
                'description' => 'عربون مستلم لأمر التشغيل ' . $op->operation_number . ' للعميل (' . ($op->client->name ?? 'غير محدد') . ')',
                'reference_number' => $op->operation_number,
                'payment_method' => $op->deposit_payment_method ?? 'cash',
                'client_name' => $op->client->name ?? '',
                'supplier_name' => '',
                'receipt_path' => null,
            ];
        })->toArray();

        $merged = array_merge($sales, $opPayments, $opDeposits);
        usort($merged, function ($a, $b) {
            return strcmp($b['revenue_date'], $a['revenue_date']);
        });

        // Paginate manually if needed, or return all since we want filterable full list
        return response()->json($merged);
    }

    public function getClients(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 10);
        $paginator = Client::orderBy('name', 'asc')->paginate($perPage);
        $paginator->getCollection()->each(function ($client) {
            $operations = \App\Models\Operation::where('client_id', $client->id)
                ->whereNotNull('total_price')
                ->with('payments')
                ->get();
            
            $opDebt = 0;
            foreach ($operations as $op) {
                $paid = (float)$op->deposit_paid + (float)$op->payments->sum('amount_paid');
                $opDebt += max(0, (float)$op->total_price - $paid);
            }
            
            $client->debt_amount = (float)$client->debt_amount + $opDebt;
        });
        return response()->json($paginator);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'client_id' => 'required|exists:clients,id',
            'product_id' => 'required|exists:products,id',
            'quantity' => 'required|numeric|min:1',
            'price' => 'required|numeric|min:0.01',
            'revenue_date' => 'required|date',
            'notes' => 'nullable|string',
            'payment_method' => 'nullable|string|in:cash,instapay,vodafone_cash,bank_transfer,postal_transfer',
        ]);

        $client = Client::find($validated['client_id']);
        $product = Product::find($validated['product_id']);
        
        return DB::transaction(function () use ($validated, $client, $product) {
            $user = auth()->id();

            // GetFinished Goods warehouse
            $whFin = Warehouse::where('code', 'WH-FIN')
                ->orWhere('code', 'WSH')
                ->orWhere('name', 'like', '%منتج%')
                ->first();
            $warehouseId = $whFin ? $whFin->id : Warehouse::first()->id;

            // Check stock of the product in this warehouse
            $available = $product->calculateStock($warehouseId);
            if ($available < $validated['quantity']) {
                return response()->json([
                    'message' => "عذراً، المخزون الحالي للمنتج ({$product->name}) لا يكفي. المتوفر: {$available} حبة، والمطلوب: {$validated['quantity']} حبة."
                ], 400);
            }

            // Create Inventory Movement (outgoing product)
            $maxId = InventoryMovement::max('id') ?? 0;
            $mvNo = 'MV-' . str_pad($maxId + 1, 5, '0', STR_PAD_LEFT);
            InventoryMovement::create([
                'movement_number' => $mvNo,
                'movement_date' => Carbon::now(),
                'warehouse_id' => $warehouseId,
                'material_id' => null,
                'product_id' => $product->id,
                'movement_type' => 'Transfer_Out', // represents deduction
                'quantity' => $validated['quantity'],
                'unit_cost' => $product->unit_cost,
                'total_cost' => $validated['quantity'] * $product->unit_cost,
                'reference_number' => 'INV-' . Carbon::now()->year . '-' . str_pad(Revenue::count() + 1, 4, '0', STR_PAD_LEFT),
                'notes' => "مبيعات للعميل ({$client->name}) - منتج {$product->name}",
                'created_by' => $user
            ]);

            $product->stock_quantity -= $validated['quantity'];
            $product->save();

            // Create Revenue (Accounts Receivable / Sales Invoice)
            $amount = $validated['quantity'] * $validated['price'];
            $invNo = 'INV-' . Carbon::now()->year . '-' . str_pad(Revenue::count() + 1, 4, '0', STR_PAD_LEFT);

            $revenue = Revenue::create([
                'revenue_number' => $invNo,
                'amount' => $amount,
                'revenue_date' => $validated['revenue_date'],
                'category' => 'مبيعات منتجات جاهزة',
                'description' => "فاتورة مبيعات رقم {$invNo} للعميل ({$client->name}) - بيع {$validated['quantity']} حبة من منتج {$product->name}",
                'reference_number' => $invNo,
                'payment_method' => $validated['payment_method'] ?? null,
                'client_id' => $client->id,
            ]);

            return response()->json([
                'message' => 'تم تسجيل عملية البيع بنجاح وتحديث مخزون المنتجات الجاهزة وإدراج الفاتورة في الإيرادات تلقائياً.',
                'revenue' => $revenue
            ], 201);
        });
    }

    public function storeClient(Request $request): JsonResponse
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

        $client = Client::create($validated);

        return response()->json(['message' => 'تم إضافة العميل بنجاح', 'client' => $client], 201);
    }

    public function updateClient(Request $request, string $id): JsonResponse
    {
        $client = Client::findOrFail($id);

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

        $client->update($validated);

        return response()->json(['message' => 'تم تحديث بيانات العميل بنجاح', 'client' => $client]);
    }

    public function destroyClient(string $id): JsonResponse
    {
        $client = Client::findOrFail($id);
        $client->delete();
        return response()->json(['message' => 'تم حذف العميل بنجاح']);
    }

    public function payClientDebt(Request $request, string $id): JsonResponse
    {
        $client = Client::findOrFail($id);

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

        return DB::transaction(function () use ($client, $validated, $receiptPath) {
            $paymentAmount = (float)$validated['amount'];
            $remainingPayment = $paymentAmount;

            // 1. Pay off client's initial debt_amount first
            if ($client->debt_amount > 0) {
                $apply = min($remainingPayment, (float)$client->debt_amount);
                $client->decrement('debt_amount', $apply);
                $remainingPayment -= $apply;

                // Also log a general Revenue for the client initial debt payment
                $invNo = 'REV-' . Carbon::now()->year . '-' . str_pad(Revenue::count() + 1, 4, '0', STR_PAD_LEFT);
                Revenue::create([
                    'revenue_number' => $invNo,
                    'amount' => $apply,
                    'revenue_date' => $validated['payment_date'],
                    'category' => 'تسديد ديون عملاء',
                    'description' => 'سداد جزء من الدين العام للعميل (' . $client->name . ')' . ($validated['notes'] ? ' - ' . $validated['notes'] : ''),
                    'reference_number' => 'CLIENT-' . $client->id,
                    'payment_method' => $validated['payment_method'],
                    'client_id' => $client->id,
                    'receipt_path' => $receiptPath,
                ]);
            }

            // 2. Pay off operations (milestones)
            if ($remainingPayment > 0) {
                $operations = \App\Models\Operation::where('client_id', $client->id)
                    ->whereNotIn('status', ['Cancelled'])
                    ->get();

                foreach ($operations as $op) {
                    $paid = (float)$op->deposit_paid + (float)$op->payments()->sum('amount_paid');
                    $total = (float)$op->total_price;
                    $debt = max(0, $total - $paid);

                    if ($debt <= 0) {
                        continue;
                    }

                    $apply = min($remainingPayment, $debt);

                    // Create OperationPayment
                    \App\Models\OperationPayment::create([
                        'operation_id' => $op->id,
                        'amount_paid' => $apply,
                        'payment_date' => $validated['payment_date'],
                        'notes' => 'دفعة عميل على أمر تشغيل رقم ' . $op->operation_number . ($validated['notes'] ? ' - ' . $validated['notes'] : ''),
                        'receipt_path' => $receiptPath,
                        'payment_method' => $validated['payment_method'],
                    ]);

                    $remainingPayment -= $apply;

                    if ($remainingPayment <= 0) {
                        break;
                    }
                }
            }

            // 3. If there is still excess payment, log it as general revenue
            if ($remainingPayment > 0) {
                $invNo = 'REV-' . Carbon::now()->year . '-' . str_pad(Revenue::count() + 1, 4, '0', STR_PAD_LEFT);
                Revenue::create([
                    'revenue_number' => $invNo,
                    'amount' => $remainingPayment,
                    'revenue_date' => $validated['payment_date'],
                    'category' => 'دفعة عميل إضافية',
                    'description' => 'دفعة عميل زائدة للعميل (' . $client->name . ')' . ($validated['notes'] ? ' - ' . $validated['notes'] : ''),
                    'reference_number' => 'CLIENT-' . $client->id,
                    'payment_method' => $validated['payment_method'],
                    'client_id' => $client->id,
                    'receipt_path' => $receiptPath,
                ]);
            }

            return response()->json([
                'message' => 'تم تسجيل سداد الدفعة للعميل بنجاح وتحديث الحسابات',
            ]);
        });
    }

    public function getClientTransactions(string $id): JsonResponse
    {
        $client = Client::findOrFail($id);

        $revenues = Revenue::where('client_id', $id)
            ->get()
            ->map(function ($r) {
                return [
                    'id' => 'rev-' . $r->id,
                    'type' => 'revenue',
                    'number' => $r->revenue_number,
                    'amount' => (float)$r->amount,
                    'date' => $r->revenue_date,
                    'category' => $r->category,
                    'description' => $r->description,
                    'payment_method' => $r->payment_method,
                    'receipt_path' => $r->receipt_path,
                ];
            })->toArray();

        $milestones = \App\Models\OperationPayment::whereHas('operation', function ($q) use ($id) {
            $q->where('client_id', $id);
        })
        ->with('operation')
        ->get()
        ->map(function ($p) {
            return [
                'id' => 'milestone-' . $p->id,
                'type' => 'milestone',
                'number' => $p->operation->operation_number ?? 'OP',
                'amount' => (float)$p->amount_paid,
                'date' => $p->payment_date,
                'category' => 'دفعة عميل على أمر تشغيل',
                'description' => 'دفعة مستلمة لأمر التشغيل ' . ($p->operation->operation_number ?? '') . ($p->notes ? ' - ' . $p->notes : ''),
                'payment_method' => $p->payment_method,
                'receipt_path' => $p->receipt_path,
            ];
        })->toArray();

        $deposits = \App\Models\Operation::where('client_id', $id)
            ->where('deposit_paid', '>', 0)
            ->whereNotIn('status', ['Cancelled'])
            ->get()
            ->map(function ($op) {
                return [
                    'id' => 'deposit-' . $op->id,
                    'type' => 'deposit',
                    'number' => $op->operation_number,
                    'amount' => (float)$op->deposit_paid,
                    'date' => $op->created_at->toDateString(),
                    'category' => 'عربون أمر تشغيل',
                    'description' => 'عربون مستلم لأمر التشغيل ' . $op->operation_number . ($op->notes ? ' - ' . $op->notes : ''),
                    'payment_method' => $op->deposit_payment_method ?? 'cash',
                    'receipt_path' => null,
                ];
            })->toArray();

        $merged = array_merge($revenues, $milestones, $deposits);
        usort($merged, function ($a, $b) {
            return strcmp($b['date'], $a['date']);
        });

        return response()->json($merged);
    }

    public function bulkImportClients(Request $request): JsonResponse
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
                Client::create([
                    'name' => $item['name'],
                    'phone' => $item['phone'] ?? null,
                    'email' => $item['email'] ?? null,
                    'company' => $item['company'] ?? null,
                    'debt_amount' => $item['debt_amount'] ?? 0.00,
                ]);
                $importedCount++;
            }

            return response()->json(['message' => "تم استيراد {$importedCount} من العملاء بنجاح"]);
        });
    }
}
