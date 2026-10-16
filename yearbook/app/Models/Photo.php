<?php

namespace App\Models;

use App\Contracts\AnalyzablePhoto;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Photo extends Model implements AnalyzablePhoto
{
    use SoftDeletes;

    protected $fillable = [
        'album_id', 'user_id', 'file_path', 'public_id',
        'caption', 'ai_metadata', 'visibility', 'is_profile_post',
        'status', 'rejection_reason',
        'approved_at', 'approved_by',
        'rejected_at', 'rejected_by',
        'views_count',
    ];

    protected $casts = [
        'ai_metadata'     => 'array',
        'is_profile_post' => 'boolean',
        'views_count'     => 'integer',
    ];

    // Relationships

    public function album(): BelongsTo
    {
        return $this->belongsTo(Album::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function taggedPhotos(): HasMany
    {
        return $this->hasMany(TaggedPhoto::class);
    }

    public function media(): HasMany
    {
        return $this->hasMany(PostMedia::class)->orderBy('sort_order');
    }

    public function postViews(): HasMany
    {
        return $this->hasMany(ContentView::class, 'content_id')
            ->where('content_type', 'post')
            ->whereNotNull('viewer_user_id');
    }

    public function reactions(): HasMany
    {
        return $this->hasMany(PostReaction::class);
    }

    public function comments(): HasMany
    {
        return $this->hasMany(PostComment::class);
    }

    public function taggedStudents(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'tagged_photos', 'photo_id', 'user_id')
                    ->wherePivot('status', 'approved')
                    ->withPivot(['similarity', 'confidence', 'source', 'tagged_by', 'status'])
                    ->withTimestamps();
    }

    public function taggedUsers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'photo_tags', 'photo_id', 'user_id')
            ->withPivot('tagged_by')
            ->withTimestamps();
    }

    public function visibleTo(?User $viewer): bool
    {
        if ($viewer && (int) $viewer->id === (int) $this->user_id) {
            return true;
        }

        $owner = $this->relationLoaded('user') ? $this->user : $this->user()->first();
        if ($owner && ! $owner->canBeViewedBy($viewer)) {
            return false;
        }

        $visibility = $this->visibility === 'batchmates' ? 'friends' : $this->visibility;

        if ($visibility === 'public' || $visibility === null || $visibility === '') {
            return true;
        }

        if (! $viewer || $visibility === 'private' || $visibility !== 'friends') {
            return false;
        }

        if (! $owner) {
            return false;
        }

        return $owner->sharesBatchYearWith($viewer);
    }

    // AI Helpers

    public function markAiQueued(): bool
    {
        $meta           = $this->ai_metadata ?? [];
        $meta['status'] = 'queued';

        return $this->update(['ai_metadata' => $meta]);
    }

    public function markAiDone(array $results = []): bool
    {
        $meta           = $this->ai_metadata ?? [];
        $meta['status'] = 'done';
        $meta           = array_merge($meta, $results);

        return $this->update(['ai_metadata' => $meta]);
    }

    public function markAiError(string $message): bool
    {
        $meta                = $this->ai_metadata ?? [];
        $meta['status']      = 'error';
        $meta['error']       = $message;
        $meta['analyzed_at'] = now()->toIso8601String();

        return $this->update(['ai_metadata' => $meta]);
    }

    // Scopes

    public function scopeProfilePosts($query)
    {
        return $query->where('is_profile_post', true);
    }

    public function scopePublicVisible($query)
    {
        return $query->where('visibility', 'public');
    }
}