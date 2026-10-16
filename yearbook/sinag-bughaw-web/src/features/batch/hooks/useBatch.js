import { useState, useEffect, useCallback, useRef } from 'react';
import { batchApi, sectionsApi } from '@/api/batch.api';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { hasPaidAccess } from '@/utils/subscription';
import { pageCacheKey, readPageCache, writePageCache } from '@/utils/pageCache';

// useBatch

export function useBatch() {
  const { user } = useAuth();

  // Standard + Premium both unlock paid discovery/batchmate features.
  const isPremium = hasPaidAccess(user);

  const [batchmates,   setBatchmates]   = useState([]);
  const [batches,      setBatches]      = useState({});
  const [departments,  setDepartments]  = useState([]);
  const [deptStudents, setDeptStudents] = useState({});
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);
  const [filterMeta,   setFilterMeta]   = useState({ course: null, year: null });
  const [directoryStats, setDirectoryStats] = useState(null);
  const [catalogSections, setCatalogSections] = useState([]);
  const batchmateRequest = useRef(0);

  /** Fetch current user's batchmates with optional course/year override. */
  const fetchBatchmates = useCallback(async (params = {}, options = {}) => {
    const requestId = ++batchmateRequest.current;
    const cacheKey = pageCacheKey(['batchmates', JSON.stringify(params)]);
    const cached = readPageCache(cacheKey);
    if (cached) {
      setBatchmates(cached.batchmates);
      setCatalogSections(cached.sections);
      setFilterMeta(cached.filter);
      setDirectoryStats(cached.stats);
    } else if (!options.silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const { data } = await batchApi.batchmates(params);
      if (requestId !== batchmateRequest.current) return data;
      const next = {
        batchmates: data.data ?? [],
        sections: Array.isArray(data.sections) ? data.sections : [],
        filter: data.filter ?? {},
        stats: data.stats ?? null,
      };
      writePageCache(cacheKey, next);
      setBatchmates(next.batchmates);
      setCatalogSections(next.sections);
      setFilterMeta(next.filter);
      setDirectoryStats(next.stats);
      return data;
    } catch (err) {
      if (requestId !== batchmateRequest.current) return null;
      if (!cached) setError(err.response?.data?.message ?? 'Failed to load batchmates.');
      return null;
    } finally {
      if (requestId === batchmateRequest.current && !options.silent) setLoading(false);
    }
  }, []);

  /** Fetch all batches grouped by department. */
  const fetchAllBatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await batchApi.all();
      setBatches(data.data ?? {});
      setDepartments(data.departments ?? []);
      return data;
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to load batches.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /** Fetch students from a specific department/college. */
  const fetchByDepartment = useCallback(async (department) => {
    setLoading(true);
    try {
      const { data } = await batchApi.byDepartment(department);
      setDeptStudents(data.data ?? {});
      return data;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    user,
    isPremium,        // paid access from shared subscription helpers
    batchmates,
    batches,
    departments,
    deptStudents,
    loading,
    error,
    filterMeta,
    directoryStats,
    catalogSections,
    fetchBatchmates,
    fetchAllBatches,
    fetchByDepartment,
  };
}

// useSection

export function useSection(sectionId = null) {
  const { user } = useAuth();

  const isPremium = hasPaidAccess(user);

  const sectionCacheKey = pageCacheKey(['section', sectionId ?? 'list']);
  const cachedSection = readPageCache(sectionCacheKey);
  const [sections,  setSections]  = useState(cachedSection?.sections ?? []);
  const [section,   setSection]   = useState(cachedSection?.section ?? null);
  const [students,  setStudents]  = useState(cachedSection?.students ?? []);
  const [meta,      setMeta]      = useState(cachedSection?.meta ?? null);
  const [counts,    setCounts]    = useState(cachedSection?.counts ?? { total: 0, visible: 0 });
  const [loading,   setLoading]   = useState(!cachedSection);
  const [error,     setError]     = useState(null);

  useEffect(() => {
    const cacheKey = pageCacheKey(['section', sectionId ?? 'list']);
    const cached = readPageCache(cacheKey);
    if (cached) {
      setSections(cached.sections ?? []);
      setSection(cached.section ?? null);
      setStudents(cached.students ?? []);
      setMeta(cached.meta ?? null);
      setCounts(cached.counts ?? { total: 0, visible: 0 });
    } else {
      setLoading(true);
    }
    setError(null);

    if (sectionId) {
      sectionsApi.show(sectionId)
        .then(({ data }) => {
          const next = {
            sections: [],
            section: data.section,
            students: data.students?.data ?? [],
            meta: data.students,
            counts: { total: data.total ?? 0, visible: data.visible ?? 0 },
          };
          writePageCache(cacheKey, next);
          setSection(next.section);
          setStudents(next.students);
          setMeta(next.meta);
          setCounts(next.counts);
        })
        .catch(() => {
          if (!cached) setError('Section not found.');
        })
        .finally(() => setLoading(false));
    } else {
      sectionsApi.list()
        .then(({ data }) => {
          const next = { sections: data, section: null, students: [], meta: null, counts: { total: 0, visible: 0 } };
          writePageCache(cacheKey, next);
          setSections(data);
        })
        .catch(() => {
          if (!cached) setError('Failed to load sections.');
        })
        .finally(() => setLoading(false));
    }
  }, [sectionId]);

  return {
    sections,
    section,
    students,
    meta,
    counts,
    loading,
    error,
    isPremium,
  };
}
