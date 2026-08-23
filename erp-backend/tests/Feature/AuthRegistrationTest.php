<?php

namespace Tests\Feature;

use Illuminate\Database\SQLiteConnection;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthRegistrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_registration_succeeds_and_grants_owner_permissions_when_open()
    {
        config(['erp.allow_registration' => true]);
        $this->fakeMysqlWithSqliteTenant();

        $res = $this->postJson('/api/auth/register', [
            'name' => 'صاحب الورشة',
            'email' => 'owner@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $res->assertStatus(201);
        $this->assertNotEmpty($res->json('access_token'));
        $this->assertContains('manage_all', $res->json('user.permissions'));
    }

    public function test_registration_is_forbidden_when_closed()
    {
        config(['erp.allow_registration' => false]);

        $res = $this->postJson('/api/auth/register', [
            'name' => 'مستخدم محظور',
            'email' => 'closed@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $res->assertStatus(403);
        $this->assertDatabaseCount('users', 0);
    }

    public function test_registration_validation_fails_without_password_confirmation()
    {
        config(['erp.allow_registration' => true]);

        $res = $this->postJson('/api/auth/register', [
            'name' => 'مستخدم جديد',
            'email' => 'invalid@example.com',
            'password' => 'password123',
        ]);

        $res->assertStatus(422);
        $res->assertJsonValidationErrors('password');
        $this->assertDatabaseCount('users', 0);
    }

    /**
     * The register flow issues CREATE DATABASE on the mysql connection and then
     * migrates/seeds a fresh tenant DB. In tests we swap both mysql-driven
     * connections for an isolated in-memory SQLite connection so no real MySQL
     * is touched; only the raw CREATE DATABASE statement is stubbed out.
     */
    private function fakeMysqlWithSqliteTenant(): void
    {
        $pdo = new \PDO('sqlite::memory:');

        $connection = new class(function () use ($pdo) {
            return $pdo;
        }, 'tenant_test_db', '', ['name' => 'tenant']) extends SQLiteConnection {
            public function statement($query, $bindings = [])
            {
                if (str_starts_with(ltrim($query), 'CREATE DATABASE')) {
                    return true;
                }

                return parent::statement($query, $bindings);
            }
        };

        $this->app['db']->extend('mysql', fn () => $connection);
    }
}
