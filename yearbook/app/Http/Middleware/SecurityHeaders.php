<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $response->headers->set('X-Frame-Options', 'SAMEORIGIN');
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->headers->set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

        if (! $response->headers->has('Content-Security-Policy')) {
            $response->headers->set('Content-Security-Policy', $this->contentSecurityPolicy());
        }

        // Browsers ignore HSTS delivered over plain HTTP. The preload token is
        // what SecurityHeaders.com requires to award A+; it does not submit
        // the domain to the browser preload list.
        if ($request->secure() || app()->environment('production')) {
            $response->headers->set(
                'Strict-Transport-Security',
                'max-age=31536000; includeSubDomains; preload'
            );
        }

        return $response;
    }

    /**
     * script-src must not include 'unsafe-inline' or 'unsafe-eval' on
     * production responses. SecurityHeaders.com caps that configuration at A.
     * style-src may keep 'unsafe-inline' (React style attributes) without
     * losing the A+.
     */
    private function contentSecurityPolicy(): string
    {
        $scriptSrc = ["'self'"];
        $connectSrc = ["'self'", 'https:', 'wss:'];

        // Vite's dev server needs eval. A built site must not send that token:
        // SecurityHeaders.com caps script-src 'unsafe-eval' at an A.
        $hasBuild = (glob(public_path('assets/index-*.js')) ?: []) !== [];
        $viteDev = is_file(public_path('hot'))
            || (app()->environment(['local', 'development']) && ! $hasBuild);

        if ($viteDev) {
            $scriptSrc[] = 'http://localhost:5173';
            $scriptSrc[] = 'http://127.0.0.1:5173';
            $scriptSrc[] = "'unsafe-eval'";
            array_push(
                $connectSrc,
                'http://localhost:5173',
                'http://127.0.0.1:5173',
                'ws://localhost:5173',
                'ws://127.0.0.1:5173',
            );
        }

        return implode('; ', [
            "default-src 'self'",
            'script-src '.implode(' ', $scriptSrc),
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
            "font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com",
            "img-src 'self' data: blob: https:",
            "media-src 'self' blob: https:",
            "frame-src 'self' blob: https://mozilla.github.io",
            'connect-src '.implode(' ', $connectSrc),
            "worker-src 'self' blob:",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'self'",
        ]);
    }
}
