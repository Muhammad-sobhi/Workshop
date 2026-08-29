<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Illuminate\Support\Facades\Log;

class CheckPermission
{
    public function handle(Request $request, Closure $next, string ...$permissions): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(["message" => "Unauthorized."], 401);
        }

        $rawRole = $user->role ?? "";
        $role = strtolower(trim($rawRole));

        if ($role === "admin" || $role === "superadmin") {
            return $next($request);
        }

        $granted = $user->permissions;
        
        if (is_string($granted)) {
            $decoded = json_decode($granted, true);
            $granted = is_array($decoded) ? $decoded : [];
        } elseif (!is_array($granted)) {
            $granted = (array) $granted;
        }

        $granted = array_map(function($perm) {
            return strtolower(trim((string)$perm));
        }, $granted);

        if (in_array("manage_all", $granted, true)) {
            return $next($request);
        }

        foreach ($permissions as $permission) {
            $cleanPermission = strtolower(trim($permission));
            if (in_array($cleanPermission, $granted, true)) {
                return $next($request);
            }
        }

        Log::warning("Permission Denied", [
            "user_id" => $user->id,
            "parsed_role" => $role,
            "granted_permissions" => $granted,
            "required_permissions" => $permissions
        ]);

        return response()->json([
            "message" => "ليس لديك الصلاحية للقيام بهذا الإجراء.",
            "required_permissions" => $permissions,
        ], 403);
    }
}