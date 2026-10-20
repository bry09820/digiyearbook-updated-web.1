<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('users', 'status')) {
            Schema::table('users', function (Blueprint $table) {
                $table->enum('status', ['pending', 'approved', 'disapproved'])
                    ->default('pending')
                    ->after('email_verified');
                $table->index('status');
            });
        }

        // Accounts that already passed the old email verification can keep signing in.
        if (Schema::hasColumn('users', 'email_verified')) {
            DB::table('users')->where('email_verified', true)->update(['status' => 'approved']);
        }

        DB::table('users')->whereIn('role', ['admin', 'faculty'])->update(['status' => 'approved']);
    }

    public function down(): void
    {
        if (Schema::hasColumn('users', 'status')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropIndex(['status']);
                $table->dropColumn('status');
            });
        }
    }
};
