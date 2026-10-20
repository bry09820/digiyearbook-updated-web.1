<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class AccountDisapprovedNotification extends Notification
{
    use Queueable;

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Update on your Sinag-Bughaw registration')
            ->view('emails.account-disapproved', [
                'name' => $this->displayName($notifiable),
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
