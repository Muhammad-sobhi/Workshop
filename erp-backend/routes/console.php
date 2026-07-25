<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('db:clear-data', function () {
    $this->info('Starting database cleanup...');

    $excludedTables = [
        'migrations',
        'users',
        'personal_access_tokens',
        'sessions',
        'password_reset_tokens',
    ];

    $driver = Illuminate\Support\Facades\DB::connection()->getDriverName();
    if ($driver === 'sqlite') {
        Illuminate\Support\Facades\DB::statement('PRAGMA foreign_keys = OFF;');
    } else {
        Illuminate\Support\Facades\Schema::disableForeignKeyConstraints();
    }

    $tables = Illuminate\Support\Facades\Schema::getTables();
    $tableNames = [];
    foreach ($tables as $table) {
        if (is_array($table)) {
            $tableNames[] = $table['name'] ?? $table['table_name'] ?? null;
        } elseif (is_object($table)) {
            $tableNames[] = $table->name ?? $table->table_name ?? null;
        }
    }
    $tableNames = array_filter($tableNames);

    foreach ($tableNames as $tableName) {
        if (in_array($tableName, $excludedTables)) {
            $this->comment("Skipping table: {$tableName} (Excluded)");
            continue;
        }

        $this->info("Clearing table: {$tableName}");
        try {
            Illuminate\Support\Facades\DB::table($tableName)->truncate();
            
            if ($driver === 'sqlite') {
                Illuminate\Support\Facades\DB::statement("DELETE FROM sqlite_sequence WHERE name = ?;", [$tableName]);
            }
        } catch (\Exception $e) {
            $this->warn("Failed to clear table {$tableName}: " . $e->getMessage());
        }
    }

    if ($driver === 'sqlite') {
        Illuminate\Support\Facades\DB::statement('PRAGMA foreign_keys = ON;');
    } else {
        Illuminate\Support\Facades\Schema::enableForeignKeyConstraints();
    }

    $this->info('Database cleanup completed successfully!');
})->purpose('Clear all database tables except login/auth data');

