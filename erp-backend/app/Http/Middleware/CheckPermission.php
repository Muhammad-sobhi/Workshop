<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckPermission
{
    /**
     * Ensure the authenticated user holds one of the required permissions.
     *
     * Usage: ->middleware('permission:manage_sales') or 'permission:manage_sales,manage_accounts'
     * A user with 'manage_all' passes every check; users with the 'admin'
     * role also pass (tenant owners).
     */
    public function handle(Request $request, Closure $next, string ...$permissions): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['message' => 'غير مصرح.'], 401);
        }

        $role = strtolower(trim($user->role ?? ''));

        if ($role === 'admin' || $role === 'superadmin') {
            return $next($request);
        }

        $granted = $user->permissions;
        if (is_string($granted)) {
            $granted = json_decode($granted, true) ?? [];
        } elseif (!is_array($granted)) {
            $granted = [];
        }

        if (in_array('manage_all', $granted, true)) {
            return $next($request);
        }

        foreach ($permissions as $permission) {
            if (in_array($permission, $granted, true)) {
                return $next($request);
            }
        }

        return response()->json([
            'message' => 'ليس لديك الصلاحية للقيام بهذا الإجراء.',
            'required_permissions' => $permissions,
        ], 403);
    }
}
