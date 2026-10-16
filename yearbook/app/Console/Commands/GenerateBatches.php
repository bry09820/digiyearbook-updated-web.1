<?php

namespace App\Console\Commands;

use App\Models\Batch;
use App\Services\Student\BatchService;
use Illuminate\Console\Command;

class GenerateBatches extends Command
{
    protected $signature = 'batches:generate
        {--sections    : Also generate sections and distribute students}
        {--assign      : Assign users to existing batch records}
        {--per-section=40 : Max students per section (default: 40)}
        {--dry-run     : Preview what would be created without saving}';

    protected $description = 'Generate graduation batches, sections, and assign students automatically';

    public function handle(BatchService $service): int
    {
        $isDryRun = $this->option('dry-run');

        $this->newLine();
        $this->line('  <fg=yellow;options=bold>🎓 Sinag-Bughaw — Batch Generation System</>');
        $this->line('  ' . str_repeat('─', 44));
        $this->newLine();

        if ($isDryRun) {
            $this->line('  <fg=cyan>[DRY RUN] No data will be saved.</>');
            $this->newLine();
        }

        // Generate batch records
        $this->line('  <fg=blue>📦 Step 1:</> Scanning users for unique batch groups...');

        if ($isDryRun) {
            $this->previewBatches();
            return Command::SUCCESS;
        }

        $created = $service->generateBatches();
        $this->info("     ✓ {$created} new batch(es) created.");
        $this->newLine();

        // Assign users batch_id
        if ($this->option('assign') || $this->option('sections')) {
            $this->line('  <fg=blue>👤 Step 2:</> Assigning students to batches...');
            $updated = $service->assignUsersToBatches();
            $this->info("     ✓ {$updated} student(s) assigned.");
            $this->newLine();
        }

        // Generate sections
        if ($this->option('sections')) {
            $perSection = (int) $this->option('per-section');
            $this->line("  <fg=blue>🗂  Step 3:</> Generating sections ({$perSection} students/section)...");
            $sections = $service->generateSections($perSection);
            $this->info("     ✓ {$sections} section(s) created and students distributed.");
            $this->newLine();
        }

        // Summary table
        $this->line('  <fg=yellow>📊 Batch Summary:</>');
        $this->newLine();

        $batches = Batch::campusYears()->withCount('students')->with('sections')->get();

        $this->table(
            ['Batch Name', 'Department', 'Grad. Year', 'Students', 'Sections'],
            $batches->map(fn ($b) => [
                $b->name,
                $b->department,
                $b->graduation_year,
                $b->students_count,
                $b->sections->count(),
            ])
        );

        $this->newLine();
        $this->info('  ✅ Done!');

        if (! $this->option('sections')) {
            $this->line('  <fg=gray>  Tip: Run with --sections to auto-generate sections and distribute students.</>');
        }

        if (! $this->option('assign')) {
            $this->line('  <fg=gray>  Tip: Run with --assign to link existing users to their batch records.</>');
        }

        $this->newLine();

        return Command::SUCCESS;
    }

    private function previewBatches(): void
    {
        $groups = \App\Models\User::whereNotNull('graduation_year')
            ->whereBetween('graduation_year', [\App\Models\Batch::MIN_YEAR, \App\Models\Batch::maxYear()])
            ->whereNotNull('course')
            ->where('role', 'student')
            ->select('course', 'graduation_year')
            ->selectRaw('count(*) as student_count')
            ->groupBy('course', 'graduation_year')
            ->get();

        if ($groups->isEmpty()) {
            $this->warn('  No eligible students found.');
            return;
        }

        $this->table(
            ['Would Create Batch', 'Department', 'Year', 'Students'],
            $groups->map(fn ($g) => [
                BatchService::getCourseCode($g->course) . ' Batch ' . $g->graduation_year,
                BatchService::getDepartment($g->course),
                $g->graduation_year,
                $g->student_count,
            ])
        );
    }
}