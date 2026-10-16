<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('post_reactions')) {
            Schema::create('post_reactions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('photo_id')->constrained('photos')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->string('type', 16);
                $table->timestamps();

                $table->unique(['photo_id', 'user_id']);
                $table->index(['photo_id', 'type']);
            });
        }

        if (! Schema::hasTable('post_comments')) {
            Schema::create('post_comments', function (Blueprint $table) {
                $table->id();
                $table->foreignId('photo_id')->constrained('photos')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->text('body');
                $table->timestamps();

                $table->index(['photo_id', 'created_at']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('post_comments');
        Schema::dropIfExists('post_reactions');
    }
};
