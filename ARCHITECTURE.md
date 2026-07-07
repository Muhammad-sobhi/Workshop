# ERP System Architecture

```mermaid
---
title: ERP System - Full Architecture Graph
---
graph TB
    subgraph Frontend["erp-frontend-with-next-js (Next.js 16)"]
        direction TB
        F_Root["/ (redirects to /dashboard)"]
        F_Pages["App Router Pages"]
        F_Layout["Root Layout (RTL, i18n, Theme)"]
        F_Components["UI Components"]
        F_State["Zustand Store"]
        F_API["API Client (Axios)"]
        F_i18n["i18next (en/ar)"]

        subgraph Pages["Pages"]
            Login["/login"]
            Dashboard["/dashboard"]
            Inventory["/inventory"]
            Movements["/inventory/movements"]
            Ledger["/inventory/ledger/:type/:id"]
            Warehouses["/warehouses"]
            Materials["/materials"]
            Products["/products"]
            Categories["/categories"]
            Suppliers["/suppliers"]
            Procurement["/procurement"]
            Production["/production"]
            Sales["/sales"]
            Expenses["/expenses"]
            Accounts["/accounts"]
            Profile["/profile"]
            Settings["/settings"]
        end

        subgraph Components["Components"]
            MainLayout["MainLayout (Sidebar + Header)"]
            Sidebar["Sidebar (Nav + Permissions)"]
            Header["Header (Search + Notifications)"]
            DataTable["DataTable (Sort/Search)"]
            KPICard["KPICard"]
            Badge["Badge"]
            Button["Button (shadcn/ui)"]
        end

        F_Layout --> F_Pages
        F_Pages --> Pages
        F_Layout --> MainLayout
        MainLayout --> Sidebar
        MainLayout --> Header
        Pages --> DataTable
        Pages --> KPICard
        Pages --> Badge
        Pages --> Button
        Pages --> F_API
        F_API --> F_State
    end

    subgraph Backend["erp-backend (Laravel 12 - PHP 8.2+)"]
        direction TB
        B_Routes["routes/api.php (All API routes)"]
        B_Controllers["API Controllers"]
        B_Models["Eloquent Models (17)"]
        B_Migrations["Database Migrations (24)"]
        B_Middleware["auth:sanctum Middleware"]
        B_DB["SQLite / MySQL / PostgreSQL"]

        subgraph Controllers["Controllers"]
            Auth["AuthController"]
            DashboardCtrl["DashboardController"]
            WarehouseCtrl["WarehouseController"]
            InventoryCtrl["InventoryController"]
            MaterialCtrl["MaterialController"]
            ProductCtrl["ProductController"]
            SupplierCtrl["SupplierController"]
            OperationCtrl["OperationController"]
            PurchaseOrderCtrl["PurchaseOrderController"]
            ExpenseCtrl["ExpenseController"]
            SalesCtrl["SalesController"]
            CategoriesCtrl["CategoriesController"]
            SettingsCtrl["SettingsController"]
            NotificationsCtrl["NotificationsController"]
        end

        subgraph Models["Models"]
            User["User"]
            Client["Client"]
            Supplier["Supplier"]
            Material["Material"]
            MaterialCategory["MaterialCategory"]
            Product["Product"]
            ProductCategory["ProductCategory"]
            ProductMaterial["ProductMaterial (BOM pivot)"]
            Warehouse["Warehouse"]
            InventoryMovement["InventoryMovement"]
            Operation["Operation"]
            OperationProduct["OperationProduct"]
            OperationPayment["OperationPayment"]
            PurchaseOrder["PurchaseOrder"]
            PurchaseOrderItem["PurchaseOrderItem"]
            Expense["Expense"]
            Revenue["Revenue"]
        end

        B_Routes --> Controllers
        Controllers --> Models
        Models --> B_DB
        B_Routes --> B_Middleware
    end

    subgraph AuthFlow["Authentication Flow"]
        LoginForm["Login Form"] -->|POST /auth/login| Auth
        Auth -->|access_token + user| F_State
        F_State -->|Bearer token| F_API
        F_API -->|api/* requests| B_Routes
        B_Middleware -->|401 on expire| F_State
    end

    subgraph EntityRelationships["Entity Relationships"]
        direction LR
        Supplier -->|supplies| Material
        Material -->|categorized as| MaterialCategory
        Material -->|stored in| Warehouse
        ProductMaterial -->|links| Product
        ProductMaterial -->|to| Material
        Product -->|categorized as| ProductCategory
        Operation -->|consumes| Material
        Operation -->|produces| Product
        PurchaseOrder -->|contains| PurchaseOrderItem
        PurchaseOrderItem -->|references| Material
        InventoryMovement -->|tracks| Material
        InventoryMovement -->|tracks| Product
        InventoryMovement -->|at| Warehouse
    end

    Frontend -->|"HTTP (localhost:8000/api)"| Backend
```

