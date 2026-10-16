<?php

declare(strict_types=1);

namespace App\Services\Storage;

use App\Contracts\StorageServiceInterface;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * LocalStorageService
 */
class LocalStorageService implements StorageServiceInterface
{
    public function uploadPhoto(
        UploadedFile $file,
        int $userId,
        string $folder = 'general',
        array $options = []
    ): array {
        $path     = $file->store("{$folder}/users/{$userId}", 'public');
        if ($path === false) {
            throw new \RuntimeException('Could not write the upload to storage/app/public. Check that the folder is writable.');
        }
        $publicId = $path;
        $url      = Storage::disk('public')->url($path);

        Log::info('[LocalStorage] uploadPhoto', ['path' => $path, 'url' => $url]);

        return [
            'success'       => true,
            'public_id'     => $publicId,
            'url'           => $url,
            'secure_url'    => $url,
            'resource_type' => $options['resource_type'] ?? 'image',
            'format'        => $file->getClientOriginalExtension(),
            'bytes'         => $file->getSize(),
            'width'         => null,
            'height'        => null,
            'duration'      => null,
            'created_at'    => now()->toIso8601String(),
        ];
    }

    public function uploadBulk(
        array $files,
        int $userId,
        string $folder = 'general',
        array $options = []
    ): array {
        $results = [];
        foreach ($files as $file) {
            $results[] = $this->uploadPhoto($file, $userId, $folder, $options);
        }
        return $results;
    }

    public function deletePhoto(string $publicId, string $resourceType = 'image'): array
    {
        $deleted = Storage::disk('public')->delete($publicId);
        return ['success' => $deleted, 'public_id' => $publicId, 'result' => $deleted ? 'ok' : 'not_found'];
    }

    public function generateSignedUrl(
        string $publicId,
        int $ttl = 3600,
        array $transformations = []
    ): array {
        $url = Storage::disk('public')->url($publicId);
        return [
            'success'    => true,
            'signed_url' => $url,
            'expires_at' => now()->addSeconds($ttl)->toIso8601String(),
        ];
    }

    public function getBandwidthUsage(): array
    {
        return [
            'success'                => true,
            'bandwidth_used_bytes'   => 0,
            'bandwidth_used_human'   => '0 B',
            'storage_used_bytes'     => 0,
            'storage_used_human'     => '0 B',
            'last_updated'           => now()->toIso8601String(),
        ];
    }

    public function getUserStorageUsed(int $userId): int
    {
        return 0;
    }
}