<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE galleries MODIFY visibility VARCHAR(20) NOT NULL DEFAULT 'public'");
    }

    public function down(): void
    {
        DB::statement("UPDATE galleries SET visibility = 'private' WHERE visibility NOT IN ('public', 'private')");
        DB::statement("ALTER TABLE galleries MODIFY visibility ENUM('public', 'private') NOT NULL DEFAULT 'public'");
    }
};
