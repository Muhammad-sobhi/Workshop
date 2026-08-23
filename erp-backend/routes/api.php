<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\WarehouseController;
use App\Http\Controllers\Api\InventoryController;
use App\Http\Controllers\Api\OperationController;
use App\Http\Controllers\Api\PurchaseOrderController;
use App\Http\Controllers\Api\ExpenseController;
use App\Http\Controllers\Api\SupplierController;
use App\Http\Controllers\Api\MaterialController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CategoriesController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\NotificationsController;
use App\Http\Controllers\Api\ExternalServiceOrderController;
use App\Http\Controllers\Api\TreasuryController;
use App\Http\Controllers\Api\EmployeeController;

// Public Auth routes
Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
Route::post('/auth/register', [AuthController::class, 'register'])
    ->middleware('throttle:' . config('erp.registration_rate_limit', '5,1'));

// Protected routes
Route::middleware(['auth:sanctum', \App\Http\Middleware\TenantMiddleware::class])->group(function () {
    
    // Auth profile
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::put('/auth/profile', [AuthController::class, 'updateProfile']);

    // Dashboard
    Route::get('/dashboard', [DashboardController::class, 'index']);

    // Treasury (الخزينة والسيولة النقدية)
    Route::get('/treasury/summary', [TreasuryController::class, 'summary']);
    Route::get('/treasury/transactions', [TreasuryController::class, 'transactions']);
    Route::middleware('permission:manage_accounts')->group(function () {
        Route::post('/treasury/deposit', [TreasuryController::class, 'deposit']);
        Route::post('/treasury/withdraw', [TreasuryController::class, 'withdraw']);
        Route::post('/treasury/transfer', [TreasuryController::class, 'transfer']);
    });


    // Employee Management (Salaries Module — Decoupled from Accounts)
    Route::get('/employees/stats', [EmployeeController::class, 'stats']);
    Route::get('/employees-salaries', [EmployeeController::class, 'allSalaries']);
    Route::get('/employees', [EmployeeController::class, 'index']);
    Route::get('/employees/{id}', [\App\Http\Controllers\Api\EmployeeController::class, 'show']);
    Route::middleware('permission:manage_employees')->group(function () {
        Route::post('/employees', [EmployeeController::class, 'store']);
        Route::put('/employees/{id}', [\App\Http\Controllers\Api\EmployeeController::class, 'update']);
        Route::delete('/employees/{id}', [\App\Http\Controllers\Api\EmployeeController::class, 'destroy']);
        Route::post('/employees/{id}/salaries', [\App\Http\Controllers\Api\EmployeeController::class, 'recordSalary']);
        Route::delete('/employees/{id}/salaries/{sid}', [\App\Http\Controllers\Api\EmployeeController::class, 'deleteSalary']);

        // ---- Employee Labor: Timesheets (weekly grid, Sat->Thu) ----
        Route::post('/timesheets/bulk-payout', [\App\Http\Controllers\Api\TimesheetController::class, 'bulkPayout']);
        Route::post('/employees/{id}/timesheet', [\App\Http\Controllers\Api\TimesheetController::class, 'save']);
        Route::delete('/employees/{id}/timesheet', [\App\Http\Controllers\Api\TimesheetController::class, 'destroy']);

        // ---- Employee Labor: Production Logs ----
        Route::post('/employees/{id}/production-logs', [\App\Http\Controllers\Api\ProductionLogController::class, 'store']);
        Route::put('/employees-production-logs/{log}', [\App\Http\Controllers\Api\ProductionLogController::class, 'update']);
        Route::delete('/employees-production-logs/{log}', [\App\Http\Controllers\Api\ProductionLogController::class, 'destroy']);
    });

    // ---- Employee Labor: Timesheets (read-only) ----
    Route::get('/timesheets/bulk-preview', [\App\Http\Controllers\Api\TimesheetController::class, 'bulkPreview']);
    Route::get('/employees/{id}/timesheet', [\App\Http\Controllers\Api\TimesheetController::class, 'show']);
    Route::get('/employees/{id}/salaries', [\App\Http\Controllers\Api\EmployeeController::class, 'salaries']);

    // ---- Employee Labor: Production Logs (read-only) ----
    Route::get('/employees-production-logs', [\App\Http\Controllers\Api\ProductionLogController::class, 'index']);

    // ---- Employee Debt Ledger ----
    Route::get('/employees-ledger', [\App\Http\Controllers\Api\EmployeeLedgerController::class, 'index']);
    Route::get('/employees/{id}/ledger', [\App\Http\Controllers\Api\EmployeeLedgerController::class, 'statement']);

    // Warehouses CRUD
    Route::get('/warehouses', [WarehouseController::class, 'index']);
    Route::get('/warehouses/{id}', [WarehouseController::class, 'show']);
    Route::middleware('permission:manage_inventory')->group(function () {
        Route::post('/warehouses', [WarehouseController::class, 'store']);
        Route::put('/warehouses/{id}', [WarehouseController::class, 'update']);
        Route::delete('/warehouses/{id}', [WarehouseController::class, 'destroy']);

        // Inventory
        Route::post('/inventory/movements', [InventoryController::class, 'storeMovement']);
        Route::post('/inventory/bulk-initial-stock', [InventoryController::class, 'bulkInitialStock']);
    });
    Route::get('/inventory', [InventoryController::class, 'index']);
    Route::get('/inventory/materials', [InventoryController::class, 'getMaterials']);
    Route::get('/inventory/products', [InventoryController::class, 'getProducts']);
    Route::get('/inventory/movements', [InventoryController::class, 'getMovements']);
    Route::get('/inventory/ledger/{type}/{id}', [InventoryController::class, 'getLedger']);

    // Materials CRUD (full management)
    Route::get('/materials', [MaterialController::class, 'index']);
    Route::get('/materials/categories', [MaterialController::class, 'categories']);
    Route::get('/materials/{id}', [MaterialController::class, 'show']);
    Route::get('/materials/{id}/price-impact', [MaterialController::class, 'getPriceImpact']);
    Route::get('/materials/{id}/price-history', [MaterialController::class, 'getPriceHistory']);
    Route::middleware('permission:manage_inventory')->group(function () {
        Route::post('/materials/bulk-import', [MaterialController::class, 'bulkImport'])->middleware('throttle:60,1');
        Route::post('/materials', [MaterialController::class, 'store']);
        Route::put('/materials/{id}', [MaterialController::class, 'update']);
        Route::delete('/materials/{id}', [MaterialController::class, 'destroy']);
        Route::post('/materials/{id}/update-price', [MaterialController::class, 'updatePriceWithOptions']);
    });

    // Products CRUD + BOM Management
    Route::get('/products', [ProductController::class, 'index']);
    Route::get('/products/categories', [ProductController::class, 'categories']);
    Route::get('/products/stats', [ProductController::class, 'stats']);
    Route::get('/products/{id}', [ProductController::class, 'show']);
    Route::middleware('permission:manage_inventory')->group(function () {
        Route::post('/products/bulk-import', [ProductController::class, 'bulkImport'])->middleware('throttle:60,1');
        Route::post('/products', [ProductController::class, 'store']);
        Route::put('/products/{id}', [ProductController::class, 'update']);
        Route::delete('/products/{id}', [ProductController::class, 'destroy']);
    });

    // Suppliers CRUD + Material Links
    Route::get('/suppliers', [SupplierController::class, 'index']);
    Route::get('/suppliers/all-with-materials', [SupplierController::class, 'allWithMaterials']);
    Route::get('/suppliers/{id}', [SupplierController::class, 'show']);
    Route::get('/suppliers/{id}/materials', [SupplierController::class, 'getMaterials']);
    Route::get('/suppliers/{id}/transactions', [SupplierController::class, 'getSupplierTransactions']);
    Route::middleware('permission:manage_accounts')->group(function () {
        Route::post('/suppliers/{id}/pay-debt', [SupplierController::class, 'paySupplierDebt']);
        Route::delete('/suppliers/{id}/payments/{expenseId}', [SupplierController::class, 'deleteSupplierPayment']);
    });
    Route::middleware('permission:manage_inventory')->group(function () {
        Route::post('/suppliers/bulk-import', [SupplierController::class, 'bulkImportSuppliers'])->middleware('throttle:60,1');
        Route::post('/suppliers', [SupplierController::class, 'store']);
        Route::put('/suppliers/{id}', [SupplierController::class, 'update']);
        Route::delete('/suppliers/{id}', [SupplierController::class, 'destroy']);
        Route::post('/suppliers/{id}/materials', [SupplierController::class, 'addMaterial']);
        Route::delete('/suppliers/{id}/materials/{materialId}', [SupplierController::class, 'removeMaterial']);
    });

    // Operations (Production)
    Route::get('/operations', [OperationController::class, 'index']);
    Route::get('/operations/{id}/check-materials', [OperationController::class, 'checkMaterials']);
    Route::middleware('permission:manage_production')->group(function () {
        Route::post('/operations', [OperationController::class, 'store']);
        Route::put('/operations/{id}', [OperationController::class, 'update']);
        Route::post('/operations/{id}/start', [OperationController::class, 'startProduction']);
        Route::post('/operations/{id}/complete', [OperationController::class, 'completeProduction']);
        Route::post('/operations/{id}/deliver', [OperationController::class, 'deliverToClient']);
        Route::delete('/operations/{id}', [OperationController::class, 'destroy']);
        Route::post('/operations/{id}/cancel', [OperationController::class, 'cancelProduction']);
    });
    Route::middleware('permission:manage_accounts')->group(function () {
        Route::post('/operations/{id}/payments', [OperationController::class, 'addPayment']);
        Route::delete('/operations/{id}/payments/{paymentId}', [OperationController::class, 'deletePayment']);
    });

    // Purchase Orders
    Route::get('/purchase-orders', [PurchaseOrderController::class, 'index']);
    Route::get('/purchase-orders/{id}', [PurchaseOrderController::class, 'show']);
    Route::middleware('permission:manage_inventory')->group(function () {
        Route::post('/purchase-orders', [PurchaseOrderController::class, 'store']);
        Route::post('/purchase-orders/{id}/receive', [PurchaseOrderController::class, 'receiveOrder']);
        Route::put('/purchase-orders/{id}', [PurchaseOrderController::class, 'update']);
        Route::delete('/purchase-orders/{id}', [PurchaseOrderController::class, 'destroy']);
    });

    // External Service Orders (الخدمات الخارجية والمقاولين)
    Route::get('/external-service-orders', [ExternalServiceOrderController::class, 'index']);
    Route::get('/external-service-orders/analytics', [ExternalServiceOrderController::class, 'analytics']);
    Route::get('/external-service-orders/{id}', [ExternalServiceOrderController::class, 'show']);
    Route::middleware('permission:manage_accounts')->group(function () {
        Route::post('/external-service-orders', [ExternalServiceOrderController::class, 'store']);
        Route::post('/external-service-orders/{id}/payments', [ExternalServiceOrderController::class, 'recordPayment']);
        Route::delete('/external-service-orders/{id}/payments/{paymentId}', [ExternalServiceOrderController::class, 'deletePayment']);
        Route::put('/external-service-orders/{id}/status', [ExternalServiceOrderController::class, 'updateStatus']);
        Route::put('/external-service-orders/{id}/returns', [ExternalServiceOrderController::class, 'updateReturns']);
        Route::delete('/external-service-orders/{id}', [ExternalServiceOrderController::class, 'destroy']);
    });

    // Expenses
    Route::get('/expenses', [ExpenseController::class, 'index']);
    Route::middleware('permission:manage_accounts')->group(function () {
        Route::post('/expenses', [ExpenseController::class, 'store']);
        Route::delete('/expenses/{id}', [ExpenseController::class, 'destroy']);
    });

    // Sales & Clients
    Route::get('/sales', [\App\Http\Controllers\Api\SalesController::class, 'index']);
    Route::get('/clients', [\App\Http\Controllers\Api\SalesController::class, 'getClients']);
    Route::get('/clients/{id}/transactions', [\App\Http\Controllers\Api\SalesController::class, 'getClientTransactions']);
    Route::get('/clients/{id}/open-invoices', [\App\Http\Controllers\Api\SalesController::class, 'getClientOpenInvoices']);
    Route::middleware('permission:manage_sales')->group(function () {
        Route::post('/sales', [\App\Http\Controllers\Api\SalesController::class, 'store']);
        Route::post('/sales/historical', [\App\Http\Controllers\Api\SalesController::class, 'storeHistoricalSale']);
        Route::post('/clients/bulk-import', [\App\Http\Controllers\Api\SalesController::class, 'bulkImportClients'])->middleware('throttle:60,1');
        Route::post('/clients', [\App\Http\Controllers\Api\SalesController::class, 'storeClient']);
        Route::put('/clients/{id}', [\App\Http\Controllers\Api\SalesController::class, 'updateClient']);
        Route::delete('/clients/{id}', [\App\Http\Controllers\Api\SalesController::class, 'destroyClient']);
        Route::post('/clients/{id}/pay-debt', [\App\Http\Controllers\Api\SalesController::class, 'payClientDebt']);
        Route::delete('/clients/{id}/payments/{paymentId}', [\App\Http\Controllers\Api\SalesController::class, 'deleteClientPayment']);
    });

    // Categories Management (Unified)
    Route::get('/categories', [CategoriesController::class, 'index']);
    Route::middleware('permission:manage_categories')->group(function () {
        Route::post('/categories/material', [CategoriesController::class, 'storeMaterialCategory']);
        Route::put('/categories/material/{id}', [CategoriesController::class, 'updateMaterialCategory']);
        Route::delete('/categories/material/{id}', [CategoriesController::class, 'destroyMaterialCategory']);

        Route::post('/categories/product', [CategoriesController::class, 'storeProductCategory']);
        Route::put('/categories/product/{id}', [CategoriesController::class, 'updateProductCategory']);
        Route::delete('/categories/product/{id}', [CategoriesController::class, 'destroyProductCategory']);

        Route::post('/categories/unit', [CategoriesController::class, 'storeMeasurementUnit']);
        Route::put('/categories/unit/{id}', [CategoriesController::class, 'updateMeasurementUnit']);
        Route::delete('/categories/unit/{id}', [CategoriesController::class, 'destroyMeasurementUnit']);
    });

    // Settings & User Management
    Route::get('/settings', [SettingsController::class, 'getSettings']);
    Route::get('/users', [SettingsController::class, 'getUsers']);
    Route::middleware('permission:manage_settings')->group(function () {
        Route::post('/settings', [SettingsController::class, 'saveSettings']);
        Route::post('/settings/reset-data', [SettingsController::class, 'resetData']);
        Route::post('/users', [SettingsController::class, 'storeUser']);
        Route::put('/users/{id}', [SettingsController::class, 'updateUser']);
        Route::delete('/users/{id}', [SettingsController::class, 'destroyUser']);

        // Automated Backup System
        Route::get('/backup/export', [\App\Http\Controllers\Api\BackupController::class, 'exportBackup']);
        Route::post('/backup/restore', [\App\Http\Controllers\Api\BackupController::class, 'restoreBackup']);
    });
    Route::get('/backup/status', [\App\Http\Controllers\Api\BackupController::class, 'status']);

    // Notifications
    Route::get('/notifications', [NotificationsController::class, 'index']);
    Route::post('/notifications/{id}/read', [NotificationsController::class, 'markAsRead']);
    Route::post('/notifications/read-all', [NotificationsController::class, 'markAllAsRead']);
    Route::delete('/notifications/clear', [NotificationsController::class, 'clearAll']);
});
