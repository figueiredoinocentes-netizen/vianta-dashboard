import { useState, useCallback, useEffect } from 'react';

/**
 * Hook that persists filter state in sessionStorage so it survives
 * page navigations within the SPA.
 */
export function usePersistedFilters<T extends Record<string, any>>(
  storageKey: string,
  defaults: T
): [T, (updates: Partial<T>) => void] {
  const [filters, setFiltersState] = useState<T>(() => {
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored) {
        return { ...defaults, ...JSON.parse(stored) };
      }
    } catch {
      // ignore
    }
    return defaults;
  });

  // Sync to sessionStorage whenever filters change
  useEffect(() => {
    sessionStorage.setItem(storageKey, JSON.stringify(filters));
  }, [storageKey, filters]);

  const setFilters = useCallback(
    (updates: Partial<T>) => {
      setFiltersState((prev) => ({ ...prev, ...updates }));
    },
    []
  );

  return [filters, setFilters];
}
