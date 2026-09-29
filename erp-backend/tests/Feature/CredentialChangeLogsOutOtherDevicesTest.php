<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class CredentialChangeLogsOutOtherDevicesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['session.driver' => 'database']);
        // Requests from the SPA origin are stateful (session cookie auth).
        $this->withHeader('Referer', 'http://localhost');
    }

    private function makeUser(array $attrs = []): User
    {
        return User::factory()->create($attrs);
    }

    /**
     * Simulate the user being logged in on another device.
     */
    private function otherDeviceSession(User $user, string $id): void
    {
        DB::table('sessions')->insert([
            'id' => $id,
            'user_id' => $user->id,
            'payload' => '',
            'last_activity' => time(),
        ]);
    }

    public function test_login_sets_httponly_session_cookie_and_returns_no_token()
    {
        $user = $this->makeUser();

        $res = $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'password'])
            ->assertOk()
            ->assertJsonMissingPath('access_token');

        $this->assertTrue($res->getCookie(config('session.cookie'))->isHttpOnly());
        $this->getJson('/api/auth/me')->assertOk()->assertJsonPath('id', $user->id);
    }

    public function test_logout_ends_the_session()
    {
        $user = $this->makeUser();
        $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'password'])->assertOk();

        $this->postJson('/api/auth/logout')->assertOk();

        $this->app['auth']->forgetGuards();
        $this->getJson('/api/auth/me')->assertStatus(401);
    }

    public function test_profile_password_change_logs_out_other_devices_but_keeps_current()
    {
        $user = $this->makeUser();
        $this->otherDeviceSession($user, 'other-device');

        $this->actingAs($user, 'web')->putJson('/api/auth/profile', [
            'name' => $user->name,
            'email' => $user->email,
            'password' => 'new-password-123',
            'password_confirmation' => 'new-password-123',
        ])->assertOk();

        $this->assertDatabaseMissing('sessions', ['id' => 'other-device']);
        $this->getJson('/api/auth/me')->assertOk();
    }

    public function test_profile_update_without_credential_change_keeps_other_devices()
    {
        $user = $this->makeUser();
        $this->otherDeviceSession($user, 'other-device');

        $this->actingAs($user, 'web')->putJson('/api/auth/profile', [
            'name' => 'اسم جديد',
            'email' => $user->email,
        ])->assertOk();

        $this->assertDatabaseHas('sessions', ['id' => 'other-device']);
    }

    public function test_admin_changing_user_password_or_email_logs_that_user_out_everywhere()
    {
        $admin = $this->makeUser(['role' => 'admin']);
        $this->otherDeviceSession($admin, 'admin-other-device');

        foreach ([['password' => 'another-pass'], ['email' => 'changed@example.com']] as $i => $change) {
            $target = $this->makeUser(['role' => 'user']);
            $this->otherDeviceSession($target, "target-device-{$i}");

            $this->actingAs($admin, 'web')->putJson("/api/users/{$target->id}", array_merge([
                'name' => $target->name,
                'email' => $target->email,
                'role' => 'user',
            ], $change))->assertOk();

            $this->assertDatabaseMissing('sessions', ['id' => "target-device-{$i}"]);
            $this->assertDatabaseHas('sessions', ['id' => 'admin-other-device']);
        }
    }
}
