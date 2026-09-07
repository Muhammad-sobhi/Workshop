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
use App\Services\OperationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class OperationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 20);
        $operations = Operation::with([
            'product.category',
            'warehouse',
            'client',
            'operationProducts.product.materials',
            'payments',
            'childOperations',          // BUG-2: expose sub/child operations
        ])
            ->whereNull('parent_operation_id')  // Only top-level operations in list
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
        $operation = Operation::with([
            'operationProducts.product.materials',
            'operationProducts.product.bomItems.subProduct.materials',
            'product.materials',
            'product.bomItems.subProduct.materials',
            'warehouse'
        ])->findOrFail($id);

        $whProd = Warehouse::productsWarehouse();
        $prodWhId = $whProd ? $whProd->id : $operation->warehouse_id;
        $rawWhId = $operation->warehouse_id;

        $productsAllocation = [];
        $requiredSubProducts = [];
        $directMaterials = [];

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

            // 1. Sub-products in BOM
            $subBomLines = $product->bomItems->whereNotNull('sub_product_id');
            foreach ($subBomLines as $bomLine) {
                $subProduct = $bomLine->subProduct;
                if (!$subProduct) continue;
                $subId = $subProduct->id;
                $req = (float) $bomLine->quantity * $prodQty;
                if (!isset($requiredSubProducts[$subId])) {
                    $requiredSubProducts[$subId] = [
                        'product' => $subProduct,
                        'required' => 0.0,
                    ];
                }
                $requiredSubProducts[$subId]['required'] += $req;
            }

            // 2. Direct materials in BOM
            foreach ($product->materials as $material) {
                if ($material->type === 'service')
                    continue;
                $req = (float) $material->pivot->quantity * $prodQty;
                if (!isset($directMaterials[$material->id])) {
                    $directMaterials[$material->id] = [
                        'material' => $material,
                        'required' => 0.0,
                    ];
                }
                $directMaterials[$material->id]['required'] += $req;
            }
        }

        // Evaluate Sub-products availability & raw materials needed for shortages
        $subProductsCheck = [];
        $materialsForSubs = [];
        $hasSubProductShortage = false;
        $allSubShortagesCanBeProduced = true;

        foreach ($requiredSubProducts as $subId => $data) {
            $subProduct = $data['product'];
            $required = (float) $data['required'];
            $available = (float) InventoryService::getStock('product', $subId, $prodWhId);
            $shortage = max(0.0, round($required - $available, 2));

            $materialsNeededForShortage = [];
            $canProduceThisSub = true;

            if ($shortage > 0) {
                $hasSubProductShortage = true;
                foreach ($subProduct->materials as $mat) {
                    if ($mat->type === 'service') continue;
                    $matNeeded = round((float) $mat->pivot->quantity * $shortage, 2);
                    $matAvail = (float) InventoryService::getStock('material', $mat->id, $rawWhId);
                    $matShort = max(0.0, round($matNeeded - $matAvail, 2));

                    if ($matShort > 0) {
                        $canProduceThisSub = false;
                        $allSubShortagesCanBeProduced = false;
                    }

                    $materialsNeededForShortage[] = [
                        'material_id' => $mat->id,
                        'name' => $mat->name,
                        'sku' => $mat->sku,
                        'unit' => $mat->unit,
                        'required_quantity' => $matNeeded,
                        'available_quantity' => $matAvail,
                        'shortage_quantity' => $matShort,
                        'is_sufficient' => $matAvail >= $matNeeded,
                    ];

                    if (!isset($materialsForSubs[$mat->id])) {
                        $materialsForSubs[$mat->id] = [
                            'material' => $mat,
                            'required' => 0.0,
                            'for_subs' => [],
                        ];
                    }
                    $materialsForSubs[$mat->id]['required'] += $matNeeded;
                    $materialsForSubs[$mat->id]['for_subs'][] = [
                        'sub_name' => $subProduct->name,
                        'sub_shortage' => $shortage,
                        'qty' => $matNeeded,
                    ];
                }
            }

            $subProductsCheck[] = [
                'id' => $subProduct->id,
                'name' => $subProduct->name,
                'sku' => $subProduct->sku,
                'unit' => $subProduct->unit ?? 'قطعة',
                'required_quantity' => $required,
                'available_quantity' => $available,
                'shortage_quantity' => $shortage,
                'can_produce' => $canProduceThisSub,
                'materials_needed' => $materialsNeededForShortage,
            ];
        }

        // Consolidated raw materials (direct + needed for sub-products)
        $consolidatedMaterials = [];
        $directMaterialsCheck = [];
        $suggestions = [];
        $hasMaterialShortage = false;

        $allMaterialIds = array_unique(array_merge(array_keys($directMaterials), array_keys($materialsForSubs)));

        foreach ($allMaterialIds as $matId) {
            $mat = $directMaterials[$matId]['material'] ?? $materialsForSubs[$matId]['material'];
            $dirReq = (float) ($directMaterials[$matId]['required'] ?? 0.0);
            $subReq = (float) ($materialsForSubs[$matId]['required'] ?? 0.0);
            $totReq = round($dirReq + $subReq, 2);
            $avail = (float) InventoryService::getStock('material', $mat->id, $rawWhId);
            $shortage = max(0.0, round($totReq - $avail, 2));

            if ($shortage > 0) {
                $hasMaterialShortage = true;
                $suggestions[] = [
                    'material_id' => $mat->id,
                    'material_name' => $mat->name,
                    'shortage_qty' => $shortage,
                    'unit' => $mat->unit,
                    'estimated_cost' => round($shortage * (float) $mat->unit_cost, 2),
                ];
            }

            $entry = [
                'id' => $mat->id,
                'name' => $mat->name,
                'sku' => $mat->sku,
                'unit' => $mat->unit,
                'direct_quantity' => $dirReq,
                'sub_products_quantity' => $subReq,
                'required_quantity' => $totReq,
                'available_quantity' => $avail,
                'shortage_quantity' => $shortage,
            ];

            $consolidatedMaterials[] = $entry;

            if ($dirReq > 0) {
                $directMaterialsCheck[] = [
                    'id' => $mat->id,
                    'name' => $mat->name,
                    'sku' => $mat->sku,
                    'unit' => $mat->unit,
                    'required_quantity' => $dirReq,
                    'available_quantity' => $avail,
                    'shortage_quantity' => max(0.0, round($dirReq - $avail, 2)),
                ];
            }
        }

        // GAP-5: Cost of sub-products that will be drawn from EXISTING STOCK (not newly manufactured)
        $subProductsFromStock = [];
        foreach ($requiredSubProducts as $subId => $data) {
            $subProduct = $data['product'];
            $required   = (float) $data['required'];
            $available  = (float) InventoryService::getStock('product', $subId, $prodWhId);
            $fromStock  = min($required, $available); // amount taken from existing stock

            if ($fromStock > 0) {
                $fifoLayers = InventoryService::getFifoLayers('product', $subId, $prodWhId);
                $stockCost  = 0.0;
                $remaining  = $fromStock;
                foreach ($fifoLayers as $layer) {
                    if ($remaining <= 0) break;
                    $take       = min($remaining, (float)$layer['remaining_quantity']);
                    $stockCost += $take * (float)$layer['unit_cost'];
                    $remaining -= $take;
                }
                $subProductsFromStock[] = [
                    'id'                  => $subProduct->id,
                    'name'                => $subProduct->name,
                    'sku'                 => $subProduct->sku,
                    'unit'                => $subProduct->unit ?? 'قطعة',
                    'quantity_from_stock' => $fromStock,
                    'fifo_cost'           => round($stockCost, 2),
                    'avg_unit_cost'       => $fromStock > 0 ? round($stockCost / $fromStock, 2) : 0.0,
                ];
            }
        }

        $hasShortage = $hasMaterialShortage || ($hasSubProductShortage && !$allSubShortagesCanBeProduced);

        return response()->json([
            'operation_id'                  => $operation->id,
            'operation_number'              => $operation->operation_number,
            'product_name'                  => $items->count() === 1 ? $items->first()->product->name : 'متعدد الأصناف (' . $items->count() . ' أصناف)',
            'quantity'                      => (float) ($items->sum('quantity')),
            'warehouse_id'                  => $operation->warehouse_id,
            'warehouse_name'                => $operation->warehouse->name ?? '',
            'has_shortage'                  => $hasShortage,
            'has_material_shortage'         => $hasMaterialShortage,
            'has_sub_product_shortage'      => $hasSubProductShortage,
            'can_auto_produce_sub_products' => $hasSubProductShortage && $allSubShortagesCanBeProduced && !$hasMaterialShortage,
            'products_allocation'           => $productsAllocation,
            'sub_products'                  => $subProductsCheck,
            'sub_products_from_stock'       => $subProductsFromStock,   // GAP-5: cost of existing stock
            'direct_materials'              => $directMaterialsCheck,
            'materials'                     => $consolidatedMaterials,
            'suggestions'                   => $suggestions,
        ]);
    }

    /**
     * GET /api/operations/{id}/bom-tree
     *
     * BUG-1 Fix: Returns full recursive BOM tree for all products in this operation.
     * Used by the frontend to display what's needed before starting production.
     */
    public function bomTree(string $id): JsonResponse
    {
        $operation = Operation::with([
            'operationProducts.product.materials',
            'operationProducts.product.bomItems.subProduct.materials',
            'operationProducts.product.bomItems.subProduct.bomItems.subProduct',
            'product.materials',
            'product.bomItems.subProduct.materials',
        ])->findOrFail($id);

        $whProd   = Warehouse::productsWarehouse();
        $prodWhId = $whProd ? $whProd->id : $operation->warehouse_id;
        $rawWhId  = $operation->warehouse_id;

        $items = $operation->operationProducts;
        if ($items->count() === 0 && $operation->product) {
            $items = collect([(object)[
                'product'  => $operation->product,
                'quantity' => $operation->quantity ?? 1,
                'quantity_taken_from_stock' => 0,
            ]]);
        }

        $tree = [];
        foreach ($items as $item) {
            $product = $item->product;
            if (!$product) continue;
            $tree[] = [
                'product_id'   => $product->id,
                'name'         => $product->name,
                'sku'          => $product->sku,
                'unit'         => $product->unit ?? 'قطعة',
                'quantity'     => (float) $item->quantity,
                'stock'        => InventoryService::getStock('product', $product->id, $prodWhId),
                'bom'          => $this->buildBomTree($product, $prodWhId, $rawWhId),
            ];
        }

        return response()->json(['operation_id' => $operation->id, 'bom_tree' => $tree]);
    }

    private function buildBomTree(Product $product, int $prodWhId, int $rawWhId, int $depth = 0): array
    {
        if ($depth > 10) return [];

        $nodes = [];

        // Sub-products
        foreach ($product->bomItems()->whereNotNull('sub_product_id')->with(['subProduct.materials', 'subProduct.bomItems.subProduct'])->get() as $bomLine) {
            $sub = $bomLine->subProduct;
            if (!$sub) continue;
            $nodes[] = [
                'type'       => 'sub_product',
                'id'         => $sub->id,
                'name'       => $sub->name,
                'sku'        => $sub->sku,
                'unit'       => $sub->unit ?? 'قطعة',
                'qty_per_parent' => (float) $bomLine->quantity,
                'stock'      => InventoryService::getStock('product', $sub->id, $prodWhId),
                'unit_cost'  => (float) $sub->unit_cost,
                'children'   => $this->buildBomTree($sub, $prodWhId, $rawWhId, $depth + 1),
            ];
        }

        // Direct raw materials
        foreach ($product->materials as $mat) {
            if ($mat->type === 'service') continue;
            $nodes[] = [
                'type'           => 'material',
                'id'             => $mat->id,
                'name'           => $mat->name,
                'sku'            => $mat->sku,
                'unit'           => $mat->unit,
                'qty_per_parent' => (float) $mat->pivot->quantity,
                'stock'          => InventoryService::getStock('material', $mat->id, $rawWhId),
                'unit_cost'      => (float) $mat->unit_cost,
                'children'       => [],
            ];
        }

        return $nodes;
    }

    /**
     * POST /api/operations/{id}/readiness-check
     *
     * Returns whether the operation can be completed right now:
     * - can_complete: true → safe to call completeProduction directly
     * - missing_sub_products with can_produce: true → show 'auto-produce and complete' button
     * - missing_materials → hard blocker, show material shortage error
     */
    public function readinessCheck(string $id): JsonResponse
    {
        $operation = Operation::with([
            'operationProducts.product.materials',
            'operationProducts.product.bomItems.subProduct.materials',
            'product.materials',
            'product.bomItems.subProduct.materials',
        ])->findOrFail($id);

        $result = OperationService::checkReadiness($operation);

        return response()->json($result);
    }

    public function startProduction(Request $request, string $id): JsonResponse
    {
        $operation = Operation::findOrFail($id);

        if ($operation->status !== 'Pending') {
            return response()->json(['message' => 'يمكن بدء العمليات المعلقة فقط.'], 400);
        }

        $autoProduce = $request->boolean('auto_produce_sub_products');

        try {
            DB::transaction(function () use ($operation, $autoProduce) {
                if ($autoProduce) {
                    // Must run BEFORE startProduction which now issues materials;
                    // autoProduceSubProducts brings shortfall sub-products into WSH-P first
                    OperationService::autoProduceSubProducts($operation);
                }
                // startProduction now also issues (consumes) raw materials and sub-products
                OperationService::startProduction($operation);
            });
        } catch (\Exception $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'message' => $autoProduce
                ? 'تم تصنيع المنتجات الفرعية المطلوبة وصرف خاماتها، وبدء أمر الإنتاج وإصدار المواد للإنتاج.'
                : 'تم بدء تنفيذ أمر الإنتاج وإصدار المواد للإنتاج (الحالة: قيد التنفيذ).',
            'operation' => $operation->fresh(['client', 'operationProducts.product', 'warehouse', 'childOperations'])
        ]);
    }

    public function completeProduction(Request $request, string $id): JsonResponse
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

        $validated = $request->validate([
            'waste_materials'              => 'nullable|array',
            'waste_materials.*.material_id'=> 'required|exists:materials,id',
            'waste_materials.*.quantity'   => 'required|numeric|min:0.01',
            'waste_materials.*.notes'      => 'nullable|string',
            // When true: auto-produce any missing sub-products first, then complete
            'auto_produce_sub_products'    => 'nullable|boolean',
        ]);

        $autoProduceSubs = (bool) ($validated['auto_produce_sub_products'] ?? false);

        try {
            DB::transaction(function () use ($operation, $validated, $autoProduceSubs) {
                // Auto-produce missing sub-products only if the operation has not started yet (Pending).
                // If it is already In_Progress, all sub-products were already issued/consumed at startProduction.
                if ($autoProduceSubs && $operation->status === 'Pending') {
                    OperationService::autoProduceSubProducts($operation);
                }

                // Complete production
                OperationService::completeProduction($operation);

                // Handle waste logging
                if (!empty($validated['waste_materials'])) {
                    $whWaste = \App\Models\Warehouse::where('code', 'WSH-WASTE')->first();
                    $whRaw = \App\Models\Warehouse::rawMaterialsWarehouse() ?? \App\Models\Warehouse::first();
                    
                    if (!$whWaste) {
                        throw new \InvalidArgumentException('مخزن الهالك (WSH-WASTE) غير موجود في قاعدة البيانات.');
                    }

                    foreach ($validated['waste_materials'] as $waste) {
                        $material = \App\Models\Material::findOrFail($waste['material_id']);
                        $avail = \App\Services\InventoryService::getStock('material', $material->id, $whRaw->id);
                        $qty = (float) $waste['quantity'];

                        if ($avail < $qty) {
                            throw new \InvalidArgumentException("عذراً، كمية الهالك المسجلة للمادة ({$material->name}) تتجاوز المخزون المتاح في مخزن الخامات. المتاح: {$avail} {$material->unit}");
                        }

                        $unitCost = (float)$material->calculateStoredUnitCost();

                        // 1. Deduct from Raw Materials (WSH-M)
                        \App\Services\InventoryService::recordMovement(
                            warehouseId: $whRaw->id,
                            materialId: $material->id,
                            productId: null,
                            movementType: 'Production_Waste',
                            quantity: $qty,
                            unitCost: $unitCost,
                            referenceNumber: $operation->operation_number,
                            notes: "هالك تصنيع لأمر التشغيل {$operation->operation_number}" . (empty($waste['notes']) ? '' : " - {$waste['notes']}"),
                            userId: auth()->id()
                        );

                        // 2. Add to Waste Warehouse (WSH-WASTE)
                        \App\Services\InventoryService::recordMovement(
                            warehouseId: $whWaste->id,
                            materialId: $material->id,
                            productId: null,
                            movementType: 'Waste_Receipt',
                            quantity: $qty,
                            unitCost: $unitCost,
                            referenceNumber: $operation->operation_number,
                            notes: "استلام هالك تصنيع من أمر التشغيل {$operation->operation_number}" . (empty($waste['notes']) ? '' : " - {$waste['notes']}"),
                            userId: auth()->id()
                        );
                    }
                }
            });
            $operation->refresh();
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422); // Changed to 422 per plan
        }

        return response()->json([
            'message' => 'تم إتمام عملية الإنتاج بنجاح وتجهيز المنتجات للعميل واستهلاك المواد الخام' . (!empty($validated['waste_materials']) ? ' وتسجيل الهالك.' : '.'),
            'operation' => $operation
        ]);
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
        $operation = Operation::with(['operationProducts.product', 'payments', 'client', 'warehouse'])->findOrFail($id);

        $validated = $request->validate([
            'warehouse_id' => 'nullable|exists:warehouses,id',
            'client_id' => 'nullable|exists:clients,id',
            'deposit_paid' => 'nullable|numeric|min:0',
            'deposit_payment_method' => 'nullable|string|in:cash,instapay,vodafone_cash,bank_transfer,postal_transfer',
            'use_stock' => 'nullable|boolean',
            'total_price' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string',
            'products' => 'nullable|array',
            'products.*.product_id' => 'required|exists:products,id',
            'products.*.quantity' => 'required|numeric|min:0.01',
            'products.*.quantity_taken_from_stock' => 'nullable|numeric|min:0',
        ]);

        return DB::transaction(function () use ($operation, $validated) {
            $user = auth()->id();
            $oldStatus = $operation->status;
            $oldClientId = $operation->client_id;
            
            // 1. Revert Old Inventory if Completed/Delivered
            if (in_array($oldStatus, ['Completed', 'Delivered'])) {
                $movements = \App\Models\InventoryMovement::where('reference_number', $operation->operation_number)->get();
                foreach ($movements as $m) {
                    $reverseType = '';
                    if ($m->movement_type === 'Production_Consumption') $reverseType = 'Waste_Receipt'; // Return materials
                    if ($m->movement_type === 'Production_Receipt') $reverseType = 'Damaged'; // Return products (decrease)
                    if ($m->movement_type === 'Transfer_Out') $reverseType = 'Transfer_In';
                    if ($m->movement_type === 'Transfer_In') $reverseType = 'Transfer_Out';

                    if ($reverseType) {
                        InventoryService::recordMovement(
                            warehouseId: $m->warehouse_id,
                            materialId: $m->material_id,
                            productId: $m->product_id,
                            movementType: $reverseType,
                            quantity: $m->quantity,
                            unitCost: $m->unit_cost,
                            referenceNumber: 'RET-' . $operation->operation_number,
                            notes: "[تعديل - إلغاء قيد] عكس حركة {$m->movement_type} لأمر تشغيل {$operation->operation_number}",
                            movementDate: now()->toDateTimeString(),
                            userId: $user
                        );
                    }
                }
            }

            // 2. Revert Old Treasury (only the initial deposit, not subsequent payments)
            TreasuryService::revertBySource(Operation::class, $operation->id);
            // We also delete the specific ClientPayment row that matches this operation without an invoice
            // Actually, `deposit_paid` was logged via ClientPayment as well.
            // Let's find the initial deposit ClientPayment
            $initialDepositPayment = ClientPayment::where('operation_id', $operation->id)
                ->where('amount', $operation->deposit_paid)
                ->first();
            if ($initialDepositPayment) {
                TreasuryService::revertBySource(ClientPayment::class, $initialDepositPayment->id);
                $initialDepositPayment->delete();
            }

            // 3. Update Record
            $warehouseId = $validated['warehouse_id'] ?? $operation->warehouse_id;
            $depositPaid = floatval($validated['deposit_paid'] ?? 0.00);

            $operation->update([
                'client_id' => $validated['client_id'] ?? null,
                'warehouse_id' => $warehouseId,
                'deposit_paid' => $depositPaid,
                'deposit_payment_method' => $validated['deposit_payment_method'] ?? 'cash',
                'use_stock' => $validated['use_stock'] ?? $operation->use_stock,
                'total_price' => $validated['total_price'] ?? $operation->total_price,
                'notes' => $validated['notes'] ?? $operation->notes,
            ]);

            // Recreate OperationProducts
            $operation->operationProducts()->delete();
            $whProd = \App\Models\Warehouse::productsWarehouse();
            $prodWhId = $whProd ? $whProd->id : $warehouseId;
            $productEntries = [];

            if (!empty($validated['products'])) {
                foreach ($validated['products'] as $prod) {
                    $qtyFromStock = (float)($prod['quantity_taken_from_stock'] ?? 0);
                    $productEntries[] = OperationProduct::create([
                        'operation_id' => $operation->id,
                        'product_id' => $prod['product_id'],
                        'quantity' => $prod['quantity'],
                        'quantity_taken_from_stock' => $qtyFromStock,
                    ]);
                }
            }

            // 4. Re-apply New State
            if (in_array($oldStatus, ['Completed', 'Delivered'])) {
                // Re-run the completion logic inventory movements
                \App\Services\OperationService::completeProduction($operation);
            }

            // Re-apply deposit in Treasury
            if ($depositPaid > 0 && !empty($validated['client_id'])) {
                $payMethod = $validated['deposit_payment_method'] ?? 'cash';
                $clientObj = Client::find($validated['client_id']);
                $clientName = $clientObj ? $clientObj->name : 'عميل';
                $prodsSummary = collect($productEntries)->map(function($entry) {
                    $p = Product::find($entry->product_id);
                    return $p ? "{$p->name} (×{$entry->quantity})" : "منتج (×{$entry->quantity})";
                })->join(' + ');

                ClientPayment::create([
                    'client_id' => $validated['client_id'],
                    'amount' => $depositPaid,
                    'payment_date' => Carbon::now()->toDateString(),
                    'payment_method' => $payMethod,
                    'operation_id' => $operation->id,
                    'reference_number' => $operation->operation_number,
                    'notes' => "دفعة عربون معدلة من العميل ({$clientName}) لأمر تشغيل {$operation->operation_number}" . ($prodsSummary ? " - بنود: {$prodsSummary}" : ''),
                    'created_by' => $user,
                ]);

                TreasuryService::recordInflow(
                    amount: $depositPaid,
                    paymentMethod: $payMethod,
                    category: 'عربون أمر تشغيل',
                    description: "عربون معدل من العميل ({$clientName}) لأمر تشغيل {$operation->operation_number}" . ($prodsSummary ? " - بنود: {$prodsSummary}" : ''),
                    sourceType: Operation::class,
                    sourceId: $operation->id,
                    referenceNumber: $operation->operation_number,
                    transactionDate: Carbon::now()->toDateString(),
                    userId: $user
                );
            }

            // Sync Client Debt
            if ($oldClientId && $oldClientId != $operation->client_id) {
                Client::find($oldClientId)?->recalculateDebt();
            }
            if ($operation->client_id) {
                Client::find($operation->client_id)?->recalculateDebt();
            }

            return response()->json([
                'message' => 'تم تحديث أمر الإنتاج وإعادة ضبط الخزينة والمخزون بنجاح.',
                'operation' => $operation->fresh(['client', 'warehouse', 'operationProducts.product'])
            ]);
        });
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

        $result = OperationService::cancelProduction($operation, $refundDeposit);

        return response()->json($result);
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
