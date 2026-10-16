import { useState, useEffect, useCallback, useRef } from 'react';
import { facultyApi } from '@/api/faculty.api';
import { pageCacheKey, readPageCache, writePageCache } from '@/utils/pageCache';

function facultyGroupsFromPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  return [];
}

export function useFacultyGroups() {
  const initialFaculty = readPageCache(pageCacheKey(['faculty', '']));
  const [groups,       setGroups]       = useState(initialFaculty?.groups ?? []);
  const [directoryTotal, setDirectoryTotal] = useState(initialFaculty?.total ?? 0);
  const [activeDeptId, setActiveDeptId] = useState(null); // null = all
  const [search,       setSearch]       = useState('');
  const [loading,      setLoading]      = useState(!initialFaculty);
  const [error,        setError]        = useState(null);
  const debounceRef = useRef(null);

  const loadGroups = useCallback(async (q = '', silent = false) => {
    const cacheKey = pageCacheKey(['faculty', q]);
    const cached = readPageCache(cacheKey);
    if (cached) {
      setGroups(cached.groups);
      setDirectoryTotal(cached.total);
    } else if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const { data } = await facultyApi.byDepartment(q ? { search: q } : {});
      const nextGroups = facultyGroupsFromPayload(data);
      const liveTotal = Number(data?.total_faculty);
      const total = Number.isFinite(liveTotal) ? liveTotal : nextGroups.reduce((n, group) => n + (Number(group.faculty_count) || 0), 0);
      writePageCache(cacheKey, { groups: nextGroups, total });
      setGroups(nextGroups);
      setDirectoryTotal(total);
    } catch {
      if (!silent && !cached) setError('Unable to load faculty. Please try again.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const searchRef = useRef('');
  searchRef.current = search;

  // Initial load, then stay aligned with admin creates, edits, and deletes.
  useEffect(() => {
    loadGroups();
    const timer = window.setInterval(() => loadGroups(searchRef.current, true), 8000);
    const onFocus = () => loadGroups(searchRef.current, true);
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [loadGroups]);

  const handleSearch = (val) => {
    setSearch(val);
    setActiveDeptId(null);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadGroups(val), 320);
  };

  const handleDeptTab = (id) => {
    setActiveDeptId(id);
    setSearch('');
    loadGroups();
  };

  const clearSearch = () => {
    setSearch('');
    setActiveDeptId(null);
    loadGroups();
  };

  // Client-side department filter (tabs)
  const visibleGroups = activeDeptId
    ? groups.filter(g => g.id === activeDeptId)
    : groups;

  const matchedFaculty = groups.reduce(
    (n, g) => n + (Number(g.faculty_count ?? g.faculty?.length) || 0),
    0
  );
  const totalFaculty = search ? matchedFaculty : (directoryTotal || matchedFaculty);
  const totalDepts = groups.length;

  return {
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
  };
}
