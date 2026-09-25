<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CredentialChangeRevokesTokensTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(array $attrs = []): User
    {
        return User::factory()->create($attrs);
    }

    private function getMe(string $token)
    {
        $this->app['auth']->forgetGuards();
        return $this->withToken($token)->getJson('/api/auth/me');
    }

    public function test_profile_password_change_logs_out_other_devices_but_keeps_current()
    {
        $user = $this->makeUser();
        $current = $user->createToken('auth_token')->plainTextToken;
        $other = $user->createToken('auth_token')->plainTextToken;

        $this->withToken($current)->putJson('/api/auth/profile', [
            'name' => $user->name,
            'email' => $user->email,
            'password' => 'new-password-123',
            'password_confirmation' => 'new-password-123',
        ])->assertOk();

        $this->getMe($other)->assertStatus(401);
        $this->getMe($current)->assertOk();
    }

    public function test_profile_update_without_credential_change_keeps_other_devices()
    {
        $user = $this->makeUser();
        $current = $user->createToken('auth_token')->plainTextToken;
        $other = $user->createToken('auth_token')->plainTextToken;

        $this->withToken($current)->putJson('/api/auth/profile', [
            'name' => 'اسم جديد',
            'email' => $user->email,
        ])->assertOk();

        $this->getMe($other)->assertOk();
    }

    public function test_admin_changing_user_password_or_email_logs_that_user_out_everywhere()
    {
        $admin = $this->makeUser(['role' => 'admin']);
        $adminToken = $admin->createToken('auth_token')->plainTextToken;

        foreach ([['password' => 'another-pass'], ['email' => 'changed@example.com']] as $change) {
            $target = $this->makeUser(['role' => 'user']);
            $targetToken = $target->createToken('auth_token')->plainTextToken;

            $this->app['auth']->forgetGuards();
            $this->withToken($adminToken)->putJson("/api/users/{$target->id}", array_merge([
                'name' => $target->name,
                'email' => $target->email,
                'role' => 'user',
            ], $change))->assertOk();

            $this->getMe($targetToken)->assertStatus(401);
            $this->getMe($adminToken)->assertOk();
        }
    }
}
