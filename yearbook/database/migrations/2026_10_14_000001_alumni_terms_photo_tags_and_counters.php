<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'is_alumni')) {
                $table->boolean('is_alumni')->default(false)->after('role');
            }
            if (! Schema::hasColumn('users', 'terms_accepted_at')) {
                $table->timestamp('terms_accepted_at')->nullable()->after('consent_accepted');
            }
        });

        if (! Schema::hasTable('photo_tags')) {
            Schema::create('photo_tags', function (Blueprint $table) {
                $table->id();
                $table->foreignId('photo_id')->constrained('photos')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('tagged_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
                $table->unique(['photo_id', 'user_id']);
            });
        }

        Schema::table('photos', function (Blueprint $table) {
            if (! Schema::hasColumn('photos', 'views_count')) {
                $table->unsignedBigInteger('views_count')->default(0);
            }
        });

        if (Schema::hasTable('yearbooks')) {
            Schema::table('yearbooks', function (Blueprint $table) {
                if (! Schema::hasColumn('yearbooks', 'download_count')) {
                    $table->unsignedBigInteger('download_count')->default(0);
                }
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('photo_tags');

        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'terms_accepted_at')) {
                $table->dropColumn('terms_accepted_at');
            }
            if (Schema::hasColumn('users', 'is_alumni')) {
                $table->dropColumn('is_alumni');
            }
        });

        Schema::table('photos', function (Blueprint $table) {
            if (Schema::hasColumn('photos', 'views_count')) {
                $table->dropColumn('views_count');
            }
        });

        if (Schema::hasTable('yearbooks') && Schema::hasColumn('yearbooks', 'download_count')) {
            Schema::table('yearbooks', function (Blueprint $table) {
                $table->dropColumn('download_count');
            });
        }
    }
};
