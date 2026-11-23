import { useEffect, useState } from 'react';
import api from '../../../shared/api';
import type { VillageSuggestion } from './fillRows';

/**
 * LGD villages and hamlets matching what the operator types (GET /address/villages).
 * Narrowed by the profile's district; when that finds nothing (district missing or spelt
 * differently), the state, then all of India, is searched instead.
 */
export function useVillageSuggestions(query: string, district: string, state: string, enabled: boolean) {
  const [items, setItems] = useState<VillageSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!enabled || q.length < 2) { setItems([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      const attempts = [
        district ? { q, district, state } : null,
        state ? { q, state } : null,
        { q },
      ].filter(Boolean) as Record<string, string>[];
      try {
        let found: VillageSuggestion[] = [];
        for (const params of attempts) {
          const r = await api.get('/address/villages', { params, skipErrorToast: true } as any);
          found = Array.isArray(r.data) ? r.data : [];
          if (found.length || cancelled) break;
        }
        if (!cancelled) { setItems(found); setFailed(false); }
      } catch {
        if (!cancelled) { setItems([]); setFailed(true); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, district, state, enabled]);

  return { items, loading, failed };
}
