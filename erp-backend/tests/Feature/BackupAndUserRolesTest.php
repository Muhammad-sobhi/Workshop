<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Material;
use App\Models\MaterialCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class BackupAndUserRolesTest extends TestCase
{
    use RefreshDatabase;

    public function test_backup_status_and_export()
    {
        $user = User::factory()->create(['role' => 'admin']);
        $this->actingAs($user, 'sanctum');

        $cat = MaterialCategory::create(['name' => 'أخشاب']);

        Material::create([
            'name' => 'خشب زان أصلي',
            'unit' => 'متر',
            'unit_cost' => 120.00,
            'stock_quantity' => 50,
            'category_id' => $cat->id,
        ]);

        // Status check
        $statusRes = $this->getJson('/api/backup/status');
        $statusRes->assertStatus(200);
        $statusRes->assertJsonPath('status', 'healthy');
        $this->assertGreaterThan(0, $statusRes->json('total_records'));

        // Export check
        $exportRes = $this->get('/api/backup/export');
        $exportRes->assertStatus(200);
        $exportRes->assertHeader('content-type', 'application/json');
    }

    public function test_backup_restore_workflow()
    {
        $user = User::factory()->create(['role' => 'admin']);
        $this->actingAs($user, 'sanctum');

        $cat = MaterialCategory::create(['name' => 'أخشاب مستعادة']);

        $backupPayload = [
            'app' => 'Workshop ERP Management System',
            'version' => '2.0',
            'exported_at' => now()->toIso8601String(),
            'tables' => [
                'material_categories' => [
                    [
                        'id' => 10,
                        'name' => 'أخشاب مستوردة',
                        'created_at' => now()->toDateTimeString(),
                        'updated_at' => now()->toDateTimeString(),
                    ]
                ],
                'materials' => [
                    [
                        'id' => 999,
                        'name' => 'مادة مستعادة من النسخة',
                        'code' => 'MAT-999',
                        'sku' => 'SKU-999',
                        'unit' => 'قطعة',
                        'unit_cost' => 75.00,
                        'stock_quantity' => 25.00,
                        'type' => 'raw_material',
                        'category_id' => 10,
                        'created_at' => now()->toDateTimeString(),
                        'updated_at' => now()->toDateTimeString(),
                    ]
                ]
            ]
        ];

        $jsonFile = UploadedFile::fake()->createWithContent('backup.json', json_encode($backupPayload));

        $restoreRes = $this->postJson('/api/backup/restore', [
            'backup_file' => $jsonFile
        ]);

        $restoreRes->assertStatus(200);
        $this->assertDatabaseHas('materials', [
            'id' => 999,
            'name' => 'مادة مستعادة من النسخة'
        ]);
    }

    public function test_user_management_and_role_assignment()
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $this->actingAs($admin, 'sanctum');

        // Create a Cashier / Sales user
        $createRes = $this->postJson('/api/users', [
            'name' => 'أحمد مندوب المبيعات',
            'email' => 'sales@workshop.com',
            'password' => 'password123',
            'role' => 'sales',
            'permissions' => ['manage_sales', 'manage_clients'],
        ]);
        $createRes->assertStatus(201);
        $this->assertDatabaseHas('users', [
            'email' => 'sales@workshop.com',
            'role' => 'sales'
        ]);

        // Create an Inventory Keeper user
        $keeperRes = $this->postJson('/api/users', [
            'name' => 'محمود أمين المخزن',
            'email' => 'inventory@workshop.com',
            'password' => 'password123',
            'role' => 'inventory',
            'permissions' => ['manage_inventory'],
        ]);
        $keeperRes->assertStatus(201);
        $this->assertDatabaseHas('users', [
            'email' => 'inventory@workshop.com',
            'role' => 'inventory'
        ]);
    }
}
