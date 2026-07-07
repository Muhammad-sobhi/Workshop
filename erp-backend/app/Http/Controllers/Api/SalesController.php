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
        $perPage = (int) $request->query('per_page', 20);
        $query = Revenue::orderBy('revenue_date', 'desc');

        if ($request->filled('start_date')) {
            $query->where('revenue_date', '>=', $request->query('start_date'));
        }

        if ($request->filled('end_date')) {
            $query->where('revenue_date', '<=', $request->query('end_date'));
        }

        $paginator = $query->paginate($perPage);
        $sales = $paginator->getCollection()->map(function ($s) {
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
            ];
        })->toArray();

        $opPayments = \App\Models\OperationPayment::with('operation.client')
            ->orderBy('payment_date', 'desc')
            ->get()
            ->map(function ($p) {
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
                ];
            })->toArray();

        $merged = array_merge($sales, $opPayments);
        usort($merged, function ($a, $b) {
            return strcmp($b['revenue_date'], $a['revenue_date']);
        });

        return response()->json([
            'data' => $merged,
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
        ]);
    }

    public function getClients(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 200);
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
            'payment_method' => 'nullable|string|in:cash,instapay,vodafone_cash,bank_transfer',
        ]);

        $client = Client::find($validated['client_id']);
        $product = Product::find($validated['product_id']);
        
        return DB::transaction(function () use ($validated, $client, $product) {
            $user = auth()->id();

            // GetFinished Goods warehouse
            $whFin = Warehouse::where('code', 'WH-FIN')->first();
            $warehouseId = $whFin ? $whFin->id : Warehouse::first()->id;

            // Check stock of the product in this warehouse
            $available = $product->calculateStock($warehouseId);
            if ($available < $validated['quantity']) {
                return response()->json([
                    'message' => "عذراً، المخزون الحالي للمنتج ({$product->name}) لا يكفي. المتوفر: {$available} حبة، والمطلوب: {$validated['quantity']} حبة."
                ], 400);
            }

            // Create Inventory Movement (outgoing product)
            $mvCount = InventoryMovement::count();
            $mvNo = 'MV-' . str_pad(++$mvCount, 5, '0', STR_PAD_LEFT);
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

        $client->update($validated);

        return response()->json(['message' => 'تم تحديث بيانات العميل بنجاح', 'client' => $client]);
    }

    public function destroyClient(string $id): JsonResponse
    {
        $client = Client::findOrFail($id);
        $client->delete();
        return response()->json(['message' => 'تم حذف العميل بنجاح']);
    }
}
