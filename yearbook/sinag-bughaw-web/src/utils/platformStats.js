import { useAppConfig } from '@/features/platform/AppConfigProvider';

function formatLiveCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return number.toLocaleString('en-PH');
}

export function usePlatformStats() {
  const { config, loading } = useAppConfig();
  const stats = config?.stats ?? {};
  const pending = loading && stats.graduates == null;

  return [
    { icon: 'fas fa-user-graduate', value: pending ? '—' : formatLiveCount(stats.graduates ?? 0), label: 'Graduates' },
    { icon: 'fas fa-book-open', value: pending ? '—' : formatLiveCount(stats.programs ?? 0), label: 'Programs' },
    { icon: 'fas fa-images', value: pending ? '—' : formatLiveCount(stats.photos ?? 0), label: 'Photos' },
  ];
}
