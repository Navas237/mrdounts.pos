import { useState, useEffect } from 'react';

/**
 * Hook to manage pause / freeze of receiving new orders per kitchen station
 * عند إيقاف الاستلام، يتم تجميد العدد الحالي والطلبات الحالية حتى ينتهي المطبخ
 * ولا تزيد الأعداد في الشاشة حتى يضغط على "استئناف الاستلام"
 */
export function useStationPause(stationKey: string) {
  const storageKey = `mrdounts:station_paused_${stationKey}`;

  const [pausedAt, setPausedAt] = useState<string | null>(() => {
    return localStorage.getItem(storageKey);
  });

  const isPaused = Boolean(pausedAt);

  const togglePause = () => {
    if (isPaused) {
      localStorage.removeItem(storageKey);
      setPausedAt(null);
    } else {
      const now = new Date().toISOString();
      localStorage.setItem(storageKey, now);
      setPausedAt(now);
    }
  };

  const resume = () => {
    localStorage.removeItem(storageKey);
    setPausedAt(null);
  };

  const pause = () => {
    const now = new Date().toISOString();
    localStorage.setItem(storageKey, now);
    setPausedAt(now);
  };

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === storageKey) {
        setPausedAt(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [storageKey]);

  return {
    isPaused,
    pausedAt,
    togglePause,
    pause,
    resume,
  };
}
