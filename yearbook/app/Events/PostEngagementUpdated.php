<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class PostEngagementUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * @param  array<string, mixed>  $engagement
     * @param  array<string, mixed>|null  $comment
     */
    public function __construct(
        public int $photoId,
        public array $engagement,
        public ?array $comment = null,
        public ?int $removedCommentId = null,
    ) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('post.'.$this->photoId)];
    }

    public function broadcastAs(): string
    {
        return 'engagement.updated';
    }

    public function broadcastWith(): array
    {
        $reactions = $this->engagement['reactions'] ?? [];
        if (is_array($reactions)) {
            $reactions['mine'] = null;
        }

        return [
            'photo_id' => $this->photoId,
            'reactions' => $reactions,
            'comments_count' => (int) ($this->engagement['comments_count'] ?? 0),
            'comment' => $this->comment,
            'removed_comment_id' => $this->removedCommentId,
        ];
    }
}