```mermaid
---
title: Data Flow Diagram
---
flowchart LR
    User(["User Browser"]) --> NextJS["Next.js 16 SSR/CSR"]
    NextJS --> Axios["Axios Client <br/> lib/api-client.ts"]
    Axios -->|Bearer Token| Laravel["Laravel 12 API <br/> Sanctum Auth"]
    Laravel --> Eloquent["Eloquent ORM"]
    Eloquent --> SQLite[("SQLite Database")]
    
    Zustand["Zustand Store <br/> lib/store.ts"] -->|global state| NextJS
    i18n["i18next <br/> en / ar"] -->|translations| NextJS
    Recharts["Recharts"] -->|charts| NextJS
```

```mermaid
---
title: Module Dependency Graph
---
flowchart TD
    subgraph Modules["ERP Modules & Dependencies"]
        Auth["Auth & Users"] --> Dashboard["Dashboard"]
        Dashboard --> Inventory["Inventory Management"]
        Dashboard --> Procurement["Procurement"]
        Dashboard --> Production["Production"]
        Dashboard --> Sales["Sales & CRM"]
        Dashboard --> Financials["Financials"]
        
        Inventory --> Materials["Materials & Categories"]
        Inventory --> Warehouses["Warehouses"]
        Inventory --> Movements["Stock Movements"]
        Inventory --> Ledger["Inventory Ledger"]
        
        Materials --> Products["Products & BOM"]
        
        Procurement --> Suppliers["Suppliers"]
        Procurement --> PurchaseOrders["Purchase Orders"]
        Suppliers --> Materials
        
        Production --> Operations["Operations"]
        Operations --> Materials
        Operations --> Products
        
        Sales --> Clients["Clients"]
        Sales --> Revenues["Revenues"]
        
        Financials --> Expenses["Expenses"]
        Financials --> Revenues
        Financials --> Payments["Payments"]
    end
```

```mermaid
---
title: Technology Stack
---
pie title Technology Stack
    "Laravel 12 (PHP 8.2+)" : 35
    "Next.js 16 (React 19)" : 30
    "Tailwind CSS v4" : 10
    "SQLite/MySQL" : 8
    "Zustand" : 5
    "i18next" : 4
    "Recharts" : 3
    "shadcn/ui" : 3
    "Axios" : 2
```

```mermaid
---
title: Route Map - Frontend Pages
---
mindmap
  root((ERP System))
    ::id1
    Auth
      /login
    Dashboard
      /dashboard
    Inventory
      /inventory
      /inventory/movements
      /inventory/ledger/[type]/[id]
    Master Data
      /warehouses
      /materials
      /products
      /categories
      /suppliers
    Operations
      /procurement
      /production
    Sales & CRM
      /sales
      /accounts
    Finance
      /expenses
    System
      /profile
      /settings
```

```mermaid
---
title: Database Entity Relationship (Simplified)
---
erDiagram
    User ||--o{ Operation : manages
    User ||--o{ PurchaseOrder : creates
    
    Supplier ||--o{ PurchaseOrder : supplies
    Supplier ||--o{ Material : supplies
    
    MaterialCategory ||--o{ Material : categorizes
    Material ||--o{ ProductMaterial : "is part of BOM"
    Material ||--o{ PurchaseOrderItem : ordered_in
    Material ||--o{ InventoryMovement : tracked_by
    
    ProductCategory ||--o{ Product : categorizes
    Product ||--o{ ProductMaterial : "has BOM"
    Product ||--o{ OperationProduct : produced_in
    Product ||--o{ InventoryMovement : tracked_by
    
    Warehouse ||--o{ InventoryMovement : location_for
    Warehouse ||--o{ Material : stored_in
    
    PurchaseOrder ||--o{ PurchaseOrderItem : contains
    PurchaseOrder ||--|| Operation : may_become
    
    Operation ||--o{ OperationProduct : produces
    Operation ||--o{ OperationPayment : has_payments
    
    Client ||--o{ Revenue : pays
    User ||--o{ Revenue : records
```

> Generated by `/graphify` — full architecture overview of the ERP system
