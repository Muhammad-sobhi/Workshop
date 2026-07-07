<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Warehouse;
use App\Models\MaterialCategory;
use App\Models\Material;
use App\Models\ProductCategory;
use App\Models\Product;
use App\Models\ProductMaterial;
use App\Models\Supplier;
use App\Models\Client;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\Operation;
use App\Models\InventoryMovement;
use App\Models\Expense;
use App\Models\Revenue;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // 1. Seed Admin User
        $admin = User::create([
            'name' => 'مدير النظام',
            'email' => 'admin@erp.com',
            'password' => bcrypt('password'),
            'role' => 'admin',
            'permissions' => [
                "manage_all",
                "manage_inventory",
                "manage_accounts",
                "manage_settings",
                "manage_production",
                "manage_sales",
                "manage_categories"
            ]
        ]);

        // Seed some other test users
        User::create([
            'name' => 'موظف المبيعات',
            'email' => 'sales@erp.com',
            'password' => bcrypt('password'),
            'role' => 'worker',
            'permissions' => [
                "manage_sales"
            ]
        ]);

        User::create([
            'name' => 'مدير المخازن',
            'email' => 'warehouse@erp.com',
            'password' => bcrypt('password'),
            'role' => 'manager',
            'permissions' => [
                "manage_inventory",
                "manage_production"
            ]
        ]);

        // Seed Measurement Units
        \DB::table('measurement_units')->insert([
            ['name' => 'متر', 'type' => 'length', 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'كيلو', 'type' => 'weight', 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'لوح', 'type' => 'general', 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'حبة', 'type' => 'quantity', 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'لتر', 'type' => 'volume', 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'طقم', 'type' => 'quantity', 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'متر مربع', 'type' => 'area', 'created_at' => now(), 'updated_at' => now()],
        ]);

        // Seed Settings
        \DB::table('settings')->insert([
            ['key' => 'company_name', 'value' => 'مكتبة ورشة أثاث الموارد', 'created_at' => now(), 'updated_at' => now()],
            ['key' => 'currency', 'value' => 'ر.س', 'created_at' => now(), 'updated_at' => now()],
            ['key' => 'tax_rate', 'value' => '15', 'created_at' => now(), 'updated_at' => now()],
        ]);

        // Seed Notifications
        \DB::table('notifications')->insert([
            ['title' => 'مخزون منخفض', 'message' => 'لقد شارف مخزون ماسورة حديد 40×40 على الانتهاء.', 'is_read' => false, 'created_at' => now(), 'updated_at' => now()],
            ['title' => 'طلب تصنيع جديد', 'message' => 'تم إنشاء أمر تشغيل جديد رقم OP-2026-0003.', 'is_read' => false, 'created_at' => now(), 'updated_at' => now()],
            ['title' => 'تحديث النظام', 'message' => 'تم ترقية نظام الـ ERP إلى الإصدار v2.0 بنجاح.', 'is_read' => true, 'created_at' => now()->subDays(1), 'updated_at' => now()->subDays(1)],
        ]);

        // 2. Seed Warehouses
        $whMain = Warehouse::create([
            'name' => 'المخزن الرئيسي',
            'code' => 'WH-MAIN',
            'description' => 'المخزن الرئيسي لتخزين البضائع والمواد بمختلف أنواعها',
            'address' => 'المنطقة الصناعية، الرياض',
            'notes' => 'يحتوي على نظام تكييف متكامل'
        ]);

        $whRaw = Warehouse::create([
            'name' => 'مخزن المواد الخام',
            'code' => 'WH-RAW',
            'description' => 'مخزن مخصص لتفريغ وتخزين المواد الخام الواردة من الموردين قبل التصنيع',
            'address' => 'المنطقة الصناعية، الرياض - البوابة الشرقية',
            'notes' => 'قريب من خط الإنتاج الأول'
        ]);

        $whFin = Warehouse::create([
            'name' => 'مخزن المنتجات الجاهزة',
            'code' => 'WH-FIN',
            'description' => 'مخزن مخصص لحفظ المنتجات الجاهزة للتسليم النهائي للعملاء المعارض',
            'address' => 'حي الملز، الرياض',
            'notes' => 'مراقب بالكاميرات على مدار الساعة'
        ]);

        // 3. Seed Material Categories
        $catPipes = MaterialCategory::create(['name' => 'مواسير حديد']);
        $catSheet = MaterialCategory::create(['name' => 'صاج']);
        $catWood = MaterialCategory::create(['name' => 'خشب']);
        $catFoam = MaterialCategory::create(['name' => 'إسفنج']);
        $catPaint = MaterialCategory::create(['name' => 'دهانات']);
        $catAccess = MaterialCategory::create(['name' => 'إكسسوارات']);
        $catWrap = MaterialCategory::create(['name' => 'تغليف']);

        // 4. Seed Materials
        $matPipe40 = Material::create([
            'name' => 'ماسورة حديد 40×40',
            'code' => 'MAT-PIPE-40',
            'sku' => 'SKU-MAT-PIPE-40',
            'unit' => 'متر',
            'unit_cost' => 12.00,
            'category_id' => $catPipes->id,
            'description' => 'ماسورة حديد مربعة سمك 2 مم لتصنيع الهياكل المعدنية'
        ]);

        $matPipe30 = Material::create([
            'name' => 'ماسورة حديد 30×30',
            'code' => 'MAT-PIPE-30',
            'sku' => 'SKU-MAT-PIPE-30',
            'unit' => 'متر',
            'unit_cost' => 9.00,
            'category_id' => $catPipes->id,
            'description' => 'ماسورة حديد مربعة سمك 1.5 مم لتصنيع الهياكل الخفيفة'
        ]);

        $matSheet1 = Material::create([
            'name' => 'صاج سمك 1 مم',
            'code' => 'MAT-SHEET-1',
            'sku' => 'SKU-MAT-SHEET-1',
            'unit' => 'لوح',
            'unit_cost' => 45.00,
            'category_id' => $catSheet->id,
            'description' => 'لوح صاج حديد مجلفن مقاس 1.2×2.4 متر'
        ]);

        $matSheet2 = Material::create([
            'name' => 'صاج سمك 2 مم',
            'code' => 'MAT-SHEET-2',
            'sku' => 'SKU-MAT-SHEET-2',
            'unit' => 'لوح',
            'unit_cost' => 75.00,
            'category_id' => $catSheet->id,
            'description' => 'لوح صاج حديد مقاس 1.2×2.4 متر مناسب للتحمل العالي'
        ]);

        $matMdf = Material::create([
            'name' => 'لوح MDF',
            'code' => 'MAT-MDF',
            'sku' => 'SKU-MAT-MDF',
            'unit' => 'لوح',
            'unit_cost' => 55.00,
            'category_id' => $catWood->id,
            'description' => 'لوح خشب MDF سماكة 18 مم مقاس 1.22×2.44 متر'
        ]);

        $matFoam = Material::create([
            'name' => 'إسفنج كثافة عالية',
            'code' => 'MAT-FOAM-HD',
            'sku' => 'SKU-MAT-FOAM-HD',
            'unit' => 'متر مربع',
            'unit_cost' => 15.00,
            'category_id' => $catFoam->id,
            'description' => 'إسفنج ضغط 40 لتنجيد الكراسي والمقاعد'
        ]);

        $matPaint = Material::create([
            'name' => 'دهان إلكتروستاتيك',
            'code' => 'MAT-PAINT-ES',
            'sku' => 'SKU-MAT-PAINT-ES',
            'unit' => 'لتر',
            'unit_cost' => 8.00,
            'category_id' => $catPaint->id,
            'description' => 'بودرة دهان حراري للحديد لون أسود مطفي'
        ]);

        $matLock = Material::create([
            'name' => 'إكسسوار قفل ومقبض',
            'code' => 'MAT-ACCESS-LOCK',
            'sku' => 'SKU-MAT-ACCESS-LOCK',
            'unit' => 'طقم',
            'unit_cost' => 5.00,
            'category_id' => $catAccess->id,
            'description' => 'طقم قفل ومقبض للخزائن المعدنية والمكاتب'
        ]);

        // 5. Seed Product Categories
        $pCatChairs = ProductCategory::create(['name' => 'كراسي']);
        $pCatTables = ProductCategory::create(['name' => 'طاولات']);
        $pCatDesks = ProductCategory::create(['name' => 'مكاتب']);
        $pCatCabinets = ProductCategory::create(['name' => 'خزائن']);
        $pCatShelves = ProductCategory::create(['name' => 'أرفف']);

        // 6. Seed Products
        $pChairA101 = Product::create([
            'name' => 'كرسي معدني موديل A101',
            'code' => 'PROD-CHAIR-A101',
            'sku' => 'SKU-PROD-CHAIR-A101',
            'unit' => 'حبة',
            'unit_cost' => 35.00,
            'sale_price' => 75.00,
            'category_id' => $pCatChairs->id,
            'description' => 'كرسي معدني متين من مواسير 40×40 وقاعدة صاج مبطنة بالإسفنج'
        ]);

        $pChairA102 = Product::create([
            'name' => 'كرسي معدني موديل A102',
            'code' => 'PROD-CHAIR-A102',
            'sku' => 'SKU-PROD-CHAIR-A102',
            'unit' => 'حبة',
            'unit_cost' => 28.50,
            'sale_price' => 60.00,
            'category_id' => $pCatChairs->id,
            'description' => 'كرسي معدني خفيف من مواسير 30×30 وقاعدة صاج مطلية حرارياً'
        ]);

        $pTableMeet = Product::create([
            'name' => 'طاولة اجتماعات خشبية',
            'code' => 'PROD-TABLE-MEET',
            'sku' => 'SKU-PROD-TABLE-MEET',
            'unit' => 'حبة',
            'unit_cost' => 110.00,
            'sale_price' => 250.00,
            'category_id' => $pCatTables->id,
            'description' => 'طاولة اجتماعات كبيرة تتسع لـ 8 أشخاص بهيكل حديد وسطح MDF فاخر'
        ]);

        $pDeskExec = Product::create([
            'name' => 'مكتب إداري موديل M200',
            'code' => 'PROD-DESK-M200',
            'sku' => 'SKU-PROD-DESK-M200',
            'unit' => 'حبة',
            'unit_cost' => 95.00,
            'sale_price' => 210.00,
            'category_id' => $pCatDesks->id,
            'description' => 'مكتب إداري مع أدراج جانبية وقفل للأمان وهيكل معدني متين'
        ]);

        $pCabinetMet = Product::create([
            'name' => 'خزانة معدنية 4 رفوف',
            'code' => 'PROD-CABINET-MET',
            'sku' => 'SKU-PROD-CABINET-MET',
            'unit' => 'حبة',
            'unit_cost' => 150.00,
            'sale_price' => 320.00,
            'category_id' => $pCatCabinets->id,
            'description' => 'خزانة ملفات معدنية مقاس كبير لحفظ المستندات والعهود'
        ]);

        // 7. Seed Bill of Materials (BOM)
        // A101 Chair BOM
        ProductMaterial::create(['product_id' => $pChairA101->id, 'material_id' => $matPipe40->id, 'quantity' => 1.5000]);
        ProductMaterial::create(['product_id' => $pChairA101->id, 'material_id' => $matSheet1->id, 'quantity' => 0.2000]);
        ProductMaterial::create(['product_id' => $pChairA101->id, 'material_id' => $matFoam->id, 'quantity' => 0.2500]);
        ProductMaterial::create(['product_id' => $pChairA101->id, 'material_id' => $matPaint->id, 'quantity' => 0.5000]);

        // A102 Chair BOM
        ProductMaterial::create(['product_id' => $pChairA102->id, 'material_id' => $matPipe30->id, 'quantity' => 1.8000]);
        ProductMaterial::create(['product_id' => $pChairA102->id, 'material_id' => $matSheet1->id, 'quantity' => 0.2500]);
        ProductMaterial::create(['product_id' => $pChairA102->id, 'material_id' => $matPaint->id, 'quantity' => 0.4000]);

        // Table BOM
        ProductMaterial::create(['product_id' => $pTableMeet->id, 'material_id' => $matPipe40->id, 'quantity' => 4.5000]);
        ProductMaterial::create(['product_id' => $pTableMeet->id, 'material_id' => $matMdf->id, 'quantity' => 0.6000]);
        ProductMaterial::create(['product_id' => $pTableMeet->id, 'material_id' => $matPaint->id, 'quantity' => 1.2000]);

        // Desk BOM
        ProductMaterial::create(['product_id' => $pDeskExec->id, 'material_id' => $matPipe30->id, 'quantity' => 3.0000]);
        ProductMaterial::create(['product_id' => $pDeskExec->id, 'material_id' => $matMdf->id, 'quantity' => 0.8000]);
        ProductMaterial::create(['product_id' => $pDeskExec->id, 'material_id' => $matLock->id, 'quantity' => 1.0000]);
        ProductMaterial::create(['product_id' => $pDeskExec->id, 'material_id' => $matPaint->id, 'quantity' => 0.8000]);

        // Cabinet BOM
        ProductMaterial::create(['product_id' => $pCabinetMet->id, 'material_id' => $matSheet2->id, 'quantity' => 1.8000]);
        ProductMaterial::create(['product_id' => $pCabinetMet->id, 'material_id' => $matLock->id, 'quantity' => 1.0000]);
        ProductMaterial::create(['product_id' => $pCabinetMet->id, 'material_id' => $matPaint->id, 'quantity' => 2.5000]);

        // 8. Seed Suppliers
        $supAlNour = Supplier::create([
            'name' => 'شركة النور للحديد',
            'contact_person' => 'م. أحمد سعيد',
            'phone' => '0501234567',
            'email' => 'contact@alnour-steel.com',
            'address' => 'جدة، المنطقة الصناعية الخامسة',
            'notes' => 'المورد الرئيسي لمواسير وصاج الحديد'
        ]);

        $supAlRowad = Supplier::create([
            'name' => 'شركة الرواد للمعادن',
            'contact_person' => 'أ. فهد المطلق',
            'phone' => '0541112222',
            'email' => 'sales@alrowad-metals.com',
            'address' => 'الدمام، ميناء الملك عبد العزيز',
            'notes' => 'مورد صاج مجلفن وبودرة طلاء حراري'
        ]);

        $supAmal = Supplier::create([
            'name' => 'مؤسسة الأمل التجارية',
            'contact_person' => 'خالد السعيد',
            'phone' => '0569998888',
            'email' => 'info@alamal-corp.com',
            'address' => 'الرياض، حي السلي',
            'notes' => 'مورد أخشاب وإكسسوارات كراسي ومكاتب'
        ]);

        $supModern = Supplier::create([
            'name' => 'شركة التقنية الحديثة',
            'contact_person' => 'م. طارق العتوم',
            'phone' => '0597776666',
            'email' => 'supplies@mod-tech.com',
            'address' => 'الجبيل الصناعية',
            'notes' => 'مورد أدوات وتعبئة وتغليف'
        ]);

        // 9. Seed Clients
        $clientFuture = Client::create([
            'name' => 'شركة المستقبل للخدمات العقارية',
            'contact_person' => 'أ. عبد الرحمن الراجحي',
            'phone' => '0538887777',
            'email' => 'info@future-services.com',
            'address' => 'الرياض، حي النخيل',
            'notes' => 'عميل متميز، يطلب مكاتب وخزائن بكميات كبيرة'
        ]);

        $clientHuda = Client::create([
            'name' => 'مؤسسة الهدى للمقاولات العامة',
            'contact_person' => 'المهندس وليد خالد',
            'phone' => '0554443332',
            'email' => 'projects@huda-const.com',
            'address' => 'مكة المكرمة، العزيزية',
            'notes' => 'يطلب طاولات اجتماعات وكراسي لتهيئة مقار المشاريع'
        ]);

        $clientSafwa = Client::create([
            'name' => 'شركة الصفوة القابضة',
            'contact_person' => 'أ. سمير الأحمد',
            'phone' => '0507775555',
            'email' => 'procurement@safwa.com',
            'address' => 'الرياض، حي المروج',
            'notes' => 'تطلب أثاث سنوي لمعارضها'
        ]);

        $clientModernFurniture = Client::create([
            'name' => 'معرض الأثاث الحديث للمفروشات',
            'contact_person' => 'أ. تركي السديري',
            'phone' => '0543339999',
            'email' => 'sales@modern-furniture.com',
            'address' => 'الخبر، طريق الملك فهد',
            'notes' => 'صالة عرض للأثاث المعدني والمكتبي'
        ]);

        // 10. Seed Initial Inventory Balance (Movements)
        $materials = [
            $matPipe40->id => ['qty' => 500, 'cost' => 12.00],
            $matPipe30->id => ['qty' => 600, 'cost' => 9.00],
            $matSheet1->id => ['qty' => 200, 'cost' => 45.00],
            $matSheet2->id => ['qty' => 150, 'cost' => 75.00],
            $matMdf->id => ['qty' => 100, 'cost' => 55.00],
            $matFoam->id => ['qty' => 300, 'cost' => 15.00],
            $matPaint->id => ['qty' => 120, 'cost' => 8.00],
            $matLock->id => ['qty' => 80, 'cost' => 5.00],
        ];

        $mvCount = 1;
        foreach ($materials as $matId => $data) {
            $mvNo = 'MV-' . str_pad($mvCount++, 5, '0', STR_PAD_LEFT);
            $qty = $data['qty'];
            $cost = $data['cost'];
            
            InventoryMovement::create([
                'movement_number' => $mvNo,
                'movement_date' => Carbon::now()->subDays(10),
                'warehouse_id' => $whRaw->id,
                'material_id' => $matId,
                'product_id' => null,
                'movement_type' => 'Initial_Balance',
                'quantity' => $qty,
                'unit_cost' => $cost,
                'total_cost' => $qty * $cost,
                'reference_number' => 'OP-BAL-2026',
                'notes' => 'رصيد مخزني افتتاحي لتهيئة المستودع الجديد',
                'created_by' => $admin->id
            ]);
        }

        // 11. Seed Purchase Orders
        // PO-001 (Received, increases stock, creates expense)
        $po1 = PurchaseOrder::create([
            'order_number' => 'PO-2026-0001',
            'supplier_id' => $supAlNour->id,
            'status' => 'Received',
            'order_date' => Carbon::now()->subDays(5),
            'total_amount' => 5400.00,
            'notes' => 'شراء مواسير إضافية لخط إنتاج كراسي الـ A101'
        ]);

        PurchaseOrderItem::create([
            'purchase_order_id' => $po1->id,
            'material_id' => $matPipe40->id,
            'quantity' => 200.00,
            'unit_cost' => 12.00,
            'total_cost' => 2400.00
        ]);

        PurchaseOrderItem::create([
            'purchase_order_id' => $po1->id,
            'material_id' => $matSheet1->id,
            'quantity' => 67.00, // 67 * 45 = 3015
            'unit_cost' => 45.00,
            'total_cost' => 3015.00
        ]);
        
        // Update total to match item sum
        $po1->update(['total_amount' => 5415.00]);

        // Create inventory movements for PO-001 materials
        $mvNo = 'MV-' . str_pad($mvCount++, 5, '0', STR_PAD_LEFT);
        InventoryMovement::create([
            'movement_number' => $mvNo,
            'movement_date' => Carbon::now()->subDays(5),
            'warehouse_id' => $whRaw->id,
            'material_id' => $matPipe40->id,
            'product_id' => null,
            'movement_type' => 'Purchase_Receipt',
            'quantity' => 200.00,
            'unit_cost' => 12.00,
            'total_cost' => 2400.00,
            'reference_number' => $po1->order_number,
            'notes' => 'استلام بضاعة - فاتورة رقم ' . $po1->order_number,
            'created_by' => $admin->id
        ]);

        $mvNo = 'MV-' . str_pad($mvCount++, 5, '0', STR_PAD_LEFT);
        InventoryMovement::create([
            'movement_number' => $mvNo,
            'movement_date' => Carbon::now()->subDays(5),
            'warehouse_id' => $whRaw->id,
            'material_id' => $matSheet1->id,
            'product_id' => null,
            'movement_type' => 'Purchase_Receipt',
            'quantity' => 67.00,
            'unit_cost' => 45.00,
            'total_cost' => 3015.00,
            'reference_number' => $po1->order_number,
            'notes' => 'استلام بضاعة - فاتورة رقم ' . $po1->order_number,
            'created_by' => $admin->id
        ]);

        // Create financial expense for PO-001
        Expense::create([
            'expense_number' => 'EXP-2026-0001',
            'amount' => 5415.00,
            'expense_date' => Carbon::now()->subDays(5),
            'category' => 'شراء مواد خام',
            'description' => 'تكلفة فاتورة المشتريات من شركة النور للحديد رقم ' . $po1->order_number,
            'reference_number' => $po1->order_number
        ]);

        // PO-002 (Pending)
        $po2 = PurchaseOrder::create([
            'order_number' => 'PO-2026-0002',
            'supplier_id' => $supAlRowad->id,
            'status' => 'Pending',
            'order_date' => Carbon::now()->subDays(1),
            'total_amount' => 3750.00,
            'notes' => 'شراء بودرة دهان وصاج سمك 2 مم'
        ]);

        PurchaseOrderItem::create([
            'purchase_order_id' => $po2->id,
            'material_id' => $matSheet2->id,
            'quantity' => 30.00,
            'unit_cost' => 75.00,
            'total_cost' => 2250.00
        ]);

        PurchaseOrderItem::create([
            'purchase_order_id' => $po2->id,
            'material_id' => $matPaint->id,
            'quantity' => 187.50, // 187.5 * 8 = 1500
            'unit_cost' => 8.00,
            'total_cost' => 1500.00
        ]);

        // 12. Seed Operations
        // OP-001 (Completed, 50 A101 Chairs. Raw materials consumed, finished product received)
        $op1 = Operation::create([
            'operation_number' => 'OP-2026-0001',
            'product_id' => $pChairA101->id,
            'quantity' => 50.00,
            'warehouse_id' => $whRaw->id, // materials consumed from whRaw
            'status' => 'Completed',
            'start_date' => Carbon::now()->subDays(4),
            'completion_date' => Carbon::now()->subDays(3),
            'notes' => 'أمر تصنيع كراسي لطلب مؤسسة الهدى'
        ]);

        // Consumption for OP-001
        // Pipes: 50 * 1.5 = 75m
        $mvNo = 'MV-' . str_pad($mvCount++, 5, '0', STR_PAD_LEFT);
        InventoryMovement::create([
            'movement_number' => $mvNo,
            'movement_date' => Carbon::now()->subDays(4),
            'warehouse_id' => $whRaw->id,
            'material_id' => $matPipe40->id,
            'product_id' => null,
            'movement_type' => 'Production_Consumption',
            'quantity' => 75.00,
            'unit_cost' => 12.00,
            'total_cost' => 900.00,
            'reference_number' => $op1->operation_number,
            'notes' => 'استهلاك تصنيع - أمر تشغيل رقم ' . $op1->operation_number,
            'created_by' => $admin->id
        ]);

        // Sheet 1: 50 * 0.2 = 10 sheets
        $mvNo = 'MV-' . str_pad($mvCount++, 5, '0', STR_PAD_LEFT);
        InventoryMovement::create([
            'movement_number' => $mvNo,
            'movement_date' => Carbon::now()->subDays(4),
            'warehouse_id' => $whRaw->id,
            'material_id' => $matSheet1->id,
            'product_id' => null,
            'movement_type' => 'Production_Consumption',
            'quantity' => 10.00,
            'unit_cost' => 45.00,
            'total_cost' => 450.00,
            'reference_number' => $op1->operation_number,
            'notes' => 'استهلاك تصنيع - أمر تشغيل رقم ' . $op1->operation_number,
            'created_by' => $admin->id
        ]);

        // Foam: 50 * 0.25 = 12.5 sq.m
        $mvNo = 'MV-' . str_pad($mvCount++, 5, '0', STR_PAD_LEFT);
        InventoryMovement::create([
            'movement_number' => $mvNo,
            'movement_date' => Carbon::now()->subDays(4),
            'warehouse_id' => $whRaw->id,
            'material_id' => $matFoam->id,
            'product_id' => null,
            'movement_type' => 'Production_Consumption',
            'quantity' => 12.50,
            'unit_cost' => 15.00,
            'total_cost' => 187.50,
            'reference_number' => $op1->operation_number,
            'notes' => 'استهلاك تصنيع - أمر تشغيل رقم ' . $op1->operation_number,
            'created_by' => $admin->id
        ]);

        // Paint: 50 * 0.5 = 25L
        $mvNo = 'MV-' . str_pad($mvCount++, 5, '0', STR_PAD_LEFT);
        InventoryMovement::create([
            'movement_number' => $mvNo,
            'movement_date' => Carbon::now()->subDays(4),
            'warehouse_id' => $whRaw->id,
            'material_id' => $matPaint->id,
            'product_id' => null,
            'movement_type' => 'Production_Consumption',
            'quantity' => 25.00,
            'unit_cost' => 8.00,
            'total_cost' => 200.00,
            'reference_number' => $op1->operation_number,
            'notes' => 'استهلاك تصنيع - أمر تشغيل رقم ' . $op1->operation_number,
            'created_by' => $admin->id
        ]);

        // Receipts of Finished Products: 50 Chairs to whFin
        $mvNo = 'MV-' . str_pad($mvCount++, 5, '0', STR_PAD_LEFT);
        InventoryMovement::create([
            'movement_number' => $mvNo,
            'movement_date' => Carbon::now()->subDays(3),
            'warehouse_id' => $whFin->id,
            'material_id' => null,
            'product_id' => $pChairA101->id,
            'movement_type' => 'Purchase_Receipt', // increases stock of finished product (or we can define it as Receipt)
            'quantity' => 50.00,
            'unit_cost' => 35.00, // production cost
            'total_cost' => 1750.00,
            'reference_number' => $op1->operation_number,
            'notes' => 'توريد منتج جاهز - إتمام تصنيع أمر ' . $op1->operation_number,
            'created_by' => $admin->id
        ]);

        // OP-002 (In_Progress, 10 Exec Desks. Materials consumed)
        $op2 = Operation::create([
            'operation_number' => 'OP-2026-0002',
            'product_id' => $pDeskExec->id,
            'quantity' => 10.00,
            'warehouse_id' => $whRaw->id,
            'status' => 'In_Progress',
            'start_date' => Carbon::now()->subDays(1),
            'completion_date' => null,
            'notes' => 'مكتب إداري لصالح شركة المستقبل'
        ]);

        // Consumption for OP-002
        // Pipes 30x30: 10 * 3.0 = 30m
        $mvNo = 'MV-' . str_pad($mvCount++, 5, '0', STR_PAD_LEFT);
        InventoryMovement::create([
            'movement_number' => $mvNo,
            'movement_date' => Carbon::now()->subDays(1),
            'warehouse_id' => $whRaw->id,
            'material_id' => $matPipe30->id,
            'product_id' => null,
            'movement_type' => 'Production_Consumption',
            'quantity' => 30.00,
            'unit_cost' => 9.00,
            'total_cost' => 270.00,
            'reference_number' => $op2->operation_number,
            'notes' => 'استهلاك تصنيع - أمر تشغيل رقم ' . $op2->operation_number,
            'created_by' => $admin->id
        ]);

        // MDF: 10 * 0.8 = 8 boards
        $mvNo = 'MV-' . str_pad($mvCount++, 5, '0', STR_PAD_LEFT);
        InventoryMovement::create([
            'movement_number' => $mvNo,
            'movement_date' => Carbon::now()->subDays(1),
            'warehouse_id' => $whRaw->id,
            'material_id' => $matMdf->id,
            'product_id' => null,
            'movement_type' => 'Production_Consumption',
            'quantity' => 8.00,
            'unit_cost' => 55.00,
            'total_cost' => 440.00,
            'reference_number' => $op2->operation_number,
            'notes' => 'استهلاك تصنيع - أمر تشغيل رقم ' . $op2->operation_number,
            'created_by' => $admin->id
        ]);

        // Locks: 10 * 1 = 10 locks
        $mvNo = 'MV-' . str_pad($mvCount++, 5, '0', STR_PAD_LEFT);
        InventoryMovement::create([
            'movement_number' => $mvNo,
            'movement_date' => Carbon::now()->subDays(1),
            'warehouse_id' => $whRaw->id,
            'material_id' => $matLock->id,
            'product_id' => null,
            'movement_type' => 'Production_Consumption',
            'quantity' => 10.00,
            'unit_cost' => 5.00,
            'total_cost' => 50.00,
            'reference_number' => $op2->operation_number,
            'notes' => 'استهلاك تصنيع - أمر تشغيل رقم ' . $op2->operation_number,
            'created_by' => $admin->id
        ]);

        // Paint: 10 * 0.8 = 8L
        $mvNo = 'MV-' . str_pad($mvCount++, 5, '0', STR_PAD_LEFT);
        InventoryMovement::create([
            'movement_number' => $mvNo,
            'movement_date' => Carbon::now()->subDays(1),
            'warehouse_id' => $whRaw->id,
            'material_id' => $matPaint->id,
            'product_id' => null,
            'movement_type' => 'Production_Consumption',
            'quantity' => 8.00,
            'unit_cost' => 8.00,
            'total_cost' => 64.00,
            'reference_number' => $op2->operation_number,
            'notes' => 'استهلاك تصنيع - أمر تشغيل رقم ' . $op2->operation_number,
            'created_by' => $admin->id
        ]);

        // OP-003 (Pending)
        Operation::create([
            'operation_number' => 'OP-2026-0003',
            'product_id' => $pTableMeet->id,
            'quantity' => 5.00,
            'warehouse_id' => $whRaw->id,
            'status' => 'Pending',
            'start_date' => null,
            'completion_date' => null,
            'notes' => 'طاولات اجتماعات لمشروع العزيزية بمكة'
        ]);

        // 13. Seed Additional Expenses and Revenues for Dashboard Graphs
        // Expenses
        Expense::create([
            'expense_number' => 'EXP-2026-0002',
            'amount' => 1200.00,
            'expense_date' => Carbon::now()->subDays(25),
            'category' => 'المرافق الخدمية',
            'description' => 'فاتورة الكهرباء لشهر مايو للمخازن والورشة',
            'reference_number' => null
        ]);

        Expense::create([
            'expense_number' => 'EXP-2026-0003',
            'amount' => 12500.00,
            'expense_date' => Carbon::now()->subDays(30),
            'category' => 'الرواتب والأجور',
            'description' => 'رواتب عمال الورشة وأمناء المخازن لدفعة مايو',
            'reference_number' => null
        ]);

        Expense::create([
            'expense_number' => 'EXP-2026-0004',
            'amount' => 3000.00,
            'expense_date' => Carbon::now()->subDays(15),
            'category' => 'الإيجار والمقرات',
            'description' => 'إيجار نصف سنوي لمخزن المنتجات الجاهزة',
            'reference_number' => null
        ]);

        // Revenues
        Revenue::create([
            'revenue_number' => 'REV-2026-0001',
            'amount' => 15000.00,
            'revenue_date' => Carbon::now()->subDays(2),
            'category' => 'مبيعات منتجات جاهزة',
            'description' => 'توريد كراسي معدنية لصالح صالة الخبر - معرض الأثاث الحديث',
            'reference_number' => 'INV-0001-A'
        ]);

        Revenue::create([
            'revenue_number' => 'REV-2026-0002',
            'amount' => 8500.00,
            'revenue_date' => Carbon::now()->subDays(12),
            'category' => 'مبيعات منتجات جاهزة',
            'description' => 'تسليم دفعة أولى من المكاتب لشركة المستقبل',
            'reference_number' => 'INV-0002-A'
        ]);

        Revenue::create([
            'revenue_number' => 'REV-2026-0003',
            'amount' => 42000.00,
            'revenue_date' => Carbon::now()->subDays(22),
            'category' => 'مبيعات مشاريع',
            'description' => 'تهيئة وتجهيز مقر مؤسسة الهدى بمكة المكرمة بالكامل',
            'reference_number' => 'INV-0003-A'
        ]);
    }
}
