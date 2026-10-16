<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('otp_verifications')) {
            return;
        }

        // The column was TIMESTAMP ... ON UPDATE CURRENT_TIMESTAMP, so any later
        // update replaced the 15-minute expiry with the current time.
        DB::statement('ALTER TABLE otp_verifications MODIFY expires_at DATETIME NOT NULL');
        DB::statement('ALTER TABLE otp_verifications MODIFY otp VARCHAR(6) NOT NULL');
    }

    public function down(): void
    {
        if (! Schema::hasTable('otp_verifications')) {
            return;
        }

        DB::statement('ALTER TABLE otp_verifications MODIFY expires_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP');
    }
};
