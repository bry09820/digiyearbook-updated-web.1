<?php

namespace App\Services\Yearbook;

use App\Models\Album;
use App\Models\Batch;
use App\Models\Photo;
use App\Models\Yearbook;
use App\Services\Storage\CloudinaryService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;

class YearbookGeneratorService
{
    public function __construct(
        protected CloudinaryService $cloudinary,
    ) {}

    // Flipbook Page Data

    public function buildPageData(Yearbook $yearbook, Batch $batch): array
    {
        $pages    = [];
        $students = $batch->students()->orderBy('last_name')->orderBy('first_name')->get();

        // Student portraits
        $pages[] = [
            'type'     => 'students',
            'students' => $this->mapStudents($students->take(4)),
        ];


        $albums = Album::graduation()
            ->with('photos')
            ->latest('event_date')
            ->get();

        foreach ($albums as $album) {
            $pages[] = [
                'type'    => 'photos',
                'caption' => $album->title,
                'photos'  => $album->photos->take(3)->map(fn ($p) => [
                    'url'   => $p->cloudinary_url ?? $p->file_path,
                    'label' => $p->caption ?? $album->title,
                ])->values()->toArray(),
            ];
        }

        // Quotes from student mottos
        $quotes = $students->whereNotNull('motto')->take(6)
            ->map(fn ($s) => ['text' => $s->motto, 'author' => trim(($s->first_name ?? '') . ' ' . ($s->last_name ?? ''))])
            ->values()->toArray();

        if (count($quotes) > 0) {
            $pages[] = ['type' => 'quotes', 'quotes' => $quotes];
        }

        $pages[] = ['type' => 'stats', 'stats' => $this->buildStats($batch)];

        return $pages;
    }

    // PDF Generation

    public function generatePdf(Yearbook $yearbook, Batch $batch): string
    {
        $pages = $this->buildPageData($yearbook, $batch);

        $pdf = Pdf::loadHTML(
            view('yearbook.pdf', compact('yearbook', 'batch', 'pages'))->render()
        )->setPaper('a4', 'portrait')->setOptions([
            'isHtml5ParserEnabled'    => true,
            'isRemoteEnabled'         => true,
            'defaultFont'             => 'times',
            'isFontSubsettingEnabled' => true,
            'dpi'                     => 150,
        ]);

        $path = "yearbooks/generated/{$batch->graduation_year}-{$batch->id}.pdf";
        Storage::put($path, $pdf->output());

        $yearbook->update([
            'pdf_path'         => $path,
            'pdf_generated_at' => now(),
            'status'           => 'published',
        ]);

        return $path;
    }

    // Photo Upload 

    public function uploadPhoto(
        Yearbook     $yearbook,
        UploadedFile $file,
        ?int         $albumId,
        int          $uploadedBy,
    ): Photo {
        $result = $this->cloudinary->uploadPhoto(
            file:    $file,
            userId:  $uploadedBy,
            folder:  "yearbooks/{$yearbook->id}/photos",
            options: [
                'transformation' => [
                    ['quality' => 'auto', 'fetch_format' => 'auto'],
                    ['width'   => 1200, 'height' => 900, 'crop' => 'limit'],
                ],
            ]
        );

        $photo = Photo::create([
            'yearbook_id'    => $yearbook->id,
            'album_id'       => $albumId,
            'cloudinary_id'  => $result['public_id'],
            'cloudinary_url' => $result['secure_url'],
            'width'          => $result['width'],
            'height'         => $result['height'],
            'uploaded_by'    => $uploadedBy,
        ]);

        dispatch(new \App\Jobs\AI\AnalyzePhotoFaces($photo));

        return $photo;
    }

    // Helpers 

    protected function mapStudents(Collection $students): array
    {
        return $students->map(fn ($s) => [
            'name'     => trim(($s->first_name ?? '') . ' ' . ($s->last_name ?? $s->name ?? '')),
            'initials' => strtoupper(
                substr($s->first_name ?? $s->name, 0, 1) .
                substr($s->last_name  ?? '',        0, 1)
            ),
            'photoUrl' => $s->profile_picture
                ? Storage::url($s->profile_picture)
                : null,
        ])->toArray();
    }

    protected function buildStats(Batch $batch): array
    {
        return [
            'graduates' => $batch->students()->count(),
            'sections'  => $batch->sections()->count(),
            'programs'  => $batch->students()->distinct('course')->count('course'),
            'year'      => $batch->graduation_year,
        ];
    }
}