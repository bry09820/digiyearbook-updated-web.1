<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('content_views')) {
            return;
        }

        DB::statement('
            DELETE c1 FROM content_views c1
            INNER JOIN content_views c2
                ON c1.content_type = c2.content_type
                AND c1.content_id = c2.content_id
                AND c1.viewer_user_id = c2.viewer_user_id
                AND c1.id > c2.id
            WHERE c1.content_type = "post"
                AND c1.viewer_user_id IS NOT NULL
        ');

        if (Schema::hasTable('photos') && Schema::hasColumn('photos', 'views_count')) {
            DB::statement('
                UPDATE photos p
                JOIN (
                    SELECT content_id, COUNT(DISTINCT viewer_user_id) AS views
                    FROM content_views
                    WHERE content_type = "post" AND viewer_user_id IS NOT NULL
                    GROUP BY content_id
                ) v ON v.content_id = p.id
                SET p.views_count = v.views
            ');
        }
    }

    public function down(): void
    {
        // View rows that were collapsed cannot be restored.
    }
};
