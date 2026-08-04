<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Revenue;
use App\Models\Expense;
use App\Models\Material;
use App\Models\Operation;
use App\Models\InventoryMovement;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function index(): JsonResponse
    {
        $selectedDateStr = request('date');
        $targetDate = $selectedDateStr ? Carbon::parse($selectedDateStr) : Carbon::now();

        // 1. Calculate KPIs up to selected target date
        $totalRevenue = (float) Revenue::where('revenue_date', '<=', $targetDate->format('Y-m-d'))->sum('amount');
        $totalExpense = (float) Expense::where('expense_date', '<=', $targetDate->format('Y-m-d'))->sum('amount');

        // Inventory value calculation (Raw Materials + Finished Goods Capital)
        $materialValue = (float) Material::where('type', '!=', 'service')
            ->selectRaw('SUM(GREATEST(0, stock_quantity) * unit_cost) as total_val')
            ->value('total_val') ?? 0;
        $productValue = (float) Product::selectRaw('SUM(GREATEST(0, stock_quantity) * unit_cost) as total_val')
            ->value('total_val') ?? 0;
        $inventoryValue = $materialValue + $productValue;

        // Production units (Completed operations quantity up to date)
        $productionUnits = (int) Operation::where('status', 'Completed')
            ->whereDate('created_at', '<=', $targetDate->format('Y-m-d'))
            ->sum('quantity');

        // Month-over-month revenue percentage change
        $currentMonthRev = (float) Revenue::whereMonth('revenue_date', $targetDate->month)
            ->whereYear('revenue_date', $targetDate->year)
            ->sum('amount');
        $lastMonthDate = (clone $targetDate)->subMonth();
        $lastMonthRev = (float) Revenue::whereMonth('revenue_date', $lastMonthDate->month)
            ->whereYear('revenue_date', $lastMonthDate->year)
            ->sum('amount');
        $revChangePct = $lastMonthRev > 0 
            ? round((($currentMonthRev - $lastMonthRev) / $lastMonthRev) * 100, 1) 
            : 0;
        $revChangeStr = ($revChangePct >= 0 ? '+' : '') . $revChangePct . '%';

        // 2. Chart Data - 6 Months up to the target date
        $sixMonthsAgo = (clone $targetDate)->subMonths(5)->startOfMonth();
        
        $monthlyRevenues = Revenue::selectRaw('YEAR(revenue_date) as year_num, MONTH(revenue_date) as month_num, SUM(amount) as total')
            ->where('revenue_date', '>=', $sixMonthsAgo->format('Y-m-d'))
            ->where('revenue_date', '<=', $targetDate->format('Y-m-d'))
            ->groupBy('year_num', 'month_num')
            ->get()
            ->keyBy(fn ($item) => "{$item->year_num}-{$item->month_num}");

        $monthlyExpenses = Expense::selectRaw('YEAR(expense_date) as year_num, MONTH(expense_date) as month_num, SUM(amount) as total')
            ->where('expense_date', '>=', $sixMonthsAgo->format('Y-m-d'))
            ->where('expense_date', '<=', $targetDate->format('Y-m-d'))
            ->groupBy('year_num', 'month_num')
            ->get()
            ->keyBy(fn ($item) => "{$item->year_num}-{$item->month_num}");

        $arabicMonths = [
            1 => 'يناير', 2 => 'فبراير', 3 => 'مارس', 4 => 'أبريل', 
            5 => 'مايو', 6 => 'يونيو', 7 => 'يوليو', 8 => 'أغسطس', 
            9 => 'سبتمبر', 10 => 'أكتوبر', 11 => 'نوفمبر', 12 => 'ديسمبر'
        ];

        $months = [];
        for ($i = 5; $i >= 0; $i--) {
            $date = (clone $targetDate)->subMonths($i);
            $key = "{$date->year}-{$date->month}";

            $rev = isset($monthlyRevenues[$key]) ? (float)$monthlyRevenues[$key]->total : 0.0;
            $exp = isset($monthlyExpenses[$key]) ? (float)$monthlyExpenses[$key]->total : 0.0;

            $months[] = [
                'month' => $arabicMonths[$date->month],
                'revenue' => $rev,
                'expense' => $exp,
            ];
        }

        // 3. Status chart of Production
        $operationCounts = Operation::select('status', DB::raw('count(*) as count'))
            ->whereDate('created_at', '<=', $targetDate->format('Y-m-d'))
            ->groupBy('status')
            ->pluck('count', 'status');

        $orderChart = [
            ['name' => 'معلق', 'value' => $operationCounts['Pending'] ?? 0],
            ['name' => 'قيد التنفيذ', 'value' => $operationCounts['In_Progress'] ?? 0],
            ['name' => 'مكتمل', 'value' => $operationCounts['Completed'] ?? 0],
        ];

        // 4. Recent Activities
        $activities = [];

        // Low stock alerts
        $lowStockMaterials = Material::where('type', '!=', 'service')
            ->whereColumn('stock_quantity', '<', 'low_stock_limit')
            ->take(5)
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
        $recentOps = Operation::with('product')->whereDate('created_at', '<=', $targetDate->format('Y-m-d'))->orderBy('updated_at', 'desc')->take(3)->get();
        foreach ($recentOps as $op) {
            if (!$op->product) continue;
            $statusText = $op->status === 'Completed' ? 'اكتملت' : ($op->status === 'In_Progress' ? 'بدأت' : 'تم تخطيط');
            $activities[] = [
                'id' => 'op-' . $op->id,
                'type' => 'production',
                'description' => "{$statusText} عملية تصنيع ({$op->product->name}) - رقم {$op->operation_number}",
                'time' => $op->updated_at->diffForHumans(),
                'timestamp' => $op->updated_at->timestamp
            ];
        }

        // Recent Inventory Movements
        $recentMovements = InventoryMovement::with(['material', 'product', 'warehouse'])
            ->whereDate('movement_date', '<=', $targetDate->format('Y-m-d'))
            ->orderBy('movement_date', 'desc')
            ->take(3)
            ->get();
        foreach ($recentMovements as $move) {
            $name = $move->material ? $move->material->name : ($move->product ? $move->product->name : '---');
            $typeText = $this->translateMovementType($move->movement_type);
            $warehouseName = $move->warehouse ? $move->warehouse->name : 'المستودع';
            $activities[] = [
                'id' => 'move-' . $move->id,
                'type' => 'shipment',
                'description' => "حركة مخزنية: {$typeText} لـ ({$name}) بكمية {$move->quantity} في {$warehouseName}",
                'time' => Carbon::parse($move->movement_date)->diffForHumans(),
                'timestamp' => Carbon::parse($move->movement_date)->timestamp
            ];
        }

        // Sort activities by timestamp descending
        usort($activities, function ($a, $b) {
            return $b['timestamp'] - $a['timestamp'];
        });

        $activities = array_slice($activities, 0, 6);

        return response()->json([
            'kpis' => [
                ['id' => 1, 'label' => 'إجمالي الإيرادات', 'value' => 'EGP ' . number_format($totalRevenue, 2), 'change' => $revChangeStr, 'icon' => 'DollarSign'],
                ['id' => 2, 'label' => 'إجمالي المصروفات', 'value' => 'EGP ' . number_format($totalExpense, 2), 'change' => '+0.0%', 'icon' => 'ShoppingCart'],
                ['id' => 3, 'label' => 'قيمة المخزون', 'value' => 'EGP ' . number_format($inventoryValue, 2), 'change' => 'مباشر', 'icon' => 'Box'],
                ['id' => 4, 'label' => 'وحدات الإنتاج المكتملة', 'value' => number_format($productionUnits), 'change' => 'مباشر', 'icon' => 'Zap'],
            ],
            'revenueChart' => $months,
            'orderChart' => $orderChart,
            'recentActivities' => $activities
        ]);
    }

    private function translateMovementType(string $type): string
    {
        return match ($type) {
            'Initial_Balance' => 'رصيد أول المدة',
            'Purchase_Receipt' => 'توريد مشتريات',
            'Production_Consumption' => 'صرف للإنتاج',
            'Stock_Adjustment' => 'تسوية مخزنية',
            'Supplier_Return' => 'مرتجع للمورد',
            'Transfer_In' => 'تحويل وارد',
            'Transfer_Out' => 'تحويل صادر',
            'Damaged' => 'صرف تالف',
            default => $type
        };
    }
}
