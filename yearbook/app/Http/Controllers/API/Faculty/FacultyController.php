<?php

namespace App\Http\Controllers\API\Faculty;

use App\Http\Controllers\Controller;
use App\Models\Faculty;
use Cloudinary\Cloudinary;
use Cloudinary\Configuration\Configuration;
use Illuminate\Http\Request;

class FacultyController extends Controller
{
    private ?Cloudinary $cloudinary = null;

    public function __construct()
    {
    }

    private function bootCloudinary(): ?Cloudinary
    {
        Configuration::instance([
            'cloud' => [
                'cloud_name' => config('cloudinary.cloud_name'),
                'api_key'    => config('cloudinary.api_key'),
                'api_secret' => config('cloudinary.api_secret'),
            ],
            'url' => ['secure' => true],
        ]);

        if (! config('cloudinary.cloud_name') || ! config('cloudinary.api_key') || ! config('cloudinary.api_secret')) {
            return null;
        }

        return $this->cloudinary ??= new Cloudinary();
    }

    public function index()
    {
        $faculty = Faculty::orderBy('name')->paginate(20);
        $faculty->getCollection()->transform(fn ($f) => $this->formatFaculty($f));

        return response()->json($faculty);
    }

    public function byDepartment(Request $request)
    {
        $search = $request->query('search');

        $faculty = Faculty::query()
            ->when($search, fn ($q) => $q->where(function ($match) use ($search) {
                $match->where('name', 'like', "%{$search}%")
                    ->orWhere('title', 'like', "%{$search}%")
                    ->orWhere('department', 'like', "%{$search}%");
            }))
            ->orderBy('department')
            ->orderBy('name')
            ->get();

        $groups = $faculty
            ->groupBy('department')
            ->map(fn ($members, $dept) => [
                'id'            => $dept,
                'name'          => $dept,
                'code'          => null,
                'color'         => null,
                'description'   => null,
                'faculty_count' => $members->count(),
                'faculty'       => $members->map(fn ($f) => $this->formatFaculty($f))->values(),
            ])
            ->values();

        return response()->json([
            'data' => $groups,
            'total_faculty' => Faculty::query()->count(),
            'matched' => $faculty->count(),
        ]);
    }

    public function census()
    {
        $accounts = \App\Models\User::accountCensus();

        return response()->json([
            'total_users' => $accounts['total_users'],
            'total_students' => $accounts['total_students'],
            'total_alumni' => $accounts['total_alumni'],
            'faculty_members' => $accounts['faculty_members'],
            'verified_users' => $accounts['verified_users'],
            'unverified_users' => $accounts['unverified_users'],
        ]);
    }

    public function show(int $id)
    {
        return response()->json($this->formatFaculty(Faculty::findOrFail($id)));
    }

    private function formatFaculty(Faculty $f): array
    {
        return [
            'id'         => $f->id,
            'name'       => $f->name,
            'position'   => $f->title,
            'department' => $f->department,
            'bio'        => $f->bio,
            'email'      => $f->email,
            'image_url'  => $this->resolveImageUrl($f->image),
        ];
    }

    private function resolveImageUrl(?string $image): ?string
    {
        if (blank($image)) {
            return null;
        }

        if (str_starts_with($image, 'http://') || str_starts_with($image, 'https://')) {
            return $image;
        }

        try {
            $cloudinary = $this->bootCloudinary();
            if (! $cloudinary) {
                return null;
            }

            return (string) $cloudinary->image($image)->toUrl();
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('FacultyController: could not resolve image URL', [
                'image' => $image,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }
}
