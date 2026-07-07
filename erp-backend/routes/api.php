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

// Public Auth routes
Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
Route::post('/auth/register', [AuthController::class, 'register']);

// Protected routes
Route::middleware('auth:sanctum')->group(function () {
    
    // Auth profile
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::put('/auth/profile', [AuthController::class, 'updateProfile']);

    // Dashboard
    Route::get('/dashboard', [DashboardController::class, 'index']);

    // Warehouses CRUD
    Route::get('/warehouses', [WarehouseController::class, 'index']);
    Route::post('/warehouses', [WarehouseController::class, 'store']);
    Route::get('/warehouses/{id}', [WarehouseController::class, 'show']);
    Route::put('/warehouses/{id}', [WarehouseController::class, 'update']);
    Route::delete('/warehouses/{id}', [WarehouseController::class, 'destroy']);

    // Inventory
    Route::get('/inventory', [InventoryController::class, 'index']);
    Route::get('/inventory/materials', [InventoryController::class, 'getMaterials']);
    Route::get('/inventory/products', [InventoryController::class, 'getProducts']);
    Route::get('/inventory/movements', [InventoryController::class, 'getMovements']);
    Route::post('/inventory/movements', [InventoryController::class, 'storeMovement']);
    Route::get('/inventory/ledger/{type}/{id}', [InventoryController::class, 'getLedger']);

    // Materials CRUD (full management)
    Route::get('/materials', [MaterialController::class, 'index']);
    Route::get('/materials/categories', [MaterialController::class, 'categories']);
    Route::post('/materials', [MaterialController::class, 'store']);
    Route::get('/materials/{id}', [MaterialController::class, 'show']);
    Route::put('/materials/{id}', [MaterialController::class, 'update']);
    Route::delete('/materials/{id}', [MaterialController::class, 'destroy']);

    // Products CRUD + BOM Management
    Route::get('/products', [ProductController::class, 'index']);
    Route::get('/products/categories', [ProductController::class, 'categories']);
    Route::post('/products', [ProductController::class, 'store']);
    Route::get('/products/{id}', [ProductController::class, 'show']);
    Route::put('/products/{id}', [ProductController::class, 'update']);
    Route::delete('/products/{id}', [ProductController::class, 'destroy']);

    // Suppliers CRUD + Material Links
    Route::get('/suppliers', [SupplierController::class, 'index']);
    Route::get('/suppliers/all-with-materials', [SupplierController::class, 'allWithMaterials']);
    Route::post('/suppliers', [SupplierController::class, 'store']);
    Route::get('/suppliers/{id}', [SupplierController::class, 'show']);
    Route::put('/suppliers/{id}', [SupplierController::class, 'update']);
    Route::delete('/suppliers/{id}', [SupplierController::class, 'destroy']);
    Route::get('/suppliers/{id}/materials', [SupplierController::class, 'getMaterials']);
    Route::post('/suppliers/{id}/materials', [SupplierController::class, 'addMaterial']);
    Route::delete('/suppliers/{id}/materials/{materialId}', [SupplierController::class, 'removeMaterial']);
    Route::post('/suppliers/{id}/pay-debt', [SupplierController::class, 'paySupplierDebt']);

    // Operations (Production)
    Route::get('/operations', [OperationController::class, 'index']);
    Route::post('/operations', [OperationController::class, 'store']);
    Route::put('/operations/{id}', [OperationController::class, 'update']);
    Route::get('/operations/{id}/check-materials', [OperationController::class, 'checkMaterials']);
    Route::post('/operations/{id}/start', [OperationController::class, 'startProduction']);
    Route::post('/operations/{id}/complete', [OperationController::class, 'completeProduction']);
    Route::post('/operations/{id}/payments', [OperationController::class, 'addPayment']);

    // Purchase Orders
    Route::get('/purchase-orders', [PurchaseOrderController::class, 'index']);
    Route::post('/purchase-orders', [PurchaseOrderController::class, 'store']);
    Route::get('/purchase-orders/{id}', [PurchaseOrderController::class, 'show']);
    Route::post('/purchase-orders/{id}/receive', [PurchaseOrderController::class, 'receiveOrder']);

    // Expenses
    Route::get('/expenses', [ExpenseController::class, 'index']);
    Route::post('/expenses', [ExpenseController::class, 'store']);

    // Sales & Clients
    Route::get('/sales', [\App\Http\Controllers\Api\SalesController::class, 'index']);
    Route::post('/sales', [\App\Http\Controllers\Api\SalesController::class, 'store']);
    Route::get('/clients', [\App\Http\Controllers\Api\SalesController::class, 'getClients']);
    Route::post('/clients', [\App\Http\Controllers\Api\SalesController::class, 'storeClient']);
    Route::put('/clients/{id}', [\App\Http\Controllers\Api\SalesController::class, 'updateClient']);
    Route::delete('/clients/{id}', [\App\Http\Controllers\Api\SalesController::class, 'destroyClient']);

    // Categories Management (Unified)
    Route::get('/categories', [CategoriesController::class, 'index']);
    Route::post('/categories/material', [CategoriesController::class, 'storeMaterialCategory']);
    Route::put('/categories/material/{id}', [CategoriesController::class, 'updateMaterialCategory']);
    Route::delete('/categories/material/{id}', [CategoriesController::class, 'destroyMaterialCategory']);
    
    Route::post('/categories/product', [CategoriesController::class, 'storeProductCategory']);
    Route::put('/categories/product/{id}', [CategoriesController::class, 'updateProductCategory']);
    Route::delete('/categories/product/{id}', [CategoriesController::class, 'destroyProductCategory']);

    Route::post('/categories/unit', [CategoriesController::class, 'storeMeasurementUnit']);
    Route::put('/categories/unit/{id}', [CategoriesController::class, 'updateMeasurementUnit']);
    Route::delete('/categories/unit/{id}', [CategoriesController::class, 'destroyMeasurementUnit']);

    // Settings & User Management
    Route::get('/settings', [SettingsController::class, 'getSettings']);
    Route::post('/settings', [SettingsController::class, 'saveSettings']);
    
    Route::get('/users', [SettingsController::class, 'getUsers']);
    Route::post('/users', [SettingsController::class, 'storeUser']);
    Route::put('/users/{id}', [SettingsController::class, 'updateUser']);
    Route::delete('/users/{id}', [SettingsController::class, 'destroyUser']);

    // Notifications
    Route::get('/notifications', [NotificationsController::class, 'index']);
    Route::post('/notifications/{id}/read', [NotificationsController::class, 'markAsRead']);
    Route::post('/notifications/read-all', [NotificationsController::class, 'markAllAsRead']);
    Route::delete('/notifications/clear', [NotificationsController::class, 'clearAll']);
});
