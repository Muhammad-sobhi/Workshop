<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

/**
 * Run any artisan command against each tenant database (the same way TenantMiddleware switches
 * the connection for a tenant's web requests). The main database is not included.
 *
 *   php artisan tenants:run "system:integrity-check"
 *   php artisan tenants:run "sales:fix-delivery-line-prices --dry-run" --tenant=4
 */
class RunForTenants extends Command
{
    protected $signature = 'tenants:run
                            {cmd : The command with its options, in quotes}
                            {--tenant= : Only this tenant id}';

    protected $description = 'Run an artisan command on every tenant database';

    public function handle(): int
    {
        $defaultConnection = DB::getDefaultConnection();

        $tenantIds = User::on($defaultConnection)->whereNotNull('tenant_id')->distinct()->orderBy('tenant_id')->pluck('tenant_id');
        if ($this->option('tenant')) {
            $tenantIds = $tenantIds->filter(fn ($id) => (string) $id === (string) $this->option('tenant'))->values();
        }
        if ($tenantIds->isEmpty()) {
            $this->warn('No tenants found.');
            return self::SUCCESS;
        }

        $failed = false;
        foreach ($tenantIds as $tenantId) {
            $dbName = 'arabic_erp_tenant_' . $tenantId;
            $this->newLine();
            $this->info("══════ Tenant {$tenantId} ({$dbName}) ══════");

            config(['database.connections.tenant.database' => $dbName]);
            DB::purge('tenant');
            DB::reconnect('tenant');
            DB::setDefaultConnection('tenant');

            try {
                $exitCode = Artisan::call($this->argument('cmd'), [], $this->output);
                $failed = $failed || $exitCode !== 0;
            } catch (\Throwable $e) {
                $failed = true;
                $this->error("Failed on {$dbName}: " . $e->getMessage());
            } finally {
                DB::setDefaultConnection($defaultConnection);
                DB::purge('tenant');
            }
        }

        return $failed ? self::FAILURE : self::SUCCESS;
    }
}
