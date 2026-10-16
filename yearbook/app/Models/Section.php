<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Section extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'course',
        'department',
        'batch_year',
        'batch_id',
        'adviser_id',
        'description',
    ];

    // Casts

    protected function casts(): array
    {
        return [
            'batch_year' => 'integer',
        ];
    }

    // Relationships 

    public function students(): HasMany
    {
        return $this->hasMany(Student::class);
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'section_id');
    }

    public function adviser(): BelongsTo
    {
        return $this->belongsTo(Faculty::class, 'adviser_id');
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(Batch::class);
    }

    public function scopeCampusYears($query)
    {
        $min = Batch::MIN_YEAR;
        $max = Batch::maxYear();

        return $query->where(function ($query) use ($min, $max) {
            $query->whereHas('batch', fn ($batch) => $batch->whereBetween('graduation_year', [$min, $max]))
                ->orWhere(function ($query) use ($min, $max) {
                    $query->whereNull('batch_id')->whereBetween('batch_year', [$min, $max]);
                });
        });
    }
}