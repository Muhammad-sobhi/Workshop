<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class NotificationsController extends Controller
{
    public function index(): JsonResponse
    {
        try {
            // 1. Check low stock limits
            $materials = \App\Models\Material::all();
            foreach ($materials as $m) {
                if ($m->type === 'service') {
                    continue;
                }
                if ($m->stock_quantity < $m->low_stock_limit) {
                    $msg = "المخزون الحالي لمادة ({$m->name}) هو {$m->stock_quantity} {$m->unit}، وهو أقل من الحد الأدنى المحدد ({$m->low_stock_limit})";
                    $exists = DB::table('notifications')->where('title', 'مخزون منخفض')->where('message', 'LIKE', "%({$m->name})%")->exists();
                    if (!$exists) {
                        DB::table('notifications')->insert([
                            'title' => 'مخزون منخفض',
                            'message' => $msg,
                            'is_read' => false,
                            'created_at' => now(),
                            'updated_at' => now()
                        ]);
                    }
                }
            }

            // 2. Check due debts (Clients & Suppliers)
            $today = \Illuminate\Support\Carbon::today()->toDateString();

            $clients = \App\Models\Client::where('debt_amount', '>', 0)
                ->whereNotNull('debt_due_date')
                ->where('debt_due_date', '<=', $today)
                ->get();
            foreach ($clients as $c) {
                $msg = "العميل ({$c->name}) متأخر عن سداد دين بقيمة {$c->debt_amount} المستحق بتاريخ {$c->debt_due_date}";
                $exists = DB::table('notifications')->where('title', 'تنبيه دين عميل')->where('message', 'LIKE', "%({$c->name})%")->exists();
                if (!$exists) {
                    DB::table('notifications')->insert([
                        'title' => 'تنبيه دين عميل',
                        'message' => $msg,
                        'is_read' => false,
                        'created_at' => now(),
                        'updated_at' => now()
                    ]);
                }
            }

            $suppliers = \App\Models\Supplier::where('debt_amount', '>', 0)
                ->whereNotNull('debt_due_date')
                ->where('debt_due_date', '<=', $today)
                ->get();
            foreach ($suppliers as $s) {
                $msg = "المورد ({$s->name}) يستحق له دين بقيمة {$s->debt_amount} المستحق بتاريخ {$s->debt_due_date}";
                $exists = DB::table('notifications')->where('title', 'تنبيه دين مورد')->where('message', 'LIKE', "%({$s->name})%")->exists();
                if (!$exists) {
                    DB::table('notifications')->insert([
                        'title' => 'تنبيه دين مورد',
                        'message' => $msg,
                        'is_read' => false,
                        'created_at' => now(),
                        'updated_at' => now()
                    ]);
                }
            }

            $notifications = DB::table('notifications')
                ->orderByDesc('created_at')
                ->get();

            $unreadCount = DB::table('notifications')
                ->where('is_read', false)
                ->count();

            return response()->json([
                'notifications' => $notifications,
                'unread_count'  => $unreadCount,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'notifications' => [],
                'unread_count'  => 0,
            ]);
        }
    }

    public function markAsRead($id): JsonResponse
    {
        try {
            DB::table('notifications')
                ->where('id', $id)
                ->update(['is_read' => true]);
            return response()->json(['message' => 'تم تحديد التنبيه كمقروء']);
        } catch (\Exception $e) {
            return response()->json(['message' => 'خطأ في تحديث التنبيه'], 500);
        }
    }

    public function markAllAsRead(): JsonResponse
    {
        try {
            DB::table('notifications')
                ->where('is_read', false)
                ->update(['is_read' => true]);
            return response()->json(['message' => 'تم تحديد جميع التنبيهات كمقروءة']);
        } catch (\Exception $e) {
            return response()->json(['message' => 'خطأ في تحديث التنبيهات'], 500);
        }
    }

    public function clearAll(): JsonResponse
    {
        try {
            DB::table('notifications')->delete();
            return response()->json(['message' => 'تم مسح جميع التنبيهات']);
        } catch (\Exception $e) {
            return response()->json(['message' => 'خطأ في مسح التنبيهات'], 500);
        }
    }
}
