import { useFacultyGroups } from '@/features/faculty/hooks/useFacultyGroups';
import DepartmentSection from '../components/DepartmentSection';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import FilterTabStrip from '@/components/ui/FilterTabStrip';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';

function SearchIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function EmptyIcon() {
  return (
    <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function shortDepartmentLabel(name = '') {
  return String(name)
    .replace(/^Bachelor of Science in Business Administration\s*-\s*/i, 'BSBA ')
    .replace(/^Bachelor of Science in\s+/i, '')
    .replace(/^Bachelor of\s+/i, '')
    .replace(/^BS\s+/i, '')
    .trim();
}

export default function FacultyPage() {
  const {
    groups,
    visibleGroups,
    activeDeptId,
    search,
    loading,
    error,
    totalFaculty,
    totalDepts,
    handleSearch,
    handleDeptTab,
    clearSearch,
  } = useFacultyGroups();

  return (
    <div className="flex min-h-screen flex-col bg-[#f4f7fe] font-sans text-[#1d2b4b]">
      <Navbar />

      <header className="min-h-[140px] bg-gradient-to-br from-[#1d2b4b] to-[#2a3d66] px-5 py-8 text-white sm:px-[8%] rounded-b-[48px]">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#fdb813]/30 bg-[#fdb813]/15 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#fdb813]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#fdb813]" />
              National University Lipa
            </span>

            <h1 className="m-0 mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              Meet Our <span className="text-[#fdb813]">Faculty</span>
            </h1>

            <p className="m-0 mt-2 text-sm leading-relaxed text-white/70">
              The dedicated educators who mentor, inspire, and guide every Nationalian toward excellence.
            </p>
          </div>

          <div className="flex w-full flex-col gap-4 lg:w-[520px]">
            {!loading && (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
                  <span className="block text-2xl font-black text-[#fdb813]">{totalFaculty}</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Faculty Members</span>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
                  <span className="block text-2xl font-black text-[#fdb813]">{totalDepts}</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Departments</span>
                </div>
              </div>
            )}

            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#fdb813]">
                <SearchIcon />
              </span>
              <input
                type="text"
                className="h-12 w-full rounded-xl border border-white/15 bg-white/10 pl-11 pr-11 text-sm font-medium text-white outline-none placeholder-white/45 transition focus:border-[#fdb813]/60 focus:bg-white/15"
                placeholder="Search by name, position, or department..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                aria-label="Search faculty"
              />
              {search && (
                <button
                  type="button"
                  className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg border-0 bg-white/10 text-white/70 transition hover:bg-white/20 hover:text-white"
                  onClick={clearSearch}
                  aria-label="Clear search"
                >
                  <XIcon />
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {!search && groups.length > 1 && (
        <nav className="border-b border-slate-200 bg-white px-5 py-3 shadow-sm sm:px-[8%]" aria-label="Filter by department">
          <div className="mx-auto max-w-[1180px]">
            <FilterTabStrip
              ariaLabel="Filter faculty by department"
              activeValue={activeDeptId}
              onChange={handleDeptTab}
              tabs={[
                { label: 'All Departments', value: null, count: totalFaculty },
                ...groups.map((g) => ({
                  label: shortDepartmentLabel(g.name),
                  value: g.id,
                  count: g.faculty_count,
                })),
              ]}
            />
          </div>
        </nav>
      )}

      <main className="mx-auto w-full max-w-[1180px] flex-1 px-5 py-8 sm:px-8">
        {loading && visibleGroups.length === 0 ? (
          <LoadingSkeleton variant="card" count={6} />
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700" role="alert">
            {error}
          </div>
        ) : visibleGroups.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-300">
              <EmptyIcon />
            </div>
            <h2 className="m-0 text-lg font-black text-[#1d2b4b]">No faculty found</h2>
            <p className="m-0 mt-2 text-sm text-slate-500">Try a different search term or browse all departments.</p>
            {search && (
              <button
                type="button"
                onClick={clearSearch}
                className="mt-5 rounded-xl border-0 bg-[#fdb813] px-5 py-2.5 text-sm font-black text-[#1d2b4b] transition hover:bg-amber-400"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          visibleGroups.map((dept) => (
            <DepartmentSection
              key={dept.id}
              department={dept}
              isOnly={visibleGroups.length === 1}
            />
          ))
        )}
      </main>

      <Footer />
    </div>
  );
}
