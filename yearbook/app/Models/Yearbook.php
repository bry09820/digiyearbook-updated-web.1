<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Yearbook extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'batch_id',
        'title',
        'academic_year',
        'status',               // draft | generating | published | failed
        'pdf_path',
        'pdf_generated_at',
        'cover_image',
        'description',
        'is_active',
        'download_count',
    ];

    protected function casts(): array
    {
        return [
            'pdf_generated_at' => 'datetime',
            'is_active'        => 'boolean',
        ];
    }

    // Relationships

    public function batch(): BelongsTo
    {
        return $this->belongsTo(Batch::class);
    }


    public function photos(): HasMany
    {
        return $this->hasMany(Photo::class);
    }

    // Scopes 

    public function scopePublished($query)
    {
        return $query->where('status', 'published');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    // Accessors 

    public function getIsPdfReadyAttribute(): bool
    {
        return $this->status === 'published' && ! is_null($this->pdf_path);
    }

    public function getIsGeneratingAttribute(): bool
    {
        return $this->status === 'generating';
    }
}