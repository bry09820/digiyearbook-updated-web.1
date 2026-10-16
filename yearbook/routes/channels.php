<?php
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('chat.{receiverId}', function ($user, $receiverId) {
    return (int) $user->id === (int) $receiverId;
});

Broadcast::channel('post.{photoId}', function ($user, $photoId) {
    $photo = \App\Models\Photo::query()->find($photoId);

    return $photo && $user && $photo->visibleTo($user);
});

Broadcast::channel('online-users', function ($user) {
    return [
        'id'              => $user->id,
        'name'            => $user->name,
        'profile_picture' => $user->profile_picture,
    ];
});