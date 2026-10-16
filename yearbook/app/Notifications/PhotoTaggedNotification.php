<?php

namespace App\Notifications;

use App\Jobs\SendPushNotification;
use App\Models\User;
use App\Services\Notification\BrevoMailService;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Log;

class PhotoTaggedNotification extends Notification
{
    use Queueable;

    public function __construct(
        public User    $tagger,       // the person who did the tagging
        public string  $photoUrl,     // thumbnail / direct URL of the photo
        public ?string $actionUrl = null,  // deep-link into the app / web view
        public ?int    $photoId = null,
        public ?int    $photoOwnerId = null,
    ) {}

    // Channels

    public function via(object $notifiable): array
    {
        // We handle delivery ourselves via jobs, so no built-in channels needed.
        return [];
    }

    // Dispatch helpers call this instead of Notification::send()

    public static function dispatchFor(
        User    $tagged,
        User    $tagger,
        string  $photoUrl,
        ?string $actionUrl = null,
        ?int    $photoId = null,
        ?int    $photoOwnerId = null,
    ): void {
        $taggerName = $tagger->name ?? 'Someone';

        // 1. In-app + FCM push notification
        $send = app()->environment('local') ? 'dispatchSync' : 'dispatch';
        SendPushNotification::$send(
            userId: $tagged->id,
            title:  '📸 You were tagged in a photo!',
            body:   "{$taggerName} tagged you in a photo.",
            data:   [
                'type'       => 'photo_tagged',
                'tagger_id'  => (string) $tagger->id,
                'tagger_name'=> $taggerName,
                'photo_url'  => $photoUrl,
                'action_url' => $actionUrl ?? '',
                'photo_id'   => $photoId,
                'photo_owner_id' => $photoOwnerId,
                'receiver_id' => $tagged->id,
            ],
            type: 'photo_tagged',
        );

        // 2. Email notification (only if the user has an email)
        if ($tagged->email) {
            $sent = app(BrevoMailService::class)->sendTaggedNotification(
                $tagged->email,
                $tagged->name ?? $tagged->email,
                $taggerName,
                $photoUrl,
                $actionUrl,
                'View Photo',
            );

            if (! $sent) {
                Log::warning('Tagged photo email failed.', [
                    'tagged_user_id' => $tagged->id,
                    'email' => $tagged->email,
                ]);
            }
        }
    }
}
