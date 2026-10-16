<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Batch extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'course',
        'course_code',
        'graduation_year',
        'department',
        'description',
        'is_archived',
    ];

    protected function casts(): array
    {
        return [
            'graduation_year' => 'integer',
            'is_archived'     => 'boolean',
        ];
    }

    // Relationships 
    public function sections(): HasMany
    {
        return $this->hasMany(Section::class);
    }

    public function students(): HasMany
    {
        return $this->hasMany(Student::class);
    }

    // Accessors

    public function getYearAttribute(): int
    {
        return $this->graduation_year;
    }

    /**
     * NU Lipa opened in 2022. Batch years run from that year through the current calendar year.
     */
    public const MIN_YEAR = 2022;

    public static function maxYear(): int
    {
        return (int) now()->year;
    }

    public static function yearAllowed(int $year): bool
    {
        return $year >= self::MIN_YEAR && $year <= self::maxYear();
    }

    public static function yearRules(bool $required = true): string
    {
        $presence = $required ? 'required' : 'nullable';

        return $presence.'|integer|min:'.self::MIN_YEAR.'|max:'.self::maxYear();
    }

    // Scopes
    public function scopeCampusYears($query)
    {
        return $query->whereBetween('graduation_year', [self::MIN_YEAR, self::maxYear()]);
    }

    public function scopeByYear($query, int $year)
    {
        return $query->where('graduation_year', $year);
    }

    public function scopeByCourse($query, string $course)
    {
        return $query->where('course', $course);
    }

    public function scopeByDepartment($query, string $department)
    {
        return $query->where('department', $department);
    }
}