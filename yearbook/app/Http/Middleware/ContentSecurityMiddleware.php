<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ContentSecurityMiddleware
{
    private const COMMON_HEADERS = [
        'X-Frame-Options'        => 'SAMEORIGIN',
        'X-Content-Type-Options' => 'nosniff',
        'Referrer-Policy'        => 'strict-origin-when-cross-origin',
        'Permissions-Policy'     => 'geolocation=(), microphone=(), camera=()',
        'X-Content-Owner'        => 'National University Lipa',
        'X-Content-License'      => 'All rights reserved. Unauthorized reproduction prohibited.',
    ];

    private const MEDIA_HEADERS = [
        'Cache-Control'                  => 'private, no-store, no-cache, must-revalidate',
        'Pragma'                         => 'no-cache',
        'Cross-Origin-Resource-Policy'   => 'same-origin',
        'Cross-Origin-Embedder-Policy'   => 'require-corp',
    ];

    private const MEDIA_ROUTE_PREFIXES = [
        'api/media',
        'api/gallery',
        'api/graduation',
        'api/yearbooks',
        'api/yearbook',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        foreach (self::COMMON_HEADERS as $header => $value) {
            $response->headers->set($header, $value);
        }

        if ($this->isMediaRoute($request)) {
            foreach (self::MEDIA_HEADERS as $header => $value) {
                $response->headers->set($header, $value);
            }

            if ($request->boolean('force_download')) {
                $filename = basename($request->path()) ?: 'download';
                $response->headers->set(
                    'Content-Disposition',
                    "attachment; filename=\"{$filename}\""
                );
            }
        }

        return $response;
    }

    private function isMediaRoute(Request $request): bool
    {
        $path = ltrim($request->path(), '/');
        foreach (self::MEDIA_ROUTE_PREFIXES as $prefix) {
            if (str_starts_with($path, $prefix)) {
                return true;
            }
        }
        return false;
    }
}