<?php

namespace Tests\Feature;

use App\Http\Middleware\TenantMiddleware;
use Illuminate\Auth\Middleware\Authenticate;
use Illuminate\Http\Request;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Tests\TestCase;

class TenantRouteBindingTest extends TestCase
{
    /**
     * Route model binding must run on the tenant database, or {transaction} is loaded from the
     * central database and a tenant user could edit or delete another company's rows.
     */
    public function test_tenant_middleware_runs_after_auth_and_before_route_model_binding(): void
    {
        $router = $this->app['router'];

        foreach (['/api/treasury/transactions/1', '/api/employees-production-logs/1'] as $uri) {
            $route = $router->getRoutes()->match(Request::create($uri, 'PUT'));
            $classes = array_map(fn ($m) => explode(':', $m)[0], $router->gatherRouteMiddleware($route));

            $auth = array_search(Authenticate::class, $classes, true);
            $tenant = array_search(TenantMiddleware::class, $classes, true);
            $bindings = array_search(SubstituteBindings::class, $classes, true);

            $this->assertNotFalse($tenant, $uri);
            $this->assertLessThan($tenant, $auth, $uri);
            $this->assertLessThan($bindings, $tenant, $uri);
        }
    }
}
