<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Subscription extends Model
{
    protected $fillable = [
        'user_id',
        'plan',
        'tier',
        'status',
        'paymongo_payment_intent_id',
        'amount_paid',
        'expires_at',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
    ];

    // RELATIONSHIPS

    public function user()
    {
        return $this->belongsTo(User::class);
    }


    public function isActive(): bool
    {
        return $this->status === 'active'
            && ($this->expires_at === null || $this->expires_at->isFuture());
    }

    public function scopeWithActiveStatus($query)
    {
        return $query->where('status', 'active');
    }

    public function scopePremiumTier($query)
    {
        return $query->where(function ($premium) {
            $premium->where('tier', 'premium')
                ->orWhere('plan', 'like', 'premium%');
        });
    }

    public function scopeStandardTier($query)
    {
        return $query->where(function ($tier) {
            $tier->whereNull('tier')->orWhere('tier', '!=', 'premium');
        })->where(function ($plan) {
            $plan->whereNull('plan')->orWhere('plan', 'not like', 'premium%');
        });
    }

    public function isPremium(): bool
    {
        return $this->isActive() && $this->tier === 'premium';
    }

    public function isStandard(): bool
    {
        return $this->isActive() && in_array($this->tier, ['standard', 'premium']);
    }

    //Cloudinary storage tier resolution

    /**
     * plan=free, tier=standard 'free'
     * plan=premium, tier=standard 'premium_standard'
     * plan=premium, tier=premium 'premium'
     *
     * @return string 'free' | 'premium_standard' | 'premium'
     */
    public function getStorageTierKeyAttribute(): string
    {
        if (! $this->isActive()) {
            return 'free';
        }

        return match (true) {
            $this->tier === 'premium'  => 'premium',
            $this->tier === 'standard' => 'premium_standard',
            default                    => 'free',
        };
    }

    public function getStorageTierLabelAttribute(): string
    {
        return match ($this->storage_tier_key) {
            'premium'          => 'Premium HD',
            'premium_standard' => 'Premium Standard',
            default            => 'Free',
        };
    }

    public function getStorageLimitBytesAttribute(): int
    {
        return (int) config(
            "cloudinary.tiers.{$this->storage_tier_key}.storage_limit_bytes",
            500 * 1024 * 1024  // fallback: 500 MB
        );
    }

    public function getHdEnabledAttribute(): bool
    {
        return (bool) config(
            "cloudinary.tiers.{$this->storage_tier_key}.hd_enabled",
            false
        );
    }

    public function getBulkUploadLimitAttribute(): int
    {
        return (int) config(
            "cloudinary.tiers.{$this->storage_tier_key}.bulk_upload_limit",
            5
        );
    }
}
