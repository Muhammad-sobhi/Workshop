<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SalesInvoice;
use App\Models\Expense;
use App\Models\Material;
use App\Models\Product;
use App\Models\Operation;
use App\Models\InventoryMovement;
use App\Services\TreasuryService;
use App\Services\InventoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function index(): JsonResponse
    {
        $selectedDateStr = request('date');
        $targetDate = $selectedDateStr ? Carbon::parse($selectedDateStr) : Carbon::now();
        $dateLimit = $targetDate->format('Y-m-d');

        // 1. Calculate Financial KPIs up to target date
        $totalRevenue = (float) SalesInvoice::whereDate('invoice_date', '<=', $dateLimit)->sum('total_amount');
        $totalCogs = (float) SalesInvoice::whereDate('invoice_date', '<=', $dateLimit)->sum('total_cogs');
        $grossProfit = round($totalRevenue - $totalCogs, 2);
        $totalExpense = (float) Expense::whereDate('expense_date', '<=', $dateLimit)->sum('amount');
        $netProfit = round($grossProfit - $totalExpense, 2);

        // Treasury Cash
        $treasurySummary = TreasuryService::getBalances($dateLimit);
        $cashInHand = $treasurySummary['total_balance'];

        // Inventory Value using live mathematical stock
        $materialValue = (float) Material::where('type', '!=', 'service')->get()->sum(function ($mat) {
            return InventoryService::getStock('material', $mat->id) * (float)$mat->calculateStoredUnitCost();
        });

        $productValue = (float) Product::all()->sum(function ($prod) {
            return InventoryService::getStock('product', $prod->id) * (float)$prod->calculateStoredUnitCost();
        });

        $inventoryValue = round($materialValue + $productValue, 2);

        // Production units completed
        $productionUnits = (int) Operation::whereIn('status', ['Completed', 'Delivered'])
            ->whereDate('created_at', '<=', $dateLimit)
            ->get()
            ->sum(function ($op) {
                if ($op->operationProducts && $op->operationProducts->count() > 0) {
                    return $op->operationProducts->sum('quantity');
                }
                return $op->quantity ?? 1;
            });

        // Month-over-month revenue percentage change
        $currentMonthRev = (float) SalesInvoice::whereMonth('invoice_date', $targetDate->month)
            ->whereYear('invoice_date', $targetDate->year)
            ->sum('total_amount');

        $lastMonthDate = (clone $targetDate)->subMonth();
        $lastMonthRev = (float) SalesInvoice::whereMonth('invoice_date', $lastMonthDate->month)
            ->whereYear('invoice_date', $lastMonthDate->year)
            ->sum('total_amount');

        $revChangePct = $lastMonthRev > 0 
            ? round((($currentMonthRev - $lastMonthRev) / $lastMonthRev) * 100, 1) 
            : 0;
        $revChangeStr = ($revChangePct >= 0 ? '+' : '') . $revChangePct . '%';

        // 2. Chart Data - 6 Months up to the target date
        $sixMonthsAgo = (clone $targetDate)->subMonths(5)->startOfMonth();

        $monthlyInvoices = SalesInvoice::whereDate('invoice_date', '>=', $sixMonthsAgo->format('Y-m-d'))
            ->whereDate('invoice_date', '<=', $dateLimit)
            ->get()
            ->groupBy(function ($item) {
                return Carbon::parse($item->invoice_date)->format('Y-n');
            });

        $monthlyExpenses = Expense::whereDate('expense_date', '>=', $sixMonthsAgo->format('Y-m-d'))
            ->whereDate('expense_date', '<=', $dateLimit)
            ->get()
            ->groupBy(function ($item) {
                return Carbon::parse($item->expense_date)->format('Y-n');
            });

        $arabicMonths = [
            1 => 'يناير', 2 => 'فبراير', 3 => 'مارس', 4 => 'أبريل', 
            5 => 'مايو', 6 => 'يونيو', 7 => 'يوليو', 8 => 'أغسطس', 
            9 => 'سبتمبر', 10 => 'أكتوبر', 11 => 'نوفمبر', 12 => 'ديسمبر'
        ];

        $months = [];
        for ($i = 5; $i >= 0; $i--) {
            $date = (clone $targetDate)->subMonths($i);
            $key = "{$date->year}-{$date->month}";

            $invGroup = $monthlyInvoices->get($key);
            $expGroup = $monthlyExpenses->get($key);

            $rev = $invGroup ? (float) $invGroup->sum('total_amount') : 0.0;
            $cogs = $invGroup ? (float) $invGroup->sum('total_cogs') : 0.0;
            $exp = $expGroup ? (float) $expGroup->sum('amount') : 0.0;
            $mGrossProfit = round($rev - $cogs, 2);
            $mNetProfit = round($mGrossProfit - $exp, 2);

            $months[] = [
                'month' => $arabicMonths[$date->month],
                'revenue' => $rev,
                'cogs' => $cogs,
                'gross_profit' => $mGrossProfit,
                'expense' => $exp,
                'net_profit' => $mNetProfit,
            ];
        }

        // 3. Status chart of Production
        $operationCounts = Operation::select('status', DB::raw('count(*) as count'))
            ->whereDate('created_at', '<=', $dateLimit)
            ->groupBy('status')
            ->pluck('count', 'status');

        $orderChart = [
            ['name' => 'معلق', 'value' => $operationCounts['Pending'] ?? 0],
            ['name' => 'قيد التنفيذ', 'value' => $operationCounts['In_Progress'] ?? 0],
            ['name' => 'مكتمل', 'value' => $operationCounts['Completed'] ?? 0],
            ['name' => 'تم التسليم', 'value' => $operationCounts['Delivered'] ?? 0],
        ];

        // 4. Recent Activities
        $activities = [];

        // Low stock alerts
        $lowStockMaterials = Material::where('type', '!=', 'service')
            ->whereColumn('stock_quantity', '<', 'low_stock_limit')
            ->take(4)
            ->get();

        foreach ($lowStockMaterials as $material) {
            $activities[] = [
                'id' => 'low-stock-' . $material->id,
                'type' => 'inventory',
                'description' => "تنبيه: مخزون منخفض لمادة ({$material->name})، المتبقي: {$material->stock_quantity} {$material->unit}",
                'time' => 'نشط الآن',
                'timestamp' => Carbon::now()->timestamp
            ];
        }

        // Recent Operations
        $recentOps = Operation::with('product')->whereDate('created_at', '<=', $dateLimit)->orderBy('updated_at', 'desc')->take(3)->get();
        foreach ($recentOps as $op) {
            $name = $op->product ? $op->product->name : 'أمر تشغيل';
            $statusText = match ($op->status) {
                'Completed' => 'اكتمل',
                'In_Progress' => 'بدأ تنفيذ',
                'Delivered' => 'تم تسليم',
                'Cancelled' => 'تم إلغاء',
                default => 'تم تخطيط'
            };
            $activities[] = [
                'id' => 'op-' . $op->id,
                'type' => 'production',
                'description' => "{$statusText} أمر تصنيع ({$name}) - رقم {$op->operation_number}",
                'time' => $op->updated_at->diffForHumans(),
                'timestamp' => $op->updated_at->timestamp
            ];
        }

        // Recent Inventory Movements
        $recentMovements = InventoryMovement::with(['material', 'product', 'warehouse'])
            ->whereDate('movement_date', '<=', $dateLimit)
            ->orderBy('movement_date', 'desc')
            ->orderBy('id', 'desc')
            ->take(3)
            ->get();

        foreach ($recentMovements as $move) {
            $name = $move->material ? $move->material->name : ($move->product ? $move->product->name : '---');
            $typeText = $move->movement_type;
            $warehouseName = $move->warehouse ? $move->warehouse->name : 'المستودع';
            $activities[] = [
                'id' => 'move-' . $move->id,
                'type' => 'shipment',
                'description' => "حركة مخزنية: {$typeText} لـ ({$name}) بكمية {$move->quantity} في {$warehouseName}",
                'time' => Carbon::parse($move->movement_date)->diffForHumans(),
                'timestamp' => Carbon::parse($move->movement_date)->timestamp
            ];
        }

        usort($activities, function ($a, $b) {
            return $b['timestamp'] - $a['timestamp'];
        });

        // 5. Operations Live Pipeline
        $pipelineOps = Operation::with(['client', 'operationProducts.product', 'product'])
            ->whereIn('status', ['Pending', 'In_Progress', 'Completed'])
            ->orderBy('updated_at', 'desc')
            ->take(15)
            ->get();

        $pipeline = [
            'pending' => $pipelineOps->where('status', 'Pending')->values(),
            'in_progress' => $pipelineOps->where('status', 'In_Progress')->values(),
            'completed' => $pipelineOps->where('status', 'Completed')->values(),
        ];

        // 6. Operational Workshop Metrics
        $activeClientOrdersCount = Operation::whereNotNull('client_id')->whereIn('status', ['Pending', 'In_Progress'])->count();
        $unitsInProductionCount = (int) Operation::where('status', 'In_Progress')->get()->sum(function ($op) {
            return $op->operationProducts && $op->operationProducts->count() > 0 
                ? $op->operationProducts->sum('quantity') 
                : ($op->quantity ?? 1);
        });

        $lowStockMaterialsList = Material::where('type', '!=', 'service')
            ->whereColumn('stock_quantity', '<=', 'low_stock_limit')
            ->take(6)
            ->get()
            ->map(function ($m) {
                return [
                    'id' => $m->id,
                    'name' => $m->name,
                    'sku' => $m->sku,
                    'stock_quantity' => (float)$m->stock_quantity,
                    'low_stock_limit' => (float)$m->low_stock_limit,
                    'unit' => $m->unit ?? 'وحدة',
                ];
            });

        $externalServicesCount = class_exists(\App\Models\ExternalServiceOrder::class) 
            ? \App\Models\ExternalServiceOrder::whereIn('status', ['Sent', 'In_Progress', 'Pending'])->count()
            : 0;

        return response()->json([
            'inventory_value' => $inventoryValue,
            'operational_metrics' => [
                'active_client_orders' => $activeClientOrdersCount,
                'units_in_production' => $unitsInProductionCount,
                'low_stock_count' => $lowStockMaterialsList->count(),
                'external_services_count' => $externalServicesCount,
            ],
            'pipeline' => $pipeline,
            'low_stock_materials' => $lowStockMaterialsList,
            'kpis' => [
                ['id' => 1, 'label' => 'إجمالي الإيرادات', 'value' => 'EGP ' . number_format($totalRevenue, 2), 'change' => $revChangeStr, 'icon' => 'DollarSign'],
                ['id' => 2, 'label' => 'تكلفة البضاعة المباعة (COGS)', 'value' => 'EGP ' . number_format($totalCogs, 2), 'change' => 'مباشر', 'icon' => 'ShoppingCart'],
                ['id' => 3, 'label' => 'مجمل الربح', 'value' => 'EGP ' . number_format($grossProfit, 2), 'change' => 'مباشر', 'icon' => 'TrendingUp'],
                ['id' => 4, 'label' => 'المصروفات التشغيلية', 'value' => 'EGP ' . number_format($totalExpense, 2), 'change' => 'مباشر', 'icon' => 'PieChart'],
                ['id' => 5, 'label' => 'صافي الربح', 'value' => 'EGP ' . number_format($netProfit, 2), 'change' => 'مباشر', 'icon' => 'Calculator'],
                ['id' => 6, 'label' => 'السيولة النقدية (الخزينة)', 'value' => 'EGP ' . number_format($cashInHand, 2), 'change' => 'فعلي', 'icon' => 'Wallet'],
                ['id' => 7, 'label' => 'قيمة المخزون', 'value' => 'EGP ' . number_format($inventoryValue, 2), 'change' => 'مباشر', 'icon' => 'Box'],
                ['id' => 8, 'label' => 'وحدات الإنتاج المكتملة', 'value' => number_format($productionUnits), 'change' => 'مباشر', 'icon' => 'Zap'],
            ],
            'revenueChart' => $months,
            'orderChart' => $orderChart,
            'recentActivities' => array_slice($activities, 0, 6),
        ]);
    }
}
