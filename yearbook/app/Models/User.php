<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Laravel\Scout\Searchable;
use App\Models\Achievement;

class User extends Authenticatable
{
    use HasFactory, Notifiable, HasApiTokens, Searchable, SoftDeletes;

    public const ROLE_STUDENT = 'student';
    public const ROLE_ALUMNI = 'alumni';
    public const ROLE_FACULTY = 'faculty';
    public const ROLE_ADMIN = 'admin';

    public const STATUS_PENDING = 'pending';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_DISAPPROVED = 'disapproved';


    public const DEPARTMENT_COURSES = [
        'SACE' => [
            'Bachelor of Science in Architecture',
            'Bachelor of Science in Civil Engineering',
            'Bachelor of Science in Computer Science',
            'Bachelor of Science in Information Technology',
            'Bachelor of Multimedia Arts',
        ],
        'SAHS' => [
            'Bachelor of Science in Nursing',
            'Bachelor of Science in Medical Technology',
            'Bachelor of Science in Psychology',
        ],
        'SABM' => [
            'Bachelor of Science in Accountancy',
            'Bachelor of Science in Business Administration - Financial Management',
            'Bachelor of Science in Business Administration - Marketing Management',
            'Bachelor of Science in Tourism Management',
        ],
        'SGS' => [
            'Master in Management',
        ],
        'SHS' => [
            'ABM',
            'STEM',
            'HUMSS',
        ],
    ];

    public const COURSE_SHORT = [
        'Bachelor of Science in Architecture'                                    => 'BSArch',
        'Bachelor of Science in Civil Engineering'                               => 'BSCE',
        'Bachelor of Science in Computer Science'                                => 'BSCS',
        'Bachelor of Science in Information Technology'                          => 'BSIT',
        'Bachelor of Multimedia Arts'                                            => 'BMA',
        'Bachelor of Science in Nursing'                                         => 'BSN',
        'Bachelor of Science in Medical Technology'                              => 'BSMT',
        'Bachelor of Science in Psychology'                                      => 'BSPsy',
        'Bachelor of Science in Accountancy'                                     => 'BSA',
        'Bachelor of Science in Business Administration - Financial Management'  => 'BSBA-FM',
        'Bachelor of Science in Business Administration - Marketing Management'  => 'BSBA-MM',
        'Bachelor of Science in Tourism Management'                              => 'BSTM',
        'Master in Management'                                                   => 'MM',
        'ABM'                                                                    => 'ABM',
        'STEM'                                                                   => 'STEM',
        'HUMSS'                                                                  => 'HUMSS',
    ];

    public static function getDepartment(string $course): ?string
    {
        foreach (self::DEPARTMENT_COURSES as $dept => $courses) {
            if (in_array($course, $courses, true)) {
                return $dept;
            }
        }
        return null;
    }

    // illable 
    // Only auth + account fields. All yearbook data lives in students table.

    protected $fillable = [
        // Identity 
        'first_name',
        'last_name',
        'name',

        //  Auth 
        'email',
        'password',
        'role',
        'is_alumni',
        'terms_accepted_at',

        // Link to yearbook record
        'student_record_id',

        // Section / Batch 
        'section_id',
        'batch_id',

        // Profile (user-owned, not yearbook data) 
        'avatar',
        'bio',
        'profile_visibility',
        'profile_views',
        'profile_picture',
        'profile_picture_public_id',
        'student_id',
        'course',
        'graduation_year',
        'batch',
        'motto',
        //  Consent / Verification 
        'email_verified',
        'status',
        'consent_accepted',
        //  SSO 
        'google_id',
        'google_token',
        'fcm_token',
    ];

    protected $hidden = ['password', 'remember_token', 'google_token'];

