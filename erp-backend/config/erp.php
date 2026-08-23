<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Open Registration
    |--------------------------------------------------------------------------
    |
    | When disabled, POST /api/auth/register returns 403 and no new tenant
    | databases can be self-provisioned. Set ERP_ALLOW_REGISTRATION=false
    | in production once initial accounts exist.
    |
    */

    'allow_registration' => env('ERP_ALLOW_REGISTRATION', true),

    /*
    |--------------------------------------------------------------------------
    | Registration Rate Limit
    |--------------------------------------------------------------------------
    */

    'registration_rate_limit' => env('ERP_REGISTRATION_RATE_LIMIT', '5,1'),

    /*
    |--------------------------------------------------------------------------
    | Tenant Owner Permissions
    |--------------------------------------------------------------------------
    |
    | Permissions granted to the user who registers a new tenant. This user
    | owns the tenant database, so they receive full management rights.
    |
    */

    'owner_permissions' => [
        'manage_all',
        'manage_inventory',
        'manage_accounts',
        'manage_settings',
        'manage_production',
        'manage_sales',
        'manage_categories',
        'manage_employees',
    ],

    /*
    |--------------------------------------------------------------------------
    | Permission Catalog
    |--------------------------------------------------------------------------
    |
    | Canonical list of permissions that may be assigned to additional
    | tenant users via Settings -> Users.
    |
    */

    'permissions' => [
        'manage_all'        => 'إدارة كاملة للمشروع والنظام',
        'manage_inventory'  => 'إدارة المخزون والمستودعات والمواد الخام',
        'manage_production' => 'إدارة عمليات الإنتاج وأوامر التشغيل',
        'manage_sales'      => 'إدارة المبيعات وفواتير العملاء',
        'manage_accounts'   => 'إدارة الحسابات والخزينة والمصروفات',
        'manage_settings'   => 'إدارة إعدادات النظام والنسخ الاحتياطي',
        'manage_categories' => 'إدارة الفئات والوحدات',
        'manage_employees'  => 'إدارة الموظفين والمرتبات والحضور',
    ],
];
