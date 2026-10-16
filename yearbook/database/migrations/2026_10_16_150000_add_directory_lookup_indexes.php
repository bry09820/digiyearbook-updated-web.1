<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $this->addIndex($table, 'users', ['role'], 'users_role_index');
            if (Schema::hasColumn('users', 'course')) {
                $this->addIndex($table, 'users', ['role', 'course'], 'users_role_course_index');
            }
        });

        if (Schema::hasTable('faculty') && Schema::hasColumn('faculty', 'department')) {
            Schema::table('faculty', function (Blueprint $table) {
                $this->addIndex($table, 'faculty', ['department', 'name'], 'faculty_department_name_index');
            });
        }

        if (Schema::hasTable('students') && Schema::hasColumn('students', 'course')) {
            Schema::table('students', function (Blueprint $table) {
                $this->addIndex($table, 'students', ['course'], 'students_course_index');
            });
        }

        if (Schema::hasTable('photos') && Schema::hasColumn('photos', 'status')) {
            Schema::table('photos', function (Blueprint $table) {
                $this->addIndex($table, 'photos', ['user_id', 'status'], 'photos_user_status_index');
            });
        }
    }

    public function down(): void
    {
        $this->dropIndex('users', 'users_role_index');
        $this->dropIndex('users', 'users_role_course_index');
        $this->dropIndex('faculty', 'faculty_department_name_index');
        $this->dropIndex('students', 'students_course_index');
        $this->dropIndex('photos', 'photos_user_status_index');
    }

    private function addIndex(Blueprint $table, string $tableName, array $columns, string $name): void
    {
        if (! Schema::hasTable($tableName)) {
            return;
        }

        $existing = collect(Schema::getIndexes($tableName))->pluck('name');
        if ($existing->contains($name)) {
            return;
        }

        $table->index($columns, $name);
    }

    private function dropIndex(string $tableName, string $name): void
    {
        if (! Schema::hasTable($tableName)) {
            return;
        }

        $existing = collect(Schema::getIndexes($tableName))->pluck('name');
        if (! $existing->contains($name)) {
            return;
        }

        Schema::table($tableName, function (Blueprint $table) use ($name) {
            $table->dropIndex($name);
        });
    }
};
