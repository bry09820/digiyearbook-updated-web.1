import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { batchApi } from '@/api/batch.api';
import { faceApi } from '@/api/gallery.api';
import FaceSearchButton from '@/components/ui/FaceSearchButton';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import { storageUrl } from '@/api/client';
import { directoryProfilePath } from '@/utils/studentProfilePath';
import { readPageCache, writePageCache } from '@/utils/pageCache';

function usableFaceMatches(matches = []) {
  const normalized = matches
    .map(m => ({
      ...m,
      user_id: studentUserId(m),
      student_record_id: m?.student_record_id ?? m?.student_id ?? null,
    }))
    .filter(m => m.user_id);
  const validMatches = normalized.filter(m => m.name || m.student_id || m.course || m.profile_picture);
  const source = validMatches.length ? validMatches : normalized;
  return Array.from(new Map(source.map(m => [m.user_id, m])).values());
}

function studentUserId(student) {
  const id = Number(student?.account_user_id ?? student?.user_id ?? student?.id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function studentName(student) {
  return student?.name || `${student?.first_name ?? ''} ${student?.last_name ?? ''}`.trim();
}

function allBatchStudents(batches) {
  return Object.values(batches ?? {}).flat().flatMap(batch =>
    (batch.sections ?? []).flatMap(section =>
      (section.students ?? []).map(student => ({
        ...student,
        name: studentName(student),
        section_name: student.section_name ?? section.name,
        section_id: student.section_id ?? section.id,
        batch_id: batch.id,
        batch_name: batch.name,
        batch_year: batch.graduation_year,
        department: batch.department,
        course: student.course ?? section.course ?? batch.course,
      }))
    )
  );
}

function looseCourseMatches(value, filter) {
  if (!filter) return true;
  const a = String(value ?? '').toLowerCase();
  const b = String(filter ?? '').toLowerCase();
  if (!a) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const words = b.replace(/bachelor|science|administration|in|of|and|-/g, ' ').split(/\s+/).filter(w => w.length > 2);
  return words.length > 0 && words.every(w => a.includes(w));
}

function uniqueDepartmentsFromBatches(groupedBatches) {
  return Array.from(new Set(
    Object.entries(groupedBatches ?? {})
      .flatMap(([g, bs]) => [g, ...(bs ?? []).map(b => b.department)])
      .map(d => String(d ?? '').trim()).filter(Boolean)
  )).sort((a, b) => a.localeCompare(b));
}

function computeStats(batches) {
  const all = Object.values(batches ?? {}).flat();
  const uniqueBatches = new Map(all.map(batch => [batch.id, batch]));
  return {
    totalBatches:  all.length || uniqueBatches.size,
    totalStudents: all.reduce((s, b) => s + Number(b.students_count ?? 0), 0),
    totalSections: all.reduce((s, b) => s + (b.sections?.length ?? 0), 0),
    totalDepts:    Object.keys(batches ?? {}).length,
  };
}

export default function SectionsPage() {
  const [courseFilter,     setCourseFilter]     = useState(null);   // eslint-disable-line no-unused-vars
  const [departmentFilter, setDepartmentFilter] = useState(null);   // eslint-disable-line no-unused-vars
  const cachedSections = readPageCache('sections-directory');
  const [batches,          setBatches]          = useState(cachedSections?.batches ?? {});
  const [departments,      setDepartments]      = useState(cachedSections?.departments ?? []);
  const [directoryStats,   setDirectoryStats]   = useState(cachedSections?.stats ?? null);
  const [registered,       setRegistered]       = useState(cachedSections?.registered ?? []);
  const [batchLoading,     setBatchLoading]     = useState(!cachedSections);
  const [query,            setQuery]            = useState('');
  const [faceSearching,    setFaceSearching]    = useState(false);
  const [matchedIds,       setMatchedIds]       = useState(new Set());
  const [isFaceMode,       setIsFaceMode]       = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = (silent = false) => {
      const cached = readPageCache('sections-directory');
      if (cached) {
        setBatches(cached.batches);
        setDirectoryStats(cached.stats);
        setRegistered(cached.registered);
        setDepartments(cached.departments);
      } else if (!silent) {
        setBatchLoading(true);
      }
      batchApi.all()
        .then(({ data }) => {
          if (cancelled) return;
          const next = data.data ?? {};
          const snapshot = {
            batches: next,
            stats: data.stats ?? null,
            registered: Array.isArray(data.registered) ? data.registered : [],
            departments: data.departments?.length ? data.departments : uniqueDepartmentsFromBatches(next),
          };
          writePageCache('sections-directory', snapshot);
          setBatches(snapshot.batches);
          setDirectoryStats(snapshot.stats);
          setRegistered(snapshot.registered);
          setDepartments(snapshot.departments);
        })
        .finally(() => {
          if (!silent && !cancelled) setBatchLoading(false);
        });
    };

    load(false);
    const timer = window.setInterval(() => load(true), 8000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const onSearch = val => {
    setQuery(val);
    setMatchedIds(new Set());
    setIsFaceMode(false);
  };

  const handleFaceFile = async file => {
    setFaceSearching(true);
    setMatchedIds(new Set());
    setQuery('');
    setIsFaceMode(false);
    try {
      const fd = new FormData();
      fd.append('face_image', file);
      const { data } = await faceApi.search(fd);
      const matches = usableFaceMatches(data.matches ?? []);
      if (!matches.length) {
        alert('No matching student found by face.');
        return;
      }
      setMatchedIds(new Set(matches.map(m => m.user_id)));
      setIsFaceMode(true);
    } catch (err) {
      alert(err?.response?.data?.message || 'Face search failed. Please try again.');
    } finally {
      setFaceSearching(false);
    }
  };

  const activeDepartments = departments.length ? departments : Object.keys(batches ?? {});

  const studentResults = (() => {
    let r = registered.length ? registered : allBatchStudents(batches);
    if (courseFilter)                  r = r.filter(s => looseCourseMatches(s.course, courseFilter));
    if (isFaceMode && matchedIds.size) r = r.filter(s => matchedIds.has(studentUserId(s)));
    if (query.trim()) {
      const q = query.toLowerCase();
      r = r.filter(s =>
        s.name?.toLowerCase().includes(q) ||
        s.student_no?.toLowerCase().includes(q) ||
        s.course?.toLowerCase().includes(q) ||
        s.section_name?.toLowerCase().includes(q) ||
        String(s.batch_year ?? '').includes(q) ||
        s.department?.toLowerCase().includes(q)
      );
    }
    return r;
  })();

  const batchMatchesSearch = batch => {
    if (
      courseFilter &&
      !looseCourseMatches(batch.course, courseFilter) &&
      !looseCourseMatches(batch.course_code, courseFilter) &&
      !(batch.sections ?? []).some(s => looseCourseMatches(s.course, courseFilter))
    ) return false;
    if (isFaceMode && matchedIds.size)
      return (batch.sections ?? []).some(sec =>
        (sec.students ?? []).some(st => matchedIds.has(studentUserId(st)))
      );
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return [
      batch.name, batch.course, batch.course_code, batch.department, batch.graduation_year,
      ...(batch.sections ?? []).flatMap(sec => [
        sec.name, sec.course,
        ...(sec.students ?? []).map(st => studentName(st)),
      ]),
    ].some(v => String(v ?? '').toLowerCase().includes(q));
  };

  const computed = computeStats(batches);
  const totalBatches = Number(directoryStats?.batches ?? computed.totalBatches);
  const totalStudents = Number(directoryStats?.total_students ?? computed.totalStudents);
  const totalSections = Number(directoryStats?.sections ?? computed.totalSections);
  const totalDepts = directoryStats?.departments?.length || computed.totalDepts;
  const isSearchActive = query.trim() || isFaceMode;

  return (
    <div className="font-['Plus_Jakarta_Sans',sans-serif] min-h-screen flex flex-col bg-[#f0f2f8]">
      <Navbar />

      {/* Hero */}
      <header className="bg-[#1B2A4A] px-[8%] pt-14 pb-[52px] text-center text-white rounded-b-[48px]">
        <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[#F5A623] mb-3.5">
          National University Lipa
        </p>
        <h1 className="text-[46px] font-extrabold leading-[1.1] tracking-[-0.5px] mb-3">
          Academic <span className="text-[#F5A623]">Batches</span>
        </h1>
        <p className="text-[15px] font-normal text-white/55 mb-8 leading-relaxed max-w-lg mx-auto">
          Relive the milestones and pioneer memories through our academic records.
        </p>

        {/* Search bar */}
        <div className={`max-w-[560px] mx-auto flex items-center gap-2 bg-white/[0.08] rounded-xl px-[10px] py-[6px] border
          ${isFaceMode ? 'border-[#F5A623]' : 'border-white/15'}`}>
          <i className="fas fa-search text-[#F5A623] text-sm shrink-0" />
          <input
            type="text"
            value={query}
            onChange={e => onSearch(e.target.value)}
            placeholder="Search gallery, batches, sections, students..."
            className="flex-1 bg-transparent border-none outline-none text-white text-sm min-w-0 placeholder-white/40"
          />
          {faceSearching && (
            <i className="fas fa-spinner fa-spin text-white/40 text-[13px] shrink-0" />
          )}
          <div className="relative shrink-0 w-9 h-9">
            <FaceSearchButton onFile={handleFaceFile} loading={faceSearching} />
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      {!batchLoading && Object.keys(batches).length > 0 && (
        <div className="bg-white border-b border-[#e8eaf0] flex items-center justify-center gap-14 px-[8%] py-[18px]">
          {[
            { num: totalBatches,  label: 'Batches'     },
            { num: totalStudents, label: 'Students'    },
            { num: totalDepts,    label: 'Departments' },
            { num: totalSections, label: 'Sections'    },
          ].map(({ num, label }) => (
            <div key={label} className="flex flex-col items-center">
              <span className="text-[26px] font-extrabold text-[#1B2A4A] leading-none">
                {num.toLocaleString()}
              </span>
              <span className="text-[11px] font-semibold text-slate-400 tracking-[0.1em] uppercase mt-1">
                {label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Main */}
      <main className="flex-1 px-[8%] pt-9 pb-16 min-h-[70vh]">

        {/* Student search results */}
        {isSearchActive && (
          <section className="mb-10">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[18px] font-extrabold text-[#1B2A4A] m-0">Student matches</h2>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#EEF2FF] text-[#3730a3]">
                {studentResults.length} result{studentResults.length !== 1 ? 's' : ''}
              </span>
            </div>

            {studentResults.length === 0 ? (
              <div className="rounded-2xl bg-white border border-[#e8eaf0] py-10 px-5 text-center text-slate-400">
                <i className="fas fa-user-slash text-[36px] mb-3 block text-slate-200" />
                <span className="text-sm font-medium">No students matched this search.</span>
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
                {studentResults.slice(0, 18).map(student => {
                  const avatar =
                    storageUrl(student.profile_picture ?? student.photo ?? student.photo_url) ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name || 'Student')}&background=1B2A4A&color=F5A623&bold=true`;
                  return (
                    <Link
                      key={`${student.batch_id}-${student.section_id}-${student.account_user_id ?? student.user_id ?? student.id}`}
                      to={directoryProfilePath(student)}
                      className="no-underline flex items-center gap-3.5 rounded-[14px] border border-[#e8eaf0] bg-white p-4 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(27,42,74,0.1)]"
                    >
                      <img
                        src={avatar}
                        alt={student.name}
                        className="w-[52px] h-[52px] rounded-[10px] object-cover shrink-0"
                        onError={e => {
                          e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name || 'Student')}&background=1B2A4A&color=F5A623&bold=true`;
                        }}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-extrabold text-[#1B2A4A] m-0 truncate">{student.name}</p>
                        <p className="text-xs font-semibold text-[#3730a3] mt-[3px] m-0">
                          Batch {student.batch_year} · {student.section_name}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5 m-0 truncate">{student.department}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Batch Cards */}
        {batchLoading && departments.length === 0 ? (
          <LoadingSkeleton variant="card" count={6} />

        ) : departments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <i className="fas fa-graduation-cap text-[48px] text-slate-200" />
            <p className="font-semibold m-0">No batches are available yet.</p>
            <p className="text-sm m-0">Sections will appear here once the yearbook batches are ready.</p>
          </div>

        ) : (
          <div className="flex flex-col gap-10">
            {(directoryStats?.departments ?? []).length > 0 && (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 mb-8">
                {(directoryStats.departments ?? []).map(dept => (
                  <div key={dept.department} className="bg-white rounded-2xl border border-[#e8eaf0] px-4 py-4">
                    <p className="m-0 text-[11px] font-bold tracking-[0.12em] uppercase text-slate-400">{dept.department}</p>
                    <p className="m-0 mt-1 text-[28px] font-extrabold text-[#1B2A4A] leading-none">
                      {Number(dept.students_count ?? 0).toLocaleString()}
                    </p>
                    <p className="m-0 mt-1 text-xs font-semibold text-slate-400">
                      registered student{Number(dept.students_count) === 1 ? '' : 's'}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {activeDepartments.map(dept => {
              const deptBatches = (batches[dept] ?? [])
                .filter(b => !courseFilter || (b.sections ?? []).some(s => looseCourseMatches(s.course, courseFilter)))
                .filter(batchMatchesSearch);
              if (!deptBatches.length) return null;

              return (
                <div key={dept}>
                  {/* Department divider */}
                  <div className="flex items-center gap-3 mb-5">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-[11px] font-bold tracking-[0.15em] uppercase text-slate-400 whitespace-nowrap">
                      {dept}
                      {directoryStats?.departments?.some(item => item.department === dept) && (
                        <> · {Number(directoryStats.departments.find(item => item.department === dept)?.students_count ?? 0).toLocaleString()} registered</>
                      )}
                    </span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>

                  <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-5">
                    {deptBatches.map(batch => {
                      const count        = Number(batch.students_count ?? 0);
                      const hasData      = count > 0;
                      const sectionCount = batch.sections?.length ?? 0;

                      return (
                        <div
                          key={`${dept}-${batch.id}`}
                          className="bg-white rounded-[18px] border border-[#e8eaf0] overflow-hidden flex flex-col transition-all duration-150 cursor-default hover:-translate-y-[3px] hover:shadow-[0_12px_32px_rgba(27,42,74,0.12)]"
                        >
                          {/* Accent stripe */}
                          <div className={`h-[5px] shrink-0 ${hasData ? 'bg-[#F5A623]' : 'bg-[#e8eaf0]'}`} />

                          {/* Body */}
                          <div className="flex flex-col flex-1 p-7">

                            {/* Year + pill */}
                            <div className="flex items-start justify-between mb-4">
                              <span className="text-[52px] font-extrabold text-[#1B2A4A] leading-none tracking-[-1px]">
                                {batch.graduation_year}
                              </span>
                              <span className={`text-xs font-bold px-3 py-[5px] rounded-full mt-1 whitespace-nowrap
                                ${hasData
                                  ? 'bg-[#FEF3C7] text-[#92400e]'
                                  : 'bg-[#f1f5f9] text-slate-400'
                                }`}>
                                {count.toLocaleString()} student{count !== 1 ? 's' : ''}
                              </span>
                            </div>

                            {/* Batch name */}
                            <p className="text-base font-extrabold text-[#1B2A4A] m-0 mb-1 leading-snug">
                              {batch.name}
                            </p>

                            {/* Course code */}
                            {batch.course_code && (
                              <p className="text-xs font-semibold text-[#3730a3] m-0">
                                {batch.course_code}
                              </p>
                            )}

                            {(batch.sections ?? []).length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {(batch.sections ?? []).slice(0, 8).map(section => (
                                  <span
                                    key={section.id}
                                    className="rounded-lg border border-[#e8eaf0] bg-[#f8fafc] px-2 py-1 text-[11px] font-bold text-[#1B2A4A]"
                                  >
                                    {section.name}
                                  </span>
                                ))}
                                {(batch.sections ?? []).length > 8 && (
                                  <span className="rounded-lg bg-[#EEF2FF] px-2 py-1 text-[11px] font-bold text-[#3730a3]">
                                    +{(batch.sections ?? []).length - 8} more
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Spacer */}
                            <div className="flex-1 min-h-[28px]" />

                            {/* Meta */}
                            <div className="flex items-center gap-5 py-3.5 border-t border-b border-[#f1f5f9] mb-5">
                              <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                                <i className="fas fa-users text-[11px] text-[rgba(27,42,74,0.35)]" />
                                {count.toLocaleString()} students
                              </span>
                              {sectionCount > 0 && (
                                <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                                  <i className="fas fa-layer-group text-[11px] text-[rgba(27,42,74,0.35)]" />
                                  {sectionCount} section{sectionCount !== 1 ? 's' : ''}
                                </span>
                              )}
                            </div>

                            {/* CTA */}
                            {hasData ? (
                              <Link
                                to={`/batchmates?year=${batch.graduation_year}&department=${encodeURIComponent(dept)}${courseFilter ? `&course=${encodeURIComponent(courseFilter)}` : ''}`}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1B2A4A] px-4 py-[13px] text-sm font-bold text-[#F5A623] no-underline box-border transition-colors hover:bg-[#253968]"
                              >
                                View Batchmates
                                <i className="fas fa-arrow-right text-xs" />
                              </Link>
                            ) : (
                              <div className="flex w-full items-center justify-center rounded-xl bg-[#f8fafc] px-4 py-[13px] text-sm font-semibold text-slate-400 cursor-not-allowed box-border">
                                No data yet
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
