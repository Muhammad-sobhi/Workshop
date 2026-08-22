<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Operation;
use App\Models\OperationPayment;
use App\Models\OperationProduct;
use App\Models\Product;
use App\Models\Material;
use App\Models\Warehouse;
use App\Models\SalesInvoice;
use App\Models\SalesInvoiceItem;
use App\Models\ClientPayment;
use App\Models\Client;
use App\Models\Supplier;
use App\Services\TreasuryService;
use App\Services\InventoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class OperationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 20);
        $operations = Operation::with(['product.category', 'warehouse', 'client', 'operationProducts.product', 'payments'])
            ->orderBy('created_at', 'desc')
            ->paginate($perPage);

        return response()->json($operations);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'warehouse_id' => 'nullable|exists:warehouses,id',
            'client_id' => 'nullable|exists:clients,id',
            'deposit_paid' => 'nullable|numeric|min:0',
            'deposit_payment_method' => 'nullable|string|in:cash,instapay,vodafone_cash,bank_transfer,postal_transfer',
            'use_stock' => 'nullable|boolean',
            'total_price' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string',
            'product_id' => 'nullable|exists:products,id',
            'quantity' => 'nullable|numeric|min:0.01',
            'products' => 'nullable|array',
            'products.*.product_id' => 'required|exists:products,id',
            'products.*.quantity' => 'required|numeric|min:0.01',
            'products.*.quantity_taken_from_stock' => 'nullable|numeric|min:0',
        ]);

        $isStockOrder = empty($validated['client_id']);
        $opNo = $this->generateOperationNumber();

        $warehouseId = $validated['warehouse_id'] ?? null;
        if (!$warehouseId) {
            $whRaw = Warehouse::rawMaterialsWarehouse();
            $warehouseId = $whRaw ? $whRaw->id : (Warehouse::first() ? Warehouse::first()->id : 1);
        }

        $depositPaid = floatval($validated['deposit_paid'] ?? 0.00);

        return DB::transaction(function () use ($validated, $isStockOrder, $opNo, $warehouseId, $depositPaid) {
            $user = auth()->id();

            $operation = Operation::create([
                'operation_number' => $opNo,
                'product_id' => $validated['product_id'] ?? null,
                'quantity' => $validated['quantity'] ?? null,
                'warehouse_id' => $warehouseId,
                'client_id' => $validated['client_id'] ?? null,
                'deposit_paid' => $depositPaid,
                'deposit_payment_method' => $validated['deposit_payment_method'] ?? 'cash',
                'use_stock' => $validated['use_stock'] ?? false,
                'total_price' => $validated['total_price'] ?? null,
                'status' => 'Pending',
                'notes' => $validated['notes'] ?? null,
            ]);

            // Save products
            $whProd = Warehouse::productsWarehouse();
            $prodWhId = $whProd ? $whProd->id : $warehouseId;

            $productEntries = [];
            if (!empty($validated['products'])) {
                foreach ($validated['products'] as $prod) {
                    $avail = InventoryService::getStock('product', $prod['product_id'], $prodWhId);
                    $qtyFromStock = 0.0;
                    if (isset($prod['quantity_taken_from_stock'])) {
                        $qtyFromStock = min((float) $prod['quantity'], min((float) $prod['quantity_taken_from_stock'], max(0.0, $avail)));
                    } elseif ($operation->use_stock) {
                        $qtyFromStock = min((float) $prod['quantity'], max(0.0, $avail));
                    }
                    $productEntries[] = OperationProduct::create([
                        'operation_id' => $operation->id,
                        'product_id' => $prod['product_id'],
                        'quantity' => $prod['quantity'],
                        'quantity_taken_from_stock' => $qtyFromStock,
                    ]);
                }
            } elseif (!empty($operation->product_id) && !empty($operation->quantity)) {
                $avail = InventoryService::getStock('product', $operation->product_id, $prodWhId);
                $qtyFromStock = 0.0;
                if ($operation->use_stock) {
                    $qtyFromStock = min((float) $operation->quantity, max(0.0, $avail));
                }
                $productEntries[] = OperationProduct::create([
                    'operation_id' => $operation->id,
                    'product_id' => $operation->product_id,
                    'quantity' => $operation->quantity,
                    'quantity_taken_from_stock' => $qtyFromStock,
                ]);
            }

            // Check if 100% of order products are fulfilled from existing stock
            $totalToManufacture = 0.0;
            foreach ($productEntries as $entry) {
                $toManuf = max(0.0, (float) $entry->quantity - (float) $entry->quantity_taken_from_stock);
                $totalToManufacture += $toManuf;
            }

            if ($totalToManufacture == 0 && count($productEntries) > 0) {
                $whFin = Warehouse::clientOrdersWarehouse();
                $targetWhId = $whFin ? $whFin->id : $warehouseId;
                $sourceWhId = $prodWhId;

                // Reserve / transfer from Showroom to Client Orders warehouse if client order
                if (!empty($validated['client_id'])) {
                    foreach ($productEntries as $entry) {
                        $fromStock = (float) $entry->quantity_taken_from_stock;
                        if ($fromStock > 0 && $targetWhId !== $sourceWhId) {
                            $prodObj = Product::find($entry->product_id);
                            $fifoProd = InventoryService::consumeFifoQuantity('product', $entry->product_id, $sourceWhId, $fromStock);
                            $unitCost = $fifoProd['blended_unit_cost'] > 0 ? $fifoProd['blended_unit_cost'] : ($prodObj ? (float) $prodObj->unit_cost : 0.0);

                            InventoryService::recordMovement(
                                warehouseId: $sourceWhId,
                                materialId: null,
                                productId: $entry->product_id,
                                movementType: 'Transfer_Out',
                                quantity: $fromStock,
                                unitCost: $unitCost,
                                referenceNumber: $operation->operation_number,
                                notes: "نقل وحجز منتج جاهز من المعرض لطلبية العميل لأمر {$operation->operation_number}",
                                userId: $user
                            );

                            InventoryService::recordMovement(
                                warehouseId: $targetWhId,
                                materialId: null,
                                productId: $entry->product_id,
                                movementType: 'Transfer_In',
                                quantity: $fromStock,
                                unitCost: $unitCost,
                                referenceNumber: $operation->operation_number,
                                notes: "استلام وحجز منتج جاهز لطلبية عميل لأمر {$operation->operation_number}",
                                userId: $user
                            );
                        }
                    }
                }

                $operation->update([
                    'status' => 'Completed',
                    'completion_date' => Carbon::now(),
                ]);
            }

            // If deposit was paid, record ClientPayment and Treasury Inflow
            if ($depositPaid > 0 && !empty($validated['client_id'])) {
                $payMethod = $validated['deposit_payment_method'] ?? 'cash';
                $clientObj = Client::find($validated['client_id']);
                $clientName = $clientObj ? $clientObj->name : 'عميل';
                $prodsSummary = collect($productEntries)->map(function($entry) {
                    $p = Product::find($entry->product_id);
                    return $p ? "{$p->name} (×{$entry->quantity})" : "منتج (×{$entry->quantity})";
                })->join(' + ');

                $clientPay = ClientPayment::create([
                    'client_id' => $validated['client_id'],
                    'amount' => $depositPaid,
                    'payment_date' => Carbon::now()->toDateString(),
                    'payment_method' => $payMethod,
                    'operation_id' => $operation->id,
                    'reference_number' => $operation->operation_number,
                    'notes' => "دفعة عربون من العميل ({$clientName}) لأمر تشغيل {$operation->operation_number}" . ($prodsSummary ? " - بنود: {$prodsSummary}" : ''),
                    'created_by' => $user,
                ]);

                TreasuryService::recordInflow(
                    amount: $depositPaid,
                    paymentMethod: $payMethod,
                    category: 'عربون أمر تشغيل',
                    description: "عربون من العميل ({$clientName}) لأمر تشغيل {$operation->operation_number}" . ($prodsSummary ? " - بنود: {$prodsSummary}" : ''),
                    sourceType: Operation::class,
                    sourceId: $operation->id,
                    referenceNumber: $operation->operation_number,
                    transactionDate: Carbon::now()->toDateString(),
                    userId: $user
                );
            }

            // Sync Client Debt
            if (!empty($validated['client_id'])) {
                $clientObj = Client::find($validated['client_id']);
                if ($clientObj) {
                    $clientObj->recalculateDebt();
                }
            }

            return response()->json([
                'message' => 'تم إنشاء أمر التشغيل بنجاح وتسجيل العربون بالخزينة.',
                'operation' => $operation->load(['client', 'operationProducts.product', 'warehouse'])
            ], 201);
        });
    }

    public function checkMaterials(string $id): JsonResponse
    {
        $operation = Operation::with(['operationProducts.product.materials', 'product.materials', 'warehouse'])->findOrFail($id);
        $whProd = Warehouse::productsWarehouse();
        $prodWhId = $whProd ? $whProd->id : $operation->warehouse_id;

        $materialsCheck = [];
        $hasShortage = false;
        $suggestions = [];
        $requiredMaterials = [];
        $productsAllocation = [];

        $items = $operation->operationProducts;
        if ($items->count() === 0 && $operation->product) {
            $items = collect([
                (object) [
                    'product' => $operation->product,
                    'quantity' => $operation->quantity ?? 1,
                    'quantity_taken_from_stock' => 0,
                ]
            ]);
        }

        foreach ($items as $item) {
            $product = $item->product;
            if (!$product)
                continue;

            $totalQty = (float) $item->quantity;
            $qtyFromStock = (float) ($item->quantity_taken_from_stock ?? 0);

            if ($qtyFromStock == 0 && $operation->use_stock && is_null($item->quantity_taken_from_stock)) {
                $availableProductStock = InventoryService::getStock('product', $product->id, $prodWhId);
                $qtyFromStock = min($totalQty, max(0.0, $availableProductStock));
            }

            $prodQty = max(0.00, $totalQty - $qtyFromStock);

            $productsAllocation[] = [
                'product_id' => $product->id,
                'product_name' => $product->name,
                'total_quantity' => $totalQty,
                'quantity_from_stock' => $qtyFromStock,
                'quantity_to_manufacture' => $prodQty,
                'unit' => $product->unit ?? 'قطعة',
            ];

            if ($prodQty <= 0)
                continue;

            foreach ($product->materials as $material) {
                if ($material->type === 'service')
                    continue;
                $req = $material->pivot->quantity * $prodQty;
                if (!isset($requiredMaterials[$material->id])) {
                    $requiredMaterials[$material->id] = ['material' => $material, 'required' => 0];
                }
                $requiredMaterials[$material->id]['required'] += $req;
            }
        }

        foreach ($requiredMaterials as $matId => $data) {
            $material = $data['material'];
            $required = $data['required'];
            $available = InventoryService::getStock('material', $material->id, $operation->warehouse_id);
            $shortage = max(0, round($required - $available, 2));

            if ($shortage > 0) {
                $hasShortage = true;
                $suggestions[] = [
                    'material_id' => $material->id,
                    'material_name' => $material->name,
                    'shortage_qty' => $shortage,
                    'unit' => $material->unit,
                    'estimated_cost' => round($shortage * (float) $material->unit_cost, 2),
                ];
            }

            $materialsCheck[] = [
                'id' => $material->id,
                'name' => $material->name,
                'sku' => $material->sku,
                'unit' => $material->unit,
                'required_quantity' => (float) $required,
                'available_quantity' => (float) $available,
                'shortage_quantity' => (float) $shortage,
            ];
        }

        return response()->json([
            'operation_id' => $operation->id,
            'operation_number' => $operation->operation_number,
            'product_name' => $items->count() === 1 ? $items->first()->product->name : 'متعدد الأصناف (' . $items->count() . ' أصناف)',
            'quantity' => (float) ($items->sum('quantity')),
            'warehouse_id' => $operation->warehouse_id,
            'warehouse_name' => $operation->warehouse->name ?? '',
            'has_shortage' => $hasShortage,
            'products_allocation' => $productsAllocation,
            'materials' => $materialsCheck,
            'suggestions' => $suggestions,
        ]);
    }

    public function startProduction(string $id): JsonResponse
    {
        $operation = Operation::findOrFail($id);

        if ($operation->status !== 'Pending') {
            return response()->json(['message' => 'يمكن بدء العمليات المعلقة فقط.'], 400);
        }

        $operation->update([
            'status' => 'In_Progress',
            'start_date' => Carbon::now()
        ]);

        return response()->json([
            'message' => 'تم بدء تنفيذ أمر الإنتاج بنجاح وتغيير حالته إلى (قيد التنفيذ).',
            'operation' => $operation
        ]);
    }

    public function completeProduction(string $id): JsonResponse
    {
        $operation = Operation::with(['operationProducts.product.materials', 'product.materials'])->findOrFail($id);

        if ($operation->status === 'Completed') {
            return response()->json([
                'message' => 'المنتجات جاهزة بالفعل بالمخزن ومكتملة للتسليم.',
                'operation' => $operation->load(['client', 'operationProducts.product'])
            ]);
        }

        if (!in_array($operation->status, ['Pending', 'In_Progress'])) {
            return response()->json(['message' => 'يمكن إكمال العمليات المعلقة أو قيد التنفيذ فقط.'], 400);
        }

        return DB::transaction(function () use ($operation) {
            $user = auth()->id();
            $whFin = Warehouse::clientOrdersWarehouse();
            $whProd = Warehouse::productsWarehouse();

            // If order has a client -> goes to WH-FIN (client orders warehouse)
            // If order is FOR STOCK / SHOWROOM (no client) -> goes directly to WSH-P (products warehouse / showroom)
            $isForStock = empty($operation->client_id);
            $targetWarehouseId = ($isForStock && $whProd)
                ? $whProd->id
                : ($whFin ? $whFin->id : $operation->warehouse_id);

            $sourceWhId = $whProd ? $whProd->id : $operation->warehouse_id;

            // 1. Prepare items to process
            $itemsToProcess = [];
            if ($operation->operationProducts && $operation->operationProducts->count() > 0) {
                foreach ($operation->operationProducts as $opProd) {
                    $product = $opProd->product;
                    if (!$product)
                        continue;

                    $totalQty = (float) $opProd->quantity;
                    $qtyFromStock = (float) ($opProd->quantity_taken_from_stock ?? 0);

                    // If quantity_taken_from_stock was not explicitly set on creation and use_stock is true
                    if ($qtyFromStock == 0 && $operation->use_stock && is_null($opProd->quantity_taken_from_stock)) {
                        $avail = InventoryService::getStock('product', $product->id, $sourceWhId);
                        $qtyFromStock = min($totalQty, max(0.0, $avail));
                        $opProd->quantity_taken_from_stock = $qtyFromStock;
                        $opProd->save();
                    }

                    $qtyToManufacture = max(0.0, $totalQty - $qtyFromStock);

                    $itemsToProcess[] = [
                        'product' => $product,
                        'totalQuantity' => $totalQty,
                        'qtyFromStock' => $qtyFromStock,
                        'qtyToManufacture' => $qtyToManufacture,
                    ];
                }
            } elseif ($operation->product) {
                $product = $operation->product;
                $totalQty = (float) ($operation->quantity ?? 1);
                $qtyFromStock = 0.0;
                $qtyToManufacture = $totalQty;

                if ($operation->use_stock) {
                    $avail = InventoryService::getStock('product', $product->id, $sourceWhId);
                    $qtyFromStock = min($totalQty, max(0.0, $avail));
                    $qtyToManufacture = max(0.0, $totalQty - $qtyFromStock);
                }

                $itemsToProcess[] = [
                    'product' => $product,
                    'totalQuantity' => $totalQty,
                    'qtyFromStock' => $qtyFromStock,
                    'qtyToManufacture' => $qtyToManufacture,
                ];
            }

            // 2. Aggregate raw materials needed
            $requiredMaterials = [];
            foreach ($itemsToProcess as $item) {
                $product = $item['product'];
                $prodQty = $item['qtyToManufacture'];
                if ($prodQty <= 0)
                    continue;

                foreach ($product->materials as $material) {
                    if ($material->type === 'service')
                        continue;
                    $req = $material->pivot->quantity * $prodQty;
                    if (!isset($requiredMaterials[$material->id])) {
                        $requiredMaterials[$material->id] = ['material' => $material, 'required' => 0];
                    }
                    $requiredMaterials[$material->id]['required'] += $req;
                }
            }

            // 3. Validate raw materials stock
            foreach ($requiredMaterials as $matId => $data) {
                $material = $data['material'];
                $required = $data['required'];
                $avail = InventoryService::getStock('material', $material->id, $operation->warehouse_id);

                if ($avail < $required) {
                    return response()->json([
                        'message' => "عذراً، لا يمكن إتمام التصنيع لعدم توفر كمية كافية من مادة ({$material->name}). المطلوب: {$required}، المتوفر: {$avail}"
                    ], 400);
                }
            }

            // 4 & 5. Consume raw materials via FIFO and receive manufactured products with true FIFO unit cost
            foreach ($itemsToProcess as $item) {
                $product = $item['product'];
                $toProduce = $item['qtyToManufacture'];
                $fromStock = $item['qtyFromStock'];

                $actualBatchTotalCost = 0.0;

                if ($toProduce > 0) {
                    // Calculate FIFO consumption of materials for this specific product
                    foreach ($product->materials as $material) {
                        $qtyNeeded = (float) ($material->pivot->quantity ?? 1) * $toProduce;
                        if ($qtyNeeded <= 0) continue;

                        if ($material->type === 'service') {
                            $serviceCost = round($qtyNeeded * (float) $material->unit_cost, 2);
                            $actualBatchTotalCost += $serviceCost;
                        } else {
                            $fifoMat = InventoryService::consumeFifoQuantity('material', $material->id, $operation->warehouse_id, $qtyNeeded);
                            $matCost = $fifoMat['total_cogs'] > 0 ? $fifoMat['total_cogs'] : round($qtyNeeded * (float) $material->unit_cost, 2);
                            $actualBatchTotalCost += $matCost;

                            if (!empty($fifoMat['consumed_layers'])) {
                                foreach ($fifoMat['consumed_layers'] as $cLayer) {
                                    InventoryService::recordMovement(
                                        warehouseId: $operation->warehouse_id,
                                        materialId: $material->id,
                                        productId: null,
                                        movementType: 'Production_Consumption',
                                        quantity: $cLayer['quantity_consumed'],
                                        unitCost: $cLayer['unit_cost'],
                                        referenceNumber: $operation->operation_number,
                                        notes: "استهلاك تصنيع FIFO - أمر {$operation->operation_number} لإنتاج {$toProduce} {$product->name}",
                                        userId: $user
                                    );
                                }
                            } else {
                                InventoryService::recordMovement(
                                    warehouseId: $operation->warehouse_id,
                                    materialId: $material->id,
                                    productId: null,
                                    movementType: 'Production_Consumption',
                                    quantity: $qtyNeeded,
                                    unitCost: (float) $material->unit_cost,
                                    referenceNumber: $operation->operation_number,
                                    notes: "استهلاك تصنيع - أمر {$operation->operation_number}",
                                    userId: $user
                                );
                            }
                        }
                    }

                    $materialUnitCost = $toProduce > 0 ? round($actualBatchTotalCost / $toProduce, 2) : 0.0;
                    $laborPerUnit = $operation->quantity > 0 ? round((float)$operation->labor_cost / (float)$operation->quantity, 2) : 0.0;
                    $actualBatchUnitCost = round($materialUnitCost + $laborPerUnit, 2);

                    if ($laborPerUnit > $materialUnitCost && $materialUnitCost > 0) {
                        \Illuminate\Support\Facades\Log::warning("Operation {$operation->operation_number} has unusual high labor cost per unit", [
                            'labor_per_unit' => $laborPerUnit,
                            'material_unit_cost' => $materialUnitCost
                        ]);
                    }

                    InventoryService::recordMovement(
                        warehouseId: $targetWarehouseId,
                        materialId: null,
                        productId: $product->id,
                        movementType: 'Production_Receipt',
                        quantity: $toProduce,
                        unitCost: $actualBatchUnitCost,
                        referenceNumber: $operation->operation_number,
                        notes: "توريد إنتاج تام FIFO (تكلفة حقيقية) - أمر تشغيل {$operation->operation_number}",
                        userId: $user
                    );
                }

                // If taken from pre-existing stock and target warehouse differs, transfer between them
                if ($fromStock > 0 && $targetWarehouseId !== $sourceWhId) {
                    $fifoStock = InventoryService::consumeFifoQuantity('product', $product->id, $sourceWhId, $fromStock);
                    $stockUnitCost = $fifoStock['blended_unit_cost'] > 0 ? $fifoStock['blended_unit_cost'] : (float) $product->unit_cost;

                    InventoryService::recordMovement(
                        warehouseId: $sourceWhId,
                        materialId: null,
                        productId: $product->id,
                        movementType: 'Transfer_Out',
                        quantity: $fromStock,
                        unitCost: $stockUnitCost,
                        referenceNumber: $operation->operation_number,
                        notes: "نقل منتج جاهز من المخزن إلى طلبيات العملاء لأمر {$operation->operation_number}",
                        userId: $user
                    );

                    InventoryService::recordMovement(
                        warehouseId: $targetWarehouseId,
                        materialId: null,
                        productId: $product->id,
                        movementType: 'Transfer_In',
                        quantity: $fromStock,
                        unitCost: $stockUnitCost,
                        referenceNumber: $operation->operation_number,
                        notes: "استلام منتج جاهز لتغطية طلبية عميل لأمر {$operation->operation_number}",
                        userId: $user
                    );
                }
            }

            $operation->update([
                'status' => 'Completed',
                'completion_date' => Carbon::now()
            ]);

            return response()->json([
                'message' => 'تم إتمام عملية الإنتاج بنجاح وتجهيز المنتجات للعميل واستهلاك المواد الخام.',
                'operation' => $operation->load(['client', 'operationProducts.product'])
            ]);
        });
    }

    public function deliverToClient(string $id): JsonResponse
    {
        $operation = Operation::with(['operationProducts.product', 'client'])->findOrFail($id);

        if ($operation->status !== 'Completed') {
            return response()->json(['message' => 'يمكن تسليم أوامر الإنتاج المكتملة فقط للعملاء.'], 400);
        }

        return DB::transaction(function () use ($operation) {
            $user = auth()->id();
            $whFin = Warehouse::clientOrdersWarehouse();
            $targetWarehouseId = $whFin ? $whFin->id : $operation->warehouse_id;
            $whProd = Warehouse::productsWarehouse();
            $prodWarehouseId = $whProd ? $whProd->id : $operation->warehouse_id;

            $items = $operation->operationProducts;
            if ($items->count() === 0 && $operation->product) {
                $items = collect([
                    (object) [
                        'product' => $operation->product,
                        'product_id' => $operation->product_id,
                        'quantity' => $operation->quantity ?? 1,
                    ]
                ]);
            }

            $totalCogs = 0.0;
            $itemsData = [];

            foreach ($items as $opProd) {
                $product = $opProd->product;
                if (!$product)
                    continue;

                $qty = (float) $opProd->quantity;

                // Determine deduct warehouse
                $availInFin = InventoryService::getStock('product', $product->id, $targetWarehouseId);
                $actualWh = $availInFin >= $qty ? $targetWarehouseId : $prodWarehouseId;

                // FIFO Consumption Calculation
                $fifoResult = InventoryService::consumeFifoQuantity('product', $product->id, $actualWh, $qty);
                $unitCost = $fifoResult['blended_unit_cost'] > 0 ? $fifoResult['blended_unit_cost'] : (float) $product->unit_cost;
                $itemCost = $fifoResult['total_cogs'] > 0 ? $fifoResult['total_cogs'] : round($qty * $unitCost, 2);
                $totalCogs += $itemCost;

                InventoryService::recordMovement(
                    warehouseId: $actualWh,
                    materialId: null,
                    productId: $product->id,
                    movementType: 'Sales_Issue',
                    quantity: $qty,
                    unitCost: $unitCost,
                    referenceNumber: $operation->operation_number,
                    notes: "تسليم طلبية للعميل (" . ($operation->client->name ?? 'عميل') . ") - أمر {$operation->operation_number}",
                    userId: $user
                );

                $itemsData[] = [
                    'product' => $product,
                    'quantity' => $qty,
                    'unit_cost' => $unitCost,
                    'total_cost' => $itemCost,
                    'consumed_layers' => $fifoResult['consumed_layers'] ?? [],
                ];
            }

            $totalPrice = (float) ($operation->total_price ?? $totalCogs);
            $totalPaid = (float) ($operation->deposit_paid ?? 0) + (float) $operation->payments()->sum('amount_paid');
            $remaining = max(0.0, round($totalPrice - $totalPaid, 2));

            // Create Sales Invoice for delivery
            $invNo = SalesInvoice::generateNextInvoiceNumber('INV');
            $invoice = SalesInvoice::create([
                'invoice_number' => $invNo,
                'invoice_date' => Carbon::now()->toDateString(),
                'client_id' => $operation->client_id,
                'invoice_type' => 'order_delivery',
                'total_amount' => $totalPrice,
                'total_cogs' => $totalCogs,
                'paid_amount' => min($totalPaid, $totalPrice),
                'remaining_amount' => $remaining,
                'payment_method' => $operation->deposit_payment_method ?? 'cash',
                'operation_id' => $operation->id,
                'notes' => "تسليم طلبية لأمر التشغيل {$operation->operation_number}",
                'created_by' => $user,
            ]);

            $unitSalePrice = $items->count() > 0 ? round($totalPrice / $items->sum('quantity'), 2) : $totalPrice;
            foreach ($itemsData as $iData) {
                SalesInvoiceItem::create([
                    'sales_invoice_id' => $invoice->id,
                    'product_id' => $iData['product']->id,
                    'quantity' => $iData['quantity'],
                    'unit_sale_price' => $unitSalePrice,
                    'unit_cost' => $iData['unit_cost'],
                    'total_sale_price' => round($iData['quantity'] * $unitSalePrice, 2),
                    'total_cost' => $iData['total_cost'],
                ]);
            }

            // Sync client debt
            if ($operation->client) {
                $operation->client->recalculateDebt();
            }

            $operation->update(['status' => 'Delivered']);

            return response()->json([
                'message' => 'تم تسليم الطلبية للعميل بنجاح، وخصم المنتجات من المستودع، وإصدار فاتورة التسليم.',
                'operation' => $operation,
                'invoice' => $invoice,
            ]);
        });
    }

    public function addPayment(Request $request, string $id): JsonResponse
    {
        $operation = Operation::findOrFail($id);

        $validated = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'payment_date' => 'required|date',
            'note' => 'nullable|string',
            'receipt' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:5120',
            'payment_method' => 'nullable|string|in:cash,instapay,vodafone_cash,bank_transfer,postal_transfer',
        ]);

        return DB::transaction(function () use ($operation, $validated, $request) {
            $user = auth()->id();
            $receiptPath = null;
            if ($request->hasFile('receipt')) {
                $path = $request->file('receipt')->store('receipts', 'public');
                $receiptPath = '/storage/' . $path;
            }

            $amount = (float) $validated['amount'];
            $payMethod = $validated['payment_method'] ?? 'cash';

            $payment = OperationPayment::create([
                'operation_id' => $operation->id,
                'amount_paid' => $amount,
                'payment_date' => $validated['payment_date'],
                'notes' => $validated['note'] ?? null,
                'receipt_path' => $receiptPath,
                'payment_method' => $payMethod,
            ]);

            $clientName = $operation->client ? $operation->client->name : 'عميل';
            $prodsSummary = $operation->operationProducts ? $operation->operationProducts->map(fn($opP) => ($opP->product?->name ?? 'منتج') . " (×{$opP->quantity})")->join(' + ') : '';

            // Also create ClientPayment record if client exists
            if ($operation->client_id) {
                ClientPayment::create([
                    'client_id' => $operation->client_id,
                    'amount' => $amount,
                    'payment_date' => $validated['payment_date'],
                    'payment_method' => $payMethod,
                    'operation_id' => $operation->id,
                    'reference_number' => $operation->operation_number,
                    'notes' => "دفعة مرحلية من العميل ({$clientName}) لأمر تشغيل {$operation->operation_number}" . ($prodsSummary ? " - بنود: {$prodsSummary}" : ''),
                    'receipt_path' => $receiptPath,
                    'created_by' => $user,
                ]);

                if ($operation->client) {
                    $operation->client->recalculateDebt();
                }
            }

            // Sync with associated SalesInvoice if already delivered
            $invoice = SalesInvoice::where('operation_id', $operation->id)->first();
            if ($invoice) {
                $invoice->paid_amount = min((float) $invoice->total_amount, (float) $invoice->paid_amount + $amount);
                $invoice->remaining_amount = max(0.0, (float) $invoice->total_amount - (float) $invoice->paid_amount);
                $invoice->save();
            }

            // Record Treasury Inflow
            TreasuryService::recordInflow(
                amount: $amount,
                paymentMethod: $payMethod,
                category: 'دفعة مرحلية من عميل',
                description: "دفعة من العميل ({$clientName}) لأمر تشغيل {$operation->operation_number}" . ($prodsSummary ? " - بنود: {$prodsSummary}" : '') . ($validated['note'] ? " - {$validated['note']}" : ''),
                sourceType: OperationPayment::class,
                sourceId: $payment->id,
                referenceNumber: $operation->operation_number,
                transactionDate: $validated['payment_date'],
                receiptPath: $receiptPath,
                userId: $user
            );

            return response()->json([
                'message' => 'تم تسجيل الدفعة بنجاح وتحديث رصيد الخزينة وحساب العميل',
                'payment' => $payment
            ], 201);
        });
    }

    public function deletePayment(string $id, string $paymentId): JsonResponse
    {
        $operation = Operation::findOrFail($id);
        $payment = OperationPayment::where('operation_id', $operation->id)->findOrFail($paymentId);

        return DB::transaction(function () use ($operation, $payment) {
            $amount = (float) $payment->amount_paid;

            // Revert linked SalesInvoice
            $invoice = SalesInvoice::where('operation_id', $operation->id)->first();
            if ($invoice) {
                $invoice->paid_amount = max(0.0, (float) $invoice->paid_amount - $amount);
                $invoice->remaining_amount = min((float) $invoice->total_amount, (float) $invoice->total_amount - (float) $invoice->paid_amount);
                $invoice->save();
            }

            // Revert Treasury Inflow
            TreasuryService::revertBySource(OperationPayment::class, $payment->id);
            $payment->delete();

            // Re-sync Client debt
            if ($operation->client_id && $operation->client) {
                $operation->client->recalculateDebt();
            }

            return response()->json(['message' => 'تم إلغاء الدفعة والتراجع عن القيد المالي بالخزينة وحساب العميل بنجاح.']);
        });
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $operation = Operation::findOrFail($id);

        if ($operation->status !== 'Pending') {
            return response()->json(['message' => 'يمكن تعديل العمليات المعلقة فقط.'], 400);
        }

        $validated = $request->validate([
            'warehouse_id' => 'nullable|exists:warehouses,id',
            'client_id' => 'nullable|exists:clients,id',
            'notes' => 'nullable|string',
            'total_price' => 'nullable|numeric|min:0',
        ]);

        $operation->update($validated);

        return response()->json([
            'message' => 'تم تحديث أمر الإنتاج بنجاح',
            'operation' => $operation->load(['client', 'warehouse'])
        ]);
    }

    public function cancelProduction(Request $request, string $id): JsonResponse
    {
        $operation = Operation::with(['operationProducts.product.materials', 'payments'])->findOrFail($id);

        if ($operation->status === 'Cancelled') {
            return response()->json(['message' => 'هذا الأمر ملغى بالفعل.'], 400);
        }

        if ($operation->status === 'Delivered') {
            return response()->json(['message' => 'لا يمكن إلغاء أمر إنتاج تم تسليمه للعميل بالفعل.'], 400);
        }

        $refundDeposit = $request->boolean('refund_deposit', false);
        $wasCompleted = $operation->status === 'Completed';

        return DB::transaction(function () use ($operation, $refundDeposit, $wasCompleted) {
            $user = auth()->id();
            $whFin = Warehouse::clientOrdersWarehouse();
            $targetFinId = $whFin ? $whFin->id : $operation->warehouse_id;
            $whProd = Warehouse::productsWarehouse();
            $targetProdId = $whProd ? $whProd->id : $operation->warehouse_id;

            if ($wasCompleted) {
                // Option 2: Products were already manufactured. Transfer them from WH-FIN to WSH-P (Showroom)
                $items = $operation->operationProducts;
                if ($items->count() === 0 && $operation->product) {
                    $items = collect([
                        (object) [
                            'product' => $operation->product,
                            'product_id' => $operation->product_id,
                            'quantity' => $operation->quantity ?? 1,
                        ]
                    ]);
                }

                foreach ($items as $opProd) {
                    $product = $opProd->product;
                    if (!$product)
                        continue;

                    $qty = (float) $opProd->quantity;
                    $unitCost = (float) $product->unit_cost;

                    // 1. Transfer Out of WH-FIN (Release client reservation)
                    InventoryService::recordMovement(
                        warehouseId: $targetFinId,
                        materialId: null,
                        productId: $product->id,
                        movementType: 'Transfer_Out',
                        quantity: $qty,
                        unitCost: $unitCost,
                        referenceNumber: $operation->operation_number,
                        notes: "تحويل منتجات أمر ملغى ({$operation->operation_number}) من مستودع الطلبيات إلى مستودع المنتجات الجاهزة",
                        userId: $user
                    );

                    // 2. Transfer In to WSH-P (Available for sale in Showroom)
                    InventoryService::recordMovement(
                        warehouseId: $targetProdId,
                        materialId: null,
                        productId: $product->id,
                        movementType: 'Transfer_In',
                        quantity: $qty,
                        unitCost: $unitCost,
                        referenceNumber: $operation->operation_number,
                        notes: "استلام منتجات أمر ملغى ({$operation->operation_number}) كبضاعة جاهزة للبيع بالمعرض",
                        userId: $user
                    );
                }
            } else {
                // Pending / In_Progress: Revert any staged movements
                $movements = \App\Models\InventoryMovement::where('reference_number', $operation->operation_number)->get();
                foreach ($movements as $m) {
                    $m->delete();
                    InventoryService::syncCachedStock($m->material_id, $m->product_id);
                }
            }

            // Handle Deposit / Payments
            if ($refundDeposit) {
                TreasuryService::revertBySource(Operation::class, $operation->id);
                foreach ($operation->payments as $pay) {
                    TreasuryService::revertBySource(OperationPayment::class, $pay->id);
                }
                $operation->payments()->delete();
            }

            $operation->update(['status' => 'Cancelled']);

            if ($operation->client) {
                $operation->client->recalculateDebt();
            }

            $msg = $wasCompleted
                ? 'تم إلغاء أمر التشغيل بنجاح، ونقل المنتجات المصنعة إلى مستودع المنتجات الجاهزة (المعرض) لتصبح متاحة للبيع لأي عميل آخر.'
                : 'تم إلغاء أمر التشغيل والتراجع عن القيود بنجاح.';

            return response()->json([
                'message' => $msg,
                'operation' => $operation
            ]);
        });
    }

    public function destroy(string $id): JsonResponse
    {
        $operation = Operation::with(['payments'])->findOrFail($id);

        return DB::transaction(function () use ($operation) {
            $client = $operation->client;

            // Revert inventory & treasury only if order was NOT completed/delivered
            if (!in_array($operation->status, ['Completed', 'Delivered'])) {
                $movements = \App\Models\InventoryMovement::where('reference_number', $operation->operation_number)->get();
                foreach ($movements as $m) {
                    $m->delete();
                    InventoryService::syncCachedStock($m->material_id, $m->product_id);
                }
            }

            TreasuryService::revertBySource(Operation::class, $operation->id);
            foreach ($operation->payments as $pay) {
                TreasuryService::revertBySource(OperationPayment::class, $pay->id);
            }

            $operation->payments()->delete();
            $operation->operationProducts()->delete();
            $operation->forceDelete();

            if ($client) {
                $client->recalculateDebt();
            }

            return response()->json(['message' => 'تم حذف أمر الإنتاج بنجاح.']);
        });
    }

    private function generateOperationNumber(): string
    {
        $year = Carbon::now()->year;
        $prefix = "OP-{$year}-";

        $existing = Operation::withTrashed()
            ->where('operation_number', 'LIKE', "{$prefix}%")
            ->pluck('operation_number')
            ->map(function ($num) use ($prefix) {
                $suffix = substr($num, strlen($prefix));
                return is_numeric($suffix) ? (int) $suffix : 0;
            });

        $maxSeq = $existing->isNotEmpty() ? $existing->max() : 0;
        $nextSeq = $maxSeq + 1;
        $opNo = $prefix . str_pad($nextSeq, 4, '0', STR_PAD_LEFT);

        while (
            Operation::withTrashed()->where('operation_number', $opNo)->exists() ||
            DB::table('operations')->where('operation_number', $opNo)->exists()
        ) {
            $nextSeq++;
            $opNo = $prefix . str_pad($nextSeq, 4, '0', STR_PAD_LEFT);
        }

        return $opNo;
    }
}
