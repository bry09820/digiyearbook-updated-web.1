<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE announcements MODIFY created_by BIGINT UNSIGNED NULL');
    }

    public function down(): void
    {
        DB::statement('UPDATE announcements SET created_by = (SELECT id FROM users ORDER BY id LIMIT 1) WHERE created_by IS NULL');
        DB::statement('ALTER TABLE announcements MODIFY created_by BIGINT UNSIGNED NOT NULL');
    }
};
