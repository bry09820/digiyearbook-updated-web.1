<?php

namespace App\Http\Middleware;

use App\Support\PlatformSettings;
use Closure;
use Illuminate\Http\Request;

class EnsureFeatureEnabled
{
    /** @var array<string, string> */
    private const LABELS = [
        'allow_student_posts'             => 'Student posts',
        'allow_comments'                  => 'Commenting',
        'allow_reactions'                 => 'Reactions',
        'enable_flipbook_viewer'          => 'Flipbook viewer',
        'enable_yearbook_pdf_download'    => 'Yearbook PDF download',
        'enable_student_directory_search' => 'Student directory search',
        'publish_yearbook'                => 'Published yearbook',
        'enable_premium_subscription'     => 'Premium subscriptions',
    ];

    public function handle(Request $request, Closure $next, string ...$features)
    {
        foreach ($features as $feature) {
            if (PlatformSettings::bool($feature)) {
                continue;
            }

            $label = self::LABELS[$feature] ?? ucfirst(str_replace('_', ' ', $feature));

            return PlatformSettings::featureDisabled($feature, $label);
        }

        return $next($request);
    }
}
