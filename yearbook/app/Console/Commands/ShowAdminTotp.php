<?php

namespace App\Console\Commands;

use App\Models\Admin;
use App\Services\Security\TotpService;
use Illuminate\Console\Command;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

class ShowAdminTotp extends Command
{
    protected $signature = 'admin:totp
        {username=admin : Admin username}
        {--reset : Replace the authenticator secret with a new one}';

    protected $description = 'Show or regenerate the Google Authenticator secret and QR link for an admin';

    public function handle(TotpService $totp): int
    {
        $username = (string) $this->argument('username');
        $admin = Admin::query()->where('username', $username)->first();

        if (! $admin) {
            $this->error("Admin '{$username}' was not found.");

            return self::FAILURE;
        }

        $replaced = false;
        $secret = $this->option('reset') ? null : $this->decryptSecret($admin);

        if ($secret === null) {
            if (! $this->option('reset') && $this->hasStoredSecret($admin)) {
                $this->warn('The stored secret cannot be decrypted with the current APP_KEY. A new secret will be saved.');
            }

            $secret = $totp->generateSecret();
            DB::table('admins')->where('id', $admin->id)->update([
                'totp_secret' => Crypt::encryptString($secret),
                'totp_pending_secret' => null,
                'totp_enabled_at' => now(),
                'updated_at' => now(),
            ]);
            $replaced = true;
        }

        $issuer = (string) config('app.name', 'Sinag-Bughaw');
        $uri = $totp->provisioningUri($issuer, $admin->username, $secret);
        $qr = 'https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=' . rawurlencode($uri);

        if ($replaced) {
            $this->info("New authenticator secret saved for '{$admin->username}'. Older authenticator codes no longer work.");
        } else {
            $this->info("Current authenticator secret for '{$admin->username}'.");
        }

        $this->newLine();
        $this->line('Account: '.$admin->username);
        $this->line('Issuer:  '.$issuer);
        $this->line('Secret:  '.$secret);
        $this->line('URI:     '.$uri);
        $this->line('QR:      '.$qr);
        $this->newLine();
        $this->line('Scan the QR link, or enter the secret manually in Google Authenticator.');

        return self::SUCCESS;
    }

    private function decryptSecret(Admin $admin): ?string
    {
        $raw = $admin->getRawOriginal('totp_secret');

        if ($raw === null || $raw === '') {
            return null;
        }

        try {
            $value = $admin->totp_secret;
        } catch (DecryptException) {
            return null;
        }

        return is_string($value) && $value !== '' ? $value : null;
    }

    private function hasStoredSecret(Admin $admin): bool
    {
        $raw = $admin->getRawOriginal('totp_secret');

        return $raw !== null && $raw !== '';
    }
}
