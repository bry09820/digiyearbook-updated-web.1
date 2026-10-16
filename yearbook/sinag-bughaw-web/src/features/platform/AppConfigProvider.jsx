import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { appConfigApi } from '@/api/appConfig.api';

const DEFAULT_CONFIG = {
  school_name: 'National University - Lipa',
  yearbook_name: 'Sinag-Bughaw Digital Yearbook',
  contact_email: '',
  maintenance_mode: '0',
  academic_year: '2025-2026',
  graduation_batch: '',
  graduation_date: '',
  graduation_theme: '',
  publish_yearbook: '0',
  max_upload_size_mb: '10',
  allowed_file_types: 'jpg,jpeg,png,mp4,mp3,pdf',
  allow_student_posts: '1',
  allow_comments: '1',
  allow_reactions: '1',
  enable_premium_subscription: '1',
  premium_badge_display: '1',
  enable_flipbook_viewer: '1',
  enable_yearbook_pdf_download: '1',
  enable_student_directory_search: '1',
  features: {
    maintenance_mode: false,
    publish_yearbook: false,
    allow_student_posts: true,
    allow_comments: true,
    allow_reactions: true,
    enable_premium_subscription: true,
    premium_badge_display: true,
    enable_flipbook_viewer: true,
    enable_yearbook_pdf_download: true,
    enable_student_directory_search: true,
  },
  upload: {
    max_upload_size_mb: 10,
    allowed_file_types: 'jpg,jpeg,png,mp4,mp3,pdf',
  },
};

const AppConfigContext = createContext({
  config: DEFAULT_CONFIG,
  loading: true,
  refresh: async () => {},
  isOn: () => false,
});

function mergeConfig(payload) {
  const data = payload?.data ?? payload ?? {};
  const features = data.features ?? {};

  return {
    ...DEFAULT_CONFIG,
    ...data,
    features: {
      ...DEFAULT_CONFIG.features,
      ...features,
      maintenance_mode:
        features.maintenance_mode ?? data.maintenance_mode === '1',
      publish_yearbook:
        features.publish_yearbook ?? data.publish_yearbook === '1',
      allow_student_posts:
        features.allow_student_posts ?? data.allow_student_posts !== '0',
      allow_comments:
        features.allow_comments ?? data.allow_comments !== '0',
      allow_reactions:
        features.allow_reactions ?? data.allow_reactions !== '0',
      enable_premium_subscription:
        features.enable_premium_subscription ?? data.enable_premium_subscription !== '0',
      premium_badge_display:
        features.premium_badge_display ?? data.premium_badge_display !== '0',
      enable_flipbook_viewer:
        features.enable_flipbook_viewer ?? data.enable_flipbook_viewer !== '0',
      enable_yearbook_pdf_download:
        features.enable_yearbook_pdf_download ?? data.enable_yearbook_pdf_download !== '0',
      enable_student_directory_search:
        features.enable_student_directory_search ?? data.enable_student_directory_search !== '0',
    },
    upload: {
      ...DEFAULT_CONFIG.upload,
      ...(data.upload ?? {}),
    },
  };
}

export function AppConfigProvider({ children }) {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const isMounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await appConfigApi.get();
      if (!isMounted.current) return;
      setConfig(mergeConfig(data));
    } catch {
      if (!isMounted.current) return;
      setConfig(DEFAULT_CONFIG);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    refresh();
    const id = setInterval(refresh, 8000);
    return () => {
      isMounted.current = false;
      clearInterval(id);
    };
  }, [refresh]);

  const isOn = useCallback((featureKey) => {
    const value = config.features?.[featureKey] ?? config[featureKey];
    return value === true || value === 1 || value === '1';
  }, [config]);

  const value = useMemo(
    () => ({ config, loading, refresh, isOn }),
    [config, loading, refresh, isOn]
  );

  return (
    <AppConfigContext.Provider value={value}>
      {children}
    </AppConfigContext.Provider>
  );
}

export function useAppConfig() {
  return useContext(AppConfigContext);
}
