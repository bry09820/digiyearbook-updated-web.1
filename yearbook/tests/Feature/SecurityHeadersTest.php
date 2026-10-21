<?php

namespace Tests\Feature;

use Tests\TestCase;

class SecurityHeadersTest extends TestCase
{
    public function test_homepage_sends_the_headers_required_for_an_a_plus_scan(): void
    {
        $response = $this->get('https://localhost/');

        $response->assertOk();
        $response->assertHeader('X-Frame-Options', 'SAMEORIGIN');
        $response->assertHeader('X-Content-Type-Options', 'nosniff');
        $response->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->assertHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
        $response->assertHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

        $csp = (string) $response->headers->get('Content-Security-Policy');
        $this->assertMatchesRegularExpression('/(?:^|; )script-src [^;]*\'self\'/', $csp);
        $this->assertMatchesRegularExpression('/(?:^|; )frame-ancestors \'self\'/', $csp);

        preg_match('/(?:^|; )script-src ([^;]+)/', $csp, $scriptSrc);
        $this->assertStringNotContainsString('unsafe-inline', $scriptSrc[1] ?? '');
        $this->assertStringNotContainsString('unsafe-eval', $scriptSrc[1] ?? '');
    }

    public function test_plain_http_responses_omit_hsts(): void
    {
        $response = $this->get('http://localhost/');

        $response->assertOk();
        $response->assertHeader('X-Content-Type-Options', 'nosniff');
        $response->assertHeaderMissing('Strict-Transport-Security');
    }
}
