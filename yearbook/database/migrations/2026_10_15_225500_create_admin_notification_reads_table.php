<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('admin_notification_reads')) {
            return;
        }

        Schema::create('admin_notification_reads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('admin_id')->constrained('admins')->cascadeOnDelete();
            $table->string('notification_key', 191);
            $table->timestamp('read_at');
            $table->unique(['admin_id', 'notification_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('admin_notification_reads');
    }
};
