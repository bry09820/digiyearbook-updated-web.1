<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class AccountApprovedNotification extends Notification
{
    use Queueable;

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Your Sinag-Bughaw account has been approved')
            ->view('emails.account-approved', [
                'name' => $this->displayName($notifiable),
                'loginUrl' => rtrim((string) config('app.url'), '/').'/login',
            ]);
    }

    private function displayName(object $notifiable): string
    {
        $name = trim((string) (($notifiable->first_name ?? '').' '.($notifiable->last_name ?? '')));
        if ($name !== '') {
            return $name;
        }

        $fallback = trim((string) ($notifiable->name ?? ''));

        return $fallback !== '' ? $fallback : 'there';
    }
}
