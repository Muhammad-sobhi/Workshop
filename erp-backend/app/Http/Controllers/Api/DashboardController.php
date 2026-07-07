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

class DashboardController extends Controller
{
    public function index(): JsonResponse
    {
        // 1. Calculate KPIs
        $totalRevenue = Revenue::sum('amount');
        $totalExpense = Expense::sum('amount');

        // Dynamic inventory value
        $materials = Material::all();
        $inventoryValue = 0;
        foreach ($materials as $material) {
            $inventoryValue += max(0, $material->stock_quantity) * $material->unit_cost;
        }

        // Production units (Completed operations quantity)
        $productionUnits = Operation::where('status', 'Completed')->sum('quantity');

        // 2. Chart Data - Last 6 Months
        $months = [];
        $arabicMonths = [
            1 => 'يناير', 2 => 'فبراير', 3 => 'مارس', 4 => 'أبريل', 
            5 => 'مايو', 6 => 'يونيو', 7 => 'يوليو', 8 => 'أغسطس', 
            9 => 'سبتمبر', 10 => 'أكتوبر', 11 => 'نوفمبر', 12 => 'ديسمبر'
        ];

        for ($i = 5; $i >= 0; $i--) {
            $date = Carbon::now()->subMonths($i);
            $monthNum = $date->month;
            $yearNum = $date->year;
            $monthName = $arabicMonths[$monthNum];
            
            $monthRevenue = Revenue::whereMonth('revenue_date', $monthNum)
                ->whereYear('revenue_date', $yearNum)
                ->sum('amount');
                
            $monthExpense = Expense::whereMonth('expense_date', $monthNum)
                ->whereYear('expense_date', $yearNum)
                ->sum('amount');

            $months[] = [
                'month' => $monthName,
                'revenue' => (float)$monthRevenue,
                'expense' => (float)$monthExpense,
            ];
        }

        // 3. Status chart of Production
        $pendingOps = Operation::where('status', 'Pending')->count();
        $inProgressOps = Operation::where('status', 'In_Progress')->count();
        $completedOps = Operation::where('status', 'Completed')->count();
        
        $orderChart = [
            ['name' => 'معلق', 'value' => $pendingOps],
            ['name' => 'قيد التنفيذ', 'value' => $inProgressOps],
            ['name' => 'مكتمل', 'value' => $completedOps],
        ];

        // 4. Recent Activities
        $activities = [];

        // Low stock alerts
        $lowStockCount = 0;
        foreach ($materials as $material) {
            if ($material->type === 'service') {
                continue;
            }
            if ($material->stock_quantity < $material->low_stock_limit) {
                $activities[] = [
                    'id' => 'low-stock-' . $material->id,
                    'type' => 'inventory',
                    'description' => "تنبيه: مخزون منخفض لمادة ({$material->name})، المتبقي: {$material->stock_quantity} {$material->unit}",
                    'time' => 'نشط الآن',
                    'timestamp' => Carbon::now()->timestamp
                ];
                $lowStockCount++;
            }
        }

        // Recent Operations
        $recentOps = Operation::with('product')->orderBy('updated_at', 'desc')->take(3)->get();
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
            ->orderBy('movement_date', 'desc')
            ->take(3)
            ->get();
        foreach ($recentMovements as $move) {
            $name = $move->material ? $move->material->name : $move->product->name;
            $typeText = $this->translateMovementType($move->movement_type);
            $activities[] = [
                'id' => 'move-' . $move->id,
                'type' => 'shipment',
                'description' => "حركة مخزنية: {$typeText} لـ ({$name}) بكمية {$move->quantity} في {$move->warehouse->name}",
                'time' => Carbon::parse($move->movement_date)->diffForHumans(),
                'timestamp' => Carbon::parse($move->movement_date)->timestamp
            ];
        }

        // Sort activities by timestamp descending
        usort($activities, function ($a, $b) {
            return $b['timestamp'] - $a['timestamp'];
        });

        // Take top 6
        $activities = array_slice($activities, 0, 6);

        return response()->json([
            'kpis' => [
                ['id' => 1, 'label' => 'إجمالي الإيرادات', 'value' => 'EGP ' . number_format($totalRevenue, 2), 'change' => '+12.5%', 'icon' => 'DollarSign'],
                ['id' => 2, 'label' => 'إجمالي المصروفات', 'value' => 'EGP ' . number_format($totalExpense, 2), 'change' => '+8.2%', 'icon' => 'ShoppingCart'],
                ['id' => 3, 'label' => 'قيمة المخزون', 'value' => 'EGP ' . number_format($inventoryValue, 2), 'change' => '-2.1%', 'icon' => 'Box'],
                ['id' => 4, 'label' => 'وحدات الإنتاج المكتملة', 'value' => number_format($productionUnits), 'change' => '+5.3%', 'icon' => 'Zap'],
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
