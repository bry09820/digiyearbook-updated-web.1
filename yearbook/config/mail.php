<?php

/*
| Laravel 12 speaks MAIL_SCHEME (smtp / smtps). MAIL_ENCRYPTION is the value
| set in .env for Gmail (tls) and Hostinger (ssl). Resolve it here so
| `php artisan config:cache` stores a concrete scheme and never calls env().
*/
$resolveMailScheme = static function (string $schemeKey, string $encryptionKey, string $encryptionFallback = 'tls'): ?string {
    $scheme = strtolower(trim((string) env($schemeKey, '')));
    if (in_array($scheme, ['smtp', 'smtps'], true)) {
        return $scheme;
    }

    $encryption = strtolower(trim((string) env($encryptionKey, $encryptionFallback)));

    // ssl / smtps = implicit TLS (port 465). tls / starttls = STARTTLS (port 587).
    return in_array($encryption, ['ssl', 'smtps'], true) ? 'smtps' : null;
};

$mailScheme = $resolveMailScheme('MAIL_SCHEME', 'MAIL_ENCRYPTION');
$brevoScheme = $resolveMailScheme('BREVO_SCHEME', 'BREVO_ENCRYPTION', (string) env('MAIL_ENCRYPTION', 'tls'));

return [

    /*
    |--------------------------------------------------------------------------
    | Default Mailer
    |--------------------------------------------------------------------------
    |
    | SMTP is the standard mailer (Brevo on port 587).
    |
    */

    'default' => env('MAIL_MAILER', 'smtp'),

    'mailers' => [

        /*
        | scheme null  + port 587 = STARTTLS  (MAIL_ENCRYPTION=tls)  — Gmail, Brevo
        | scheme smtps + port 465 = implicit TLS (MAIL_ENCRYPTION=ssl) — Hostinger
        */
        'smtp' => [
            'transport' => 'smtp',
            'scheme' => $mailScheme,
            'url' => env('MAIL_URL'),
            'host' => env('MAIL_HOST', env('BREVO_HOST', '127.0.0.1')),
            'port' => (int) env('MAIL_PORT', env('BREVO_PORT', 587)),
            'username' => env('MAIL_USERNAME', env('BREVO_USERNAME')),
            'password' => env('MAIL_PASSWORD', env('BREVO_PASSWORD')),
            'timeout' => (int) env('MAIL_TIMEOUT', 15),
            'local_domain' => env('MAIL_EHLO_DOMAIN', parse_url((string) env('APP_URL', 'http://localhost'), PHP_URL_HOST)),
        ],

        'brevo' => [
            'transport' => 'smtp',
            'scheme' => $brevoScheme,
            'host' => env('BREVO_HOST', 'smtp-relay.brevo.com'),
            'port' => (int) env('BREVO_PORT', 587),
            'username' => env('BREVO_USERNAME', env('MAIL_USERNAME')),
            'password' => env('BREVO_PASSWORD', env('MAIL_PASSWORD')),
            'timeout' => (int) env('MAIL_TIMEOUT', 15),
        ],

        'ses' => [
            'transport' => 'ses',
        ],

        'postmark' => [
            'transport' => 'postmark',
        ],

        'resend' => [
            'transport' => 'resend',
        ],

        'sendmail' => [
            'transport' => 'sendmail',
            'path' => env('MAIL_SENDMAIL_PATH', '/usr/sbin/sendmail -bs -i'),
        ],

        'log' => [
            'transport' => 'log',
            'channel' => env('MAIL_LOG_CHANNEL'),
        ],

        'array' => [
            'transport' => 'array',
        ],

        /*
        | Try real SMTP first; if it fails (timeout / auth), write to the log
        | so registration OTP still completes for mobile testing.
        */
        'failover' => [
            'transport' => 'failover',
            'mailers' => [
                'smtp',
                'log',
            ],
            'retry_after' => 60,
        ],

        'roundrobin' => [
            'transport' => 'roundrobin',
            'mailers' => [
                'ses',
                'postmark',
            ],
            'retry_after' => 60,
        ],

    ],

    'from' => [
        'address' => env('MAIL_FROM_ADDRESS', env('BREVO_FROM_ADDRESS', 'noreply@sinag-bughaw.local')),
        'name' => env('MAIL_FROM_NAME', env('BREVO_FROM_NAME', env('APP_NAME', 'Sinag-Bughaw'))),
    ],

];
