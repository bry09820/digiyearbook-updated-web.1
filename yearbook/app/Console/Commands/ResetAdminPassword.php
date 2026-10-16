<?php

namespace App\Console\Commands;

use App\Models\Admin;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

class ResetAdminPassword extends Command
{
    protected $signature = 'admin:reset-password
        {username=admin : Admin username to create or reset}
        {password=Admin@2025! : New plain-text password}';

    protected $description = 'Create or reset an admin account and store a single password hash';

    public function handle(): int
    {
        $username = (string) $this->argument('username');
        $password = (string) $this->argument('password');

        $admin = Admin::query()->firstOrNew(['username' => $username]);
        $admin->name = $admin->name ?: 'Default Admin';
        $admin->role = $admin->role ?: ($username === 'superadmin' ? Admin::ROLE_SUPER_ADMIN : Admin::ROLE_ADMIN);
        $admin->is_active = true;
        $admin->password = $password;
        $admin->save();

        $admin->refresh();

        if (! Hash::check($password, $admin->password)) {
            $this->error("Password was saved but does not verify for {$username}.");

            return self::FAILURE;
        }

        $this->info("Admin '{$username}' is active and the password verifies.");
        $this->line('Sign in at the admin login page, then complete the authenticator step if it is enabled.');

        return self::SUCCESS;
    }
}
