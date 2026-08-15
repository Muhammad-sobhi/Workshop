<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpFoundation\StreamedResponse;

class BackupController extends Controller
{
    private array $tables = [
        'settings',
        'warehouses',
        'material_categories',
        'product_categories',
        'materials',
        'products',
        'material_product',
        'inventory_movements',
        'clients',
        'suppliers',
        'supplier_materials',
        'treasury_transactions',
        'sales_invoices',
        'sales_invoice_items',
        'operations',
        'operation_products',
        'operation_payments',
        'purchase_orders',
        'purchase_order_items',
        'supplier_payments',
        'client_payments',
        'expenses',
        'external_service_orders',
        'external_service_order_payments',
        'users',
    ];

    /**
     * Download a complete JSON snapshot backup of the ERP database.
     */
    public function exportBackup(): StreamedResponse
    {
        $backupData = [
            'app' => 'Workshop ERP Management System',
            'version' => '2.0',
            'exported_at' => Carbon::now()->toIso8601String(),
            'timestamp' => time(),
            'tables' => [],
            'stats' => [],
        ];

        foreach ($this->tables as $table) {
            if (Schema::hasTable($table)) {
                $rows = DB::table($table)->get()->toArray();
                $backupData['tables'][$table] = $rows;
                $backupData['stats'][$table] = count($rows);
            }
        }

        $filename = 'workshop_backup_' . Carbon::now()->format('Y-m-d_H-i-s') . '.json';

        return response()->streamDownload(function () use ($backupData) {
            echo json_encode($backupData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        }, $filename, [
            'Content-Type' => 'application/json',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ]);
    }

    /**
     * Get backup status and database stats.
     */
    public function status(): JsonResponse
    {
        $stats = [];
        $totalRecords = 0;

        foreach ($this->tables as $table) {
            if (Schema::hasTable($table)) {
                $count = DB::table($table)->count();
                $stats[$table] = $count;
                $totalRecords += $count;
            }
        }

        return response()->json([
            'status' => 'healthy',
            'total_records' => $totalRecords,
            'total_tables' => count($stats),
            'server_time' => Carbon::now()->toDateTimeString(),
            'table_stats' => $stats,
        ]);
    }

    /**
     * Restore database from a valid JSON backup file.
     */
    public function restoreBackup(Request $request): JsonResponse
    {
        $request->validate([
            'backup_file' => 'required|file|mimes:json,txt|max:51200', // 50MB max
        ]);

        $file = $request->file('backup_file');
        $content = file_get_contents($file->getRealPath());
        $data = json_decode($content, true);

        if (!$data || !isset($data['tables']) || !is_array($data['tables'])) {
            return response()->json(['message' => 'ملف النسخة الاحتياطية غير صالح أو تالف.'], 422);
        }

        return DB::transaction(function () use ($data) {
            Schema::disableForeignKeyConstraints();

            foreach ($this->tables as $table) {
                if (isset($data['tables'][$table]) && Schema::hasTable($table)) {
                    DB::table($table)->truncate();
                    $rows = $data['tables'][$table];

                    // Insert in chunks of 100
                    foreach (array_chunk($rows, 100) as $chunk) {
                        $chunkArray = array_map(function ($item) {
                            return (array) $item;
                        }, $chunk);
                        DB::table($table)->insert($chunkArray);
                    }
                }
            }

            Schema::enableForeignKeyConstraints();

            return response()->json([
                'message' => 'تمت استعادة النسخة الاحتياطية بنجاح وتحديث كافة البيانات والجداول.',
                'exported_at' => $data['exported_at'] ?? 'غير معروف',
            ]);
        });
    }
}