    protected $appends = [
        'student_id',
        'course',
        'graduation_year',
        'batch',
        'nickname',
        'birthday',
        'hometown',
        'honors',
        'organizations',
        'motto',
        'ambition',
        'future_plans',
        'fondest_memory',
        'most_likely_to',
        'message_to_batchmates',
        'message_to_parents',
        'facebook_url',
        'instagram_url',
        'linkedin_url',
        'github_url',
        'profile_picture',
        'department',
        'is_premium',
        'is_subscribed',
        'tier',
        'posts_count',
        'tagged_count',
        'academic_status',
    ];
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password'          => 'hashed',
            'email_verified'    => 'boolean',
            'consent_accepted'  => 'boolean',
            'is_alumni'         => 'boolean',
            'terms_accepted_at' => 'datetime',
            'profile_views'     => 'integer',
        ];
    }

    // Relationships

    public function studentRecord(): BelongsTo
    {
        return $this->belongsTo(Student::class, 'student_record_id');
    }

    public function section(): BelongsTo
    {
        return $this->belongsTo(Section::class);
    }

    public function batchRecord(): BelongsTo
    {
        return $this->belongsTo(Batch::class, 'batch_id');
    }

    public function consents(): HasMany
    {
        return $this->hasMany(Consent::class);
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }

    public function achievements(): HasMany
    {
        return $this->hasMany(Achievement::class);
    }

    public function careerProfile(): HasOne
    {
        return $this->hasOne(CareerProfile::class);
    }

    public function photos(): HasMany
    {
        return $this->hasMany(Photo::class);
    }

    /** Face-recognition and legacy manual tag rows. */
    public function photoTagRecords(): HasMany
    {
        return $this->hasMany(TaggedPhoto::class);
    }

    /** Photos this user is tagged in (photo_tags pivot). */
    public function taggedPhotos(): BelongsToMany
    {
        return $this->belongsToMany(Photo::class, 'photo_tags', 'user_id', 'photo_id')
            ->withPivot('tagged_by')
            ->withTimestamps();
    }

    // Convenience helpers 

    public function isLinkedToStudent(): bool
    {
        return ! is_null($this->student_record_id);
    }

    public function isApproved(): bool
    {
        return $this->status === self::STATUS_APPROVED;
    }

    /**
     * Why this account cannot receive a session, or null when sign-in may continue.
     *
     * @return array{message: string, code: string}|null
     */
    public function loginBlockReason(): ?array
    {
        if (! empty($this->suspended_at) || (method_exists($this, 'trashed') && $this->trashed())) {
            return [
                'message' => 'Account is suspended or unavailable.',
                'code'    => 'ACCOUNT_UNAVAILABLE',
            ];
        }

        return match ($this->status) {
            self::STATUS_APPROVED => null,
            self::STATUS_DISAPPROVED => [
                'message' => 'Your account was disapproved. Please contact an administrator if you believe this is a mistake.',
                'code'    => 'ACCOUNT_DISAPPROVED',
            ],
            default => [
                'message' => 'Your account is pending admin approval. You can sign in after an administrator approves it.',
                'code'    => 'ACCOUNT_PENDING',
            ],
        };
    }

    public function activeSubscription(): ?Subscription
    {
        return $this->subscriptions()
            ->where('status', 'active')
            ->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->latest('id')
            ->first();
    }

    public function subscriptionTier(): string
    {
        return \App\Support\SubscriptionAccess::tierFor($this);
    }

    public function hasPremiumAccess(): bool
    {
        return \App\Support\SubscriptionAccess::isPremium($this);
    }

    public function hasStandardAccess(): bool
    {
        return \App\Support\SubscriptionAccess::isStandard($this);
    }

    public function getIsPremiumAttribute(): bool
    {
        return $this->hasPremiumAccess();
    }

    public function getIsSubscribedAttribute(): bool
    {
        return \App\Support\SubscriptionAccess::isSubscribed($this);
    }

    public function getTierAttribute(): string
    {
        // Always resolve from SubscriptionAccess so Navbar/Directory/Analytics stay in sync.
        return $this->subscriptionTier();
    }

    public function getStudentIdAttribute(): ?string
    {
        return $this->studentRecord?->student_no
            ?? $this->attributes['student_id']
            ?? null;
    }

    public function getCourseAttribute(): ?string
    {
        return $this->studentRecord?->course
            ?? $this->attributes['course']
            ?? null;
    }

    public function getGraduationYearAttribute(): ?int
    {
        $year = $this->studentRecord?->graduation_year
            ?? $this->attributes['graduation_year']
            ?? null;

        return $year ? (int) $year : null;
    }

    public function getBatchAttribute(): ?string
    {
        if ($this->studentRecord?->graduation_year) {
            return (string) $this->studentRecord->graduation_year;
        }

        return $this->attributes['batch']
            ?? ($this->attributes['graduation_year'] ?? null);
    }

    public function getNicknameAttribute(): ?string
    {
        return $this->studentRecord?->nickname;
    }

    public function getBirthdayAttribute(): ?string
    {
        return $this->studentRecord?->birthday;
    }

    public function getHometownAttribute(): ?string
    {
        return $this->studentRecord?->hometown;
    }

    public function getHonorsAttribute(): ?string
    {
        return $this->studentRecord?->honors;
    }

    public function getOrganizationsAttribute(): ?string
    {
        return $this->studentRecord?->organizations;
    }

    public function getAchievementsTextAttribute(): ?string
    {
        // Named 'achievements_text' to avoid conflict with achievements() HasMany
        return $this->studentRecord?->achievements;
    }

    public function getMottoAttribute(): ?string
    {
        return $this->studentRecord?->motto
            ?? $this->attributes['motto']
            ?? null;
    }

    public function getAmbitionAttribute(): ?string
    {
        return $this->studentRecord?->ambition;
    }

    public function getFuturePlansAttribute(): ?string
    {
        return $this->studentRecord?->future_plans;
    }

    public function getFondestMemoryAttribute(): ?string
    {
        return $this->studentRecord?->fondest_memory;
    }

    public function getMostLikelyToAttribute(): ?string
    {
        return $this->studentRecord?->most_likely_to;
    }

    public function getMessageToBatchmatesAttribute(): ?string
    {
        return $this->studentRecord?->message_to_batchmates;
    }

    public function getMessageToParentsAttribute(): ?string
    {
        return $this->studentRecord?->message_to_parents;
    }

    public function getFacebookUrlAttribute(): ?string
    {
        return $this->studentRecord?->facebook_url;
    }

    public function getInstagramUrlAttribute(): ?string
    {
        return $this->studentRecord?->instagram_url;
    }

    public function getLinkedinUrlAttribute(): ?string
    {
        return $this->studentRecord?->linkedin_url;
    }

    public function getGithubUrlAttribute(): ?string
    {
        return $this->studentRecord?->github_url;
    }

    public function getProfilePictureAttribute(): ?string
    {
        // User's own uploaded photo takes priority; fall back to student record photo
        return $this->attributes['profile_picture']
            ?? $this->studentRecord?->photo
            ?? null;
    }

    public function getProfilePicturePublicIdAttribute(): ?string
    {
        return $this->attributes['profile_picture_public_id']
            ?? $this->studentRecord?->photo_public_id
            ?? null;
    }

    // Other accessors 

    public function getFullNameAttribute(): string
    {
        return "{$this->first_name} {$this->last_name}";
    }

    public function getDepartmentAttribute(): ?string
    {
        return self::getDepartment($this->course ?? '');
    }

    public function isSsoUser(): bool
    {
        return ! is_null($this->google_id);
    }

    //Meilisearch 
    public function searchableAs(): string
    {
        return 'users';
    }

    public function toSearchableArray(): array
    {
        // Load studentRecord if not already loaded
        $this->loadMissing('studentRecord');

        return [
            'id'              => $this->id,
            'name'            => $this->name,
            'student_id'      => $this->student_id,          // via accessor student_no
            'email'           => $this->email,
            'course'          => $this->course,               // via accessor
            'course_short'    => self::COURSE_SHORT[$this->course ?? ''] ?? $this->course,
            'section'         => $this->section?->name,
            'batch'           => $this->batch,                // via accessor
            'batch_id'        => $this->batch_id,
            'department'      => self::getDepartment($this->course ?? ''),
            'graduation_year' => $this->graduation_year,      // via accessor
            'profile_picture' => $this->profile_picture,      // via accessor
            'avatar'          => $this->avatar,
            'role'            => $this->role ?? 'student',
            'created_at'      => $this->created_at?->timestamp,
        ];
    }

    public function shouldBeSearchable(): bool
    {
        return in_array($this->role, [self::ROLE_STUDENT, self::ROLE_ALUMNI], true);
    }

    public static function currentGraduationCutoff(): int
    {
        return (int) now()->year;
    }

    public function resolvedGraduationYear(): ?int
    {
        $year = $this->graduation_year;

        if ($year) {
            return (int) $year;
        }

        $batch = $this->attributes['batch'] ?? null;

        return is_numeric($batch) && (int) $batch > 1900 ? (int) $batch : null;
    }

    public function sharesBatchYearWith(User $other): bool
    {
        $this->loadMissing('studentRecord');
        $other->loadMissing('studentRecord');

        $mine = $this->resolvedGraduationYear();
        $theirs = $other->resolvedGraduationYear();

        return $mine !== null && $theirs !== null && $mine === $theirs;
    }

    public function canBeViewedBy(?User $viewer): bool
    {
        if ($viewer && (int) $viewer->id === (int) $this->id) {
            return true;
        }

        $visibility = $this->profile_visibility ?: 'public';

        if ($visibility === 'public') {
            return true;
        }

        if (! $viewer || $visibility === 'private') {
            return false;
        }

        if ($visibility === 'alumni_only') {
            return $viewer->isAlumni();
        }

        if ($visibility === 'batchmates') {
            return $this->sharesBatchYearWith($viewer);
        }

        return false;
    }

    public function visibilityDenialPayload(): array
    {
        $visibility = in_array($this->profile_visibility, ['private', 'batchmates', 'alumni_only'], true)
            ? $this->profile_visibility
            : 'private';

        $message = match ($visibility) {
            'batchmates' => 'This profile is visible to students from the same batch year only.',
            'alumni_only' => 'This profile is visible to alumni only.',
            default => 'This profile is private.',
        };

        $student = [
            'id' => $this->id,
            'name' => $this->name,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'profile_picture' => $this->profile_picture,
            'avatar' => $this->avatar,
            'role' => $this->role,
            'is_alumni' => $this->isAlumni(),
            'academic_status' => $this->academicStatusLabel(),
        ];

        if ($visibility !== 'private') {
            $student['course'] = $this->course;
            $student['graduation_year'] = $this->resolvedGraduationYear();
            $student['batch'] = $this->batch;
        }

        return [
            'message' => $message,
            'restricted' => true,
            'visibility' => $visibility,
            'student' => $student,
        ];
    }

    public function scopeWhereGraduationYear($query, int $year)
    {
        return $query->where(function ($same) use ($year) {
            $same->whereHas('studentRecord', fn ($student) => $student->where('graduation_year', $year))
                ->orWhere(function ($fallback) use ($year) {
                    $fallback->where(function ($missing) {
                        $missing->whereDoesntHave('studentRecord', fn ($student) =>
                            $student->whereNotNull('graduation_year')->where('graduation_year', '>', 0)
                        );
                    })->where(function ($columns) use ($year) {
                        $columns->where('graduation_year', $year)
                            ->orWhere('batch', (string) $year);
                    });
                });
        });
    }

    public function scopeVisibleTo($query, ?User $viewer)
    {
        return $query->where(function ($visible) use ($viewer) {
            $visible->where('profile_visibility', 'public')
                ->orWhereNull('profile_visibility')
                ->orWhere('profile_visibility', '');

            if (! $viewer) {
                return;
            }

            $visible->orWhere('id', $viewer->id);

            $year = $viewer->resolvedGraduationYear();
            if ($year) {
                $visible->orWhere(function ($batchmates) use ($year) {
                    $batchmates->where('profile_visibility', 'batchmates')
                        ->whereGraduationYear($year);
                });
            }

            if ($viewer->isAlumni()) {
                $visible->orWhere('profile_visibility', 'alumni_only');
            }
        });
    }

    public static function bumpVisibilityEpoch(): void
    {
        $next = ((int) \Illuminate\Support\Facades\Cache::get('profile.visibility.epoch', 0)) + 1;
        \Illuminate\Support\Facades\Cache::forever('profile.visibility.epoch', $next);
    }

    public function qualifiesByGraduationYear(): bool
    {
        $year = $this->resolvedGraduationYear();

        return $year !== null && $year <= self::currentGraduationCutoff();
    }

    public function isAlumni(): bool
    {
        return $this->role === self::ROLE_ALUMNI || (bool) ($this->attributes['is_alumni'] ?? false);
    }

    public function academicStatusLabel(): string
    {
        if ($this->role === self::ROLE_FACULTY) {
            return 'Faculty';
        }

        if ($this->role === self::ROLE_ADMIN) {
            return 'Admin';
        }

        return $this->isAlumni() ? 'Alumni' : 'Current Student';
    }

    public function getAcademicStatusAttribute(): string
    {
        return $this->academicStatusLabel();
    }

    /**
     * Keep an account that was saved as alumni on the alumni role.
     * Graduation year does not change a current-student registration.
     */
    public function applyAlumniIdentity(): void
    {
        if (! in_array($this->role, [self::ROLE_STUDENT, self::ROLE_ALUMNI], true)
            && ! (bool) ($this->attributes['is_alumni'] ?? false)) {
            return;
        }

        if (! $this->isAlumni()) {
            return;
        }

        if ($this->role === self::ROLE_ALUMNI && (bool) ($this->attributes['is_alumni'] ?? false)) {
            return;
        }

        $this->forceFill([
            'role' => self::ROLE_ALUMNI,
            'is_alumni' => true,
        ])->saveQuietly();
    }

    public function syncIdentityFromGraduationYear(): void
    {
        // Batch year and account status are separate. Registration stores the status the person chose.
    }

    /**
     * Counts for the admin dashboard, analytics, and user list.
     * Uses the same non-deleted accounts shown in User Management.
     */
    public static function accountCensus(): array
    {
        static::promoteGraduatedAccounts();

        $accounts = static::query();
        $total = (clone $accounts)->count();
        $students = (clone $accounts)->currentStudents()->count();
        $alumni = (clone $accounts)->alumni()->count();
        // Yearbook faculty live in the faculties table, not users.role.
        $faculty = \App\Models\Faculty::query()->count();
        $admins = (clone $accounts)->where('role', self::ROLE_ADMIN)->count();
        $pending = (clone $accounts)->where('status', self::STATUS_PENDING)->whereNull('suspended_at')->count();
        $approved = (clone $accounts)->where('status', self::STATUS_APPROVED)->whereNull('suspended_at')->count();
        $disapproved = (clone $accounts)->where('status', self::STATUS_DISAPPROVED)->whereNull('suspended_at')->count();
        $suspended = (clone $accounts)->whereNotNull('suspended_at')->count();

        return [
            'total_users' => $total,
            'total_students' => $students,
            'total_alumni' => $alumni,
            'faculty_members' => $faculty,
            'admin_accounts' => $admins,
            'pending_users' => $pending,
            'approved_users' => $approved,
            'disapproved_users' => $disapproved,
            // Kept so older dashboard cards still receive a number.
            'verified_users' => $approved,
            'unverified_users' => $pending,
            'suspended_users' => $suspended,
        ];
    }

    /**
     * Live accounts only, one tier each. Soft-deleted users are excluded
     * so dashboard and subscription totals drop as soon as a user is removed.
     */
    public static function subscriptionTierCensus(): array
    {
        $users = static::query()->get(['id', 'role']);
        $subscriptions = \App\Models\Subscription::query()
            ->where('status', 'active')
            ->get(['user_id', 'tier', 'plan']);

        $premiumIds = [];
        $standardIds = [];
        foreach ($subscriptions as $subscription) {
            $plan = strtolower((string) $subscription->plan);
            $tier = strtolower((string) $subscription->tier);
            $isPremium = $tier === 'premium' || str_starts_with($plan, 'premium');
            if ($isPremium) {
                $premiumIds[(int) $subscription->user_id] = true;
            } else {
                $standardIds[(int) $subscription->user_id] = true;
            }
        }
        foreach (array_keys($premiumIds) as $userId) {
            unset($standardIds[$userId]);
        }

        $free = 0;
        $standard = 0;
        $premium = 0;
        $faculty = 0;
        $admins = 0;

        foreach ($users as $user) {
            $userId = (int) $user->id;
            if (isset($premiumIds[$userId])) {
                $premium++;
                continue;
            }
            if (isset($standardIds[$userId])) {
                $standard++;
                continue;
            }
            if ($user->role === self::ROLE_FACULTY) {
                $faculty++;
                continue;
            }
            if ($user->role === self::ROLE_ADMIN) {
                $admins++;
                continue;
            }
            $free++;
        }

        return [
            'total_users' => $users->count(),
            'free' => $free,
            'premium_standard' => $standard,
            'premium' => $premium,
            'faculty' => $faculty,
            'admin' => $admins,
        ];
    }

    public static function promoteGraduatedAccounts(): void
    {
        static::query()
            ->where('role', self::ROLE_STUDENT)
            ->where('is_alumni', true)
            ->update([
                'role' => self::ROLE_ALUMNI,
                'is_alumni' => true,
            ]);
    }

    public function profileViews()
    {
        return $this->hasMany(ProfileView::class, 'viewed_user_id');
    }

    /**
     * Student and alumni accounts counted on the admin dashboard.
     * Directory listings use this so their totals match those counters.
     */
    public function scopeDashboardAccounts($query)
    {
        return $query->where(function ($accounts) {
            $accounts->where(function ($students) {
                $students->currentStudents();
            })->orWhere(function ($alumni) {
                $alumni->alumni();
            });
        });
    }

    public function scopeAlumni($query)
    {
        return $query->where(function ($alumni) {
            $alumni->where('role', self::ROLE_ALUMNI)
                ->orWhere('is_alumni', true);
        });
    }

    public function scopeCurrentStudents($query)
    {
        return $query->where('role', self::ROLE_STUDENT)
            ->where(function ($flag) {
                $flag->whereNull('is_alumni')->orWhere('is_alumni', false);
            });
    }

    public function getPostsCountAttribute(): int
    {
        return \App\Models\Photo::where('user_id', $this->id)
            ->where('status', 'approved')
            ->count();
    }

    public function getTaggedCountAttribute(): int
    {
        return app(\App\Services\Analytics\EngagementAnalyticsService::class)->timesTaggedCount($this);
    }
}
