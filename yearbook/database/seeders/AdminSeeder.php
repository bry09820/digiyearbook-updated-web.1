<?php

namespace Database\Seeders;

use App\Models\Admin;
use Illuminate\Database\Seeder;

class AdminSeeder extends Seeder
{
    public function run(): void
    {
        $production = app()->environment('production');
        $superPassword = env('SEED_SUPERADMIN_PASSWORD');
        $adminPassword = env('SEED_ADMIN_PASSWORD');

        if ($production && (! is_string($superPassword) || $superPassword === '' || ! is_string($adminPassword) || $adminPassword === '')) {
            $this->command?->error('Set SEED_SUPERADMIN_PASSWORD and SEED_ADMIN_PASSWORD before seeding admin accounts in production.');

            return;
        }

        $superPassword = (string) ($superPassword !== null && $superPassword !== '' ? $superPassword : 'SuperAdmin@2025!');
        $adminPassword = (string) ($adminPassword !== null && $adminPassword !== '' ? $adminPassword : 'Admin@123!');

        $super = Admin::updateOrCreate(
            ['username' => 'superadmin'],
            [
                'name'      => 'Super Administrator',
                'password'  => $superPassword,
                'role'      => Admin::ROLE_SUPER_ADMIN,
                'is_active' => true,
            ]
        );

        Admin::updateOrCreate(
            ['username' => 'admin'],
            [
                'name'       => 'Default Admin',
                'password'   => $adminPassword,
                'role'       => Admin::ROLE_ADMIN,
                'is_active'  => true,
                'created_by' => $super->id,
            ]
        );

        $this->command?->info('Admin accounts seeded for superadmin and admin. Change those passwords after the first login.');
    }
}
