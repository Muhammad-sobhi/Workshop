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

        $allProducts = Product::all();

        $sales = $query->get()->map(function ($s) use ($allProducts) {
            $productCost = 0;
            $desc = $s->description ?? '';

            if ((float)($s->cogs ?? 0) > 0) {
                $productCost = (float)$s->cogs;
            } elseif (preg_match('/\[COST:\s*(\d+(?:\.\d+)?)\]/', $desc, $m)) {
                $productCost = (float)$m[1];
            } elseif (preg_match('/بيع\s+(\d+(?:\.\d+)?)\s*(?:[^\s]+\s+)?من\s+منتج\s+(?:[\(\s]*)([^\)\-\,]+)(?:[\)\s]*)/u', $desc, $matches)) {
                $qty = (float)$matches[1];
                $prodName = trim($matches[2]);
                
                $matchedProduct = $allProducts->first(function ($p) use ($prodName) {
                    $pNameLower = mb_strtolower(trim($p->name));
                    $searchLower = mb_strtolower($prodName);
                    return $pNameLower === $searchLower 
                        || str_contains($searchLower, $pNameLower) 
                        || str_contains($pNameLower, $searchLower);
                });

                if ($matchedProduct) {
                    $productCost = $qty * (float)$matchedProduct->unit_cost;
                }
            } else {
                // Fallback: match any product name present in description
                foreach ($allProducts as $p) {
                    $pName = trim($p->name);
                    if (!empty($pName) && str_contains(mb_strtolower($desc), mb_strtolower($pName))) {
                        // Extract numbers from description
                        preg_match_all('/(?:\b|\D)(\d+(?:\.\d+)?)(?:\b|\D)/u', $desc, $numMatches);
                        $numbers = array_map('floatval', $numMatches[1] ?? []);
                        $qty = 1;
                        foreach ($numbers as $num) {
                            if ($num > 0 && (float)$s->amount > 0) {
                                if (abs(($num * (float)$p->sale_price) - (float)$s->amount) < 0.01) {
                                    $qty = $num;
                                    break;
                                }
                                if ($num != (float)$s->amount) {
                                    $qty = $num;
                                }
                            }
                        }
                        $productCost = $qty * (float)$p->unit_cost;
                        break;
                    }
                }
            }

            // Ultimate fallback: infer quantity from products or estimate product cost ratio
            if ($productCost == 0 && (float)$s->amount > 0) {
                foreach ($allProducts as $p) {
                    $sPrice = (float)$p->sale_price;
                    $uCost = (float)$p->unit_cost;
                    if ($sPrice > 0 && $uCost > 0) {
                        $dividedQty = (float)$s->amount / $sPrice;
                        if (abs($dividedQty - round($dividedQty)) < 0.01) {
                            $productCost = round($dividedQty) * $uCost;
                            break;
                        }
                    }
                }
                if ($productCost == 0) {
                    $productCost = (float)$s->amount * 0.85;
                }
            }

            $cleanDesc = trim(preg_replace('/\s*\[COST:\s*(\d+(?:\.\d+)?)\]/', '', $desc));

            return [
                'id' => $s->id,
                'type' => 'revenue',
                'revenue_number' => $s->revenue_number,
                'amount' => (float)$s->amount,
                'cogs' => (float)$productCost,
                'product_cost' => (float)$productCost,
                'revenue_date' => $s->revenue_date,
                'category' => $s->category,
                'description' => $cleanDesc,
                'reference_number' => $s->reference_number,
                'payment_method' => $s->payment_method,
                'client_name' => $s->client->name ?? '',
                'supplier_name' => $s->supplier->name ?? '',
                'receipt_path' => $s->receipt_path,
            ];
        })->toArray();

        usort($sales, function ($a, $b) {
            return strcmp($b['revenue_date'], $a['revenue_date']);
        });

        return response()->json($sales);
    }

    public function getClients(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 20);
        $paginator = Client::orderBy('name', 'asc')->paginate($perPage);
        $paginator->getCollection()->each(function ($client) {
            $operations = \App\Models\Operation::where('client_id', $client->id)
                ->whereIn('status', ['Completed', 'Delivered'])
                ->whereNotNull('total_price')
                ->with('payments')
                ->get();
            
            $totalOrderValue = 0;
            $totalPaidOnOps = 0;
            foreach ($operations as $op) {
                $totalOrderValue += (float)$op->total_price;
                $totalPaidOnOps += (float)$op->deposit_paid + (float)$op->payments->sum('amount_paid');
            }
            
            $opsDebt = max(0, $totalOrderValue - $totalPaidOnOps);
            // Outstanding client debt is initial unallocated debt plus unpaid balance on operations
            $client->debt_amount = (float)$client->debt_amount + $opsDebt;
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

            // Get Products warehouse WSH-P (المنتجات)
            $whProd = Warehouse::productsWarehouse();
            $warehouseId = $whProd ? $whProd->id : Warehouse::first()->id;

            // Check stock of the product in this warehouse
            $available = $product->calculateStock($warehouseId);
            if ($available < $validated['quantity']) {
                $unitName = $product->unit ?: 'وحدة';
                return response()->json([
                    'message' => "عذراً، المخزون الحالي للمنتج ({$product->name}) لا يكفي. المتوفر: {$available} {$unitName}، والمطلوب: {$validated['quantity']} {$unitName}."
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

            // Create Revenue (Accounts Receivable / Sales Invoice) with COGS
            $amount = $validated['quantity'] * $validated['price'];
            $cogs = $validated['quantity'] * (float)$product->unit_cost;
            $invNo = 'INV-' . Carbon::now()->year . '-' . str_pad(Revenue::count() + 1, 4, '0', STR_PAD_LEFT);
            $unitName = $product->unit ?: 'وحدة';

            $revenue = Revenue::create([
                'revenue_number' => $invNo,
                'amount' => $amount,
                'cogs' => $cogs,
                'revenue_date' => $validated['revenue_date'],
                'category' => 'مبيعات منتجات جاهزة',
                'description' => "فاتورة مبيعات رقم {$invNo} للعميل ({$client->name}) - بيع {$validated['quantity']} {$unitName} من منتج {$product->name}",
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
            ->where(function($q) {
                $q->whereNull('reference_number')
                  ->orWhere('reference_number', 'not like', 'OP-%');
            })
            ->get()
            ->map(function ($r) {
                // Parse sales descriptions like: "فاتورة مبيعات رقم INV-2026-0001 للعميل (أبو دسوقى) - بيع 700 حبة من منتج كرسي عروسة عادي"
                $itemsArr = [];
                if (preg_match('/بيع\s+(\d+(?:\.\d+)?)\s*(?:[^\s]+\s+)?من\s+منتج\s+(.+)$/u', $r->description, $matches)) {
                    $qty = (float)$matches[1];
                    $prodName = trim($matches[2]);
                    $unitPrice = $qty > 0 ? (float)$r->amount / $qty : (float)$r->amount;
                    $itemsArr[] = [
                        'name' => $prodName,
                        'quantity' => $qty,
                        'unit' => 'وحدة',
                        'unit_cost' => round($unitPrice, 2),
                        'total_cost' => (float)$r->amount,
                    ];
                } elseif (!empty($r->description)) {
                    $itemsArr[] = [
                        'name' => $r->description,
                        'quantity' => 1,
                        'unit' => 'فاتورة',
                        'unit_cost' => (float)$r->amount,
                        'total_cost' => (float)$r->amount,
                    ];
                }

                return [
                    'id' => 'rev-' . $r->id,
                    'type' => 'revenue',
                    'number' => $r->revenue_number ?: ('INV-' . $r->id),
                    'amount' => (float)$r->amount,
                    'date' => $r->revenue_date,
                    'category' => $r->category ?: 'مبيعات منتجات جاهزة',
                    'description' => $r->description,
                    'payment_method' => $r->payment_method,
                    'receipt_path' => $r->receipt_path,
                    'items_summary' => $itemsArr,
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
                'items_summary' => [],
            ];
        })->toArray();

        $deposits = [];
        $ops = \App\Models\Operation::where('client_id', $id)
            ->whereNotIn('status', ['Cancelled'])
            ->with(['product', 'operationProducts.product'])
            ->get();

        foreach ($ops as $op) {
            $itemsArr = [];
            if ($op->operationProducts && $op->operationProducts->count() > 0) {
                foreach ($op->operationProducts as $opProd) {
                    $pName = $opProd->product->name ?? 'منتج';
                    $pUnit = $opProd->product->unit ?? 'وحدة';
                    $q = (float)$opProd->quantity;
                    $itemsArr[] = [
                        'name' => $pName,
                        'quantity' => $q,
                        'unit' => $pUnit,
                        'unit_cost' => 0,
                        'total_cost' => 0,
                    ];
                }
            } elseif ($op->product) {
                $pName = $op->product->name;
                $pUnit = $op->product->unit ?? 'وحدة';
                $q = (float)($op->quantity ?? 1);
                $itemsArr[] = [
                    'name' => $pName,
                    'quantity' => $q,
                    'unit' => $pUnit,
                    'unit_cost' => 0,
                    'total_cost' => 0,
                ];
            }

            $prodName = $op->product->name ?? ($op->operationProducts->first()->product->name ?? 'منتج/طلب تشغيل');
            $prodUnit = $op->product->unit ?? ($op->operationProducts->first()->product->unit ?? 'وحدة');
            $qty = (float)($op->quantity ?? 1);
            $total = (float)($op->total_price ?? 0);

            // Add the parent Production Order header
            $deposits[] = [
                'id' => 'op-' . $op->id,
                'type' => 'production_order',
                'number' => $op->operation_number,
                'amount' => $total,
                'total_amount' => $total,
                'paid_amount' => (float)($op->deposit_paid ?? 0),
                'date' => $op->created_at->toDateString(),
                'category' => 'أمر تشغيل',
                'description' => 'أمر تشغيل رقم ' . $op->operation_number 
                    . " | المنتج: {$prodName} ({$qty} {$prodUnit})"
                    . ($total > 0 ? ' (إجمالي تكلفة الطلب: ' . number_format($total, 2) . ' EGP)' : '')
                    . ($op->notes ? ' - ' . $op->notes : ''),
                'payment_method' => $op->deposit_payment_method ?? 'cash',
                'receipt_path' => null,
                'items_summary' => $itemsArr,
            ];

            // If an initial deposit was paid when creating the production order, add it as a child payment
            if ((float)($op->deposit_paid ?? 0) > 0) {
                $deposits[] = [
                    'id' => 'op-deposit-' . $op->id,
                    'type' => 'milestone',
                    'number' => $op->operation_number,
                    'amount' => (float)$op->deposit_paid,
                    'date' => $op->created_at->toDateString(),
                    'category' => 'دفعة عربون على أمر تشغيل',
                    'description' => 'دفعة عربون أعدت عند إنشاء أمر التشغيل (' . $op->operation_number . ')',
                    'payment_method' => $op->deposit_payment_method ?? 'cash',
                    'receipt_path' => null,
                    'items_summary' => [],
                ];
            }
        }

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

    public function storeHistoricalSale(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'client_id'      => 'nullable|exists:clients,id',
            'revenue_date'   => 'required|date',
            'payment_method' => 'nullable|string|in:cash,instapay,vodafone_cash,bank_transfer,postal_transfer',
            'notes'          => 'nullable|string',
            'items'          => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity'   => 'required|numeric|min:0.001',
            'items.*.sale_price' => 'required|numeric|min:0',
        ]);

        return DB::transaction(function () use ($validated) {
            $client = !empty($validated['client_id']) ? Client::find($validated['client_id']) : null;
            $createdRevenues = [];

            foreach ($validated['items'] as $item) {
                $product = Product::find($item['product_id']);
                if (!$product) continue;

                $quantity = (float)$item['quantity'];
                $price = (float)$item['sale_price'];
                $amount = $quantity * $price;

                $maxId = Revenue::max('id') ?? 0;
                $invNo = 'HIST-' . Carbon::now()->year . '-' . str_pad($maxId + 1, 4, '0', STR_PAD_LEFT);

                $costAmount = $quantity * (float)$product->unit_cost;

                $desc = "مبيعات سابقة (رصيد إفتتاحي): بيع {$quantity} {$product->unit} من منتج ({$product->name}) بسعر {$price} للوحدة [COST: {$costAmount}]";
                if ($client) {
                    $desc .= " للعميل ({$client->name})";
                }
                if (!empty($validated['notes'])) {
                    $desc .= ' - ' . $validated['notes'];
                }

                $revenue = Revenue::create([
                    'revenue_number'   => $invNo,
                    'amount'           => $amount,
                    'cogs'             => $costAmount,
                    'revenue_date'     => $validated['revenue_date'],
                    'category'         => 'مبيعات سابقة / رصيد إفتتاحي',
                    'description'      => $desc,
                    'reference_number' => $invNo,
                    'payment_method'   => $validated['payment_method'] ?? 'cash',
                    'client_id'        => $client?->id,
                ]);

                $createdRevenues[] = $revenue;
            }

            return response()->json([
                'message' => 'تم تسجيل المبيعات السابقة بنجاح وإضافتها تلقائياً للإيرادات والحسابات',
                'revenues' => $createdRevenues
            ], 201);
        });
    }

    private function getOperationProductCost(\App\Models\Operation $op, float $paidAmount): float
    {
        $totalBomCost = 0.0;
        if ($op->operationProducts && $op->operationProducts->count() > 0) {
            foreach ($op->operationProducts as $opProd) {
                if ($opProd->product) {
                    $totalBomCost += ((float)$opProd->quantity * (float)$opProd->product->unit_cost);
                }
            }
        } elseif ($op->product) {
            $totalBomCost = ((float)($op->quantity ?? 1)) * (float)$op->product->unit_cost;
        }

        $totalPrice = (float)$op->total_price;
        if ($totalPrice > 0) {
            $cogsRatio = min(1.0, $totalBomCost / $totalPrice);
            return round($paidAmount * $cogsRatio, 2);
        }

        return round(min($paidAmount, $totalBomCost), 2);
    }
}
