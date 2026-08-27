<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class MigrateTenants extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'tenants:migrate';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Run migrations across all tenant databases';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Starting tenant migrations...');

        $users = User::whereNotNull('tenant_id')->get();

        if ($users->isEmpty()) {
            $this->warn('No tenants found.');
            return;
        }

        foreach ($users as $user) {
            $dbName = 'arabic_erp_tenant_' . $user->tenant_id;
            
            $this->info("Migrating tenant: {$dbName} (User ID: {$user->id})");

            // Configure tenant connection dynamically
            config(['database.connections.tenant.database' => $dbName]);
            DB::purge('tenant');
            DB::reconnect('tenant');

            try {
                // Ensure the database exists
                DB::connection('mysql')->statement("CREATE DATABASE IF NOT EXISTS `{$dbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
                
                // Run migrations
                Artisan::call('migrate', [
                    '--database' => 'tenant',
                    '--path'     => 'database/migrations',
                    '--force'    => true,
                ]);

                $this->info("Successfully migrated: {$dbName}");
                $this->line(Artisan::output());

            } catch (\Exception $e) {
                $this->error("Failed to migrate {$dbName}: " . $e->getMessage());
            }
        }

        // Restore default connection
        DB::purge('tenant');
        
        $this->info('All tenant migrations completed!');
    }
}
