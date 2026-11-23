import { useEffect, useState } from 'react';
import api from '../../../shared/api';
import type { VillageSuggestion } from './fillRows';

/**
 * LGD villages, hamlets and towns matching what the operator types (GET /address/villages).
 * The profile's district and state rank results near the customer first.
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
      // The server ranks the profile's district, then its state, then the rest of India.
      const params: Record<string, string> = { q };
      if (district) params.district = district;
      if (state) params.state = state;
      try {
        const r = await api.get('/address/villages', { params, skipErrorToast: true } as any);
        const found: VillageSuggestion[] = Array.isArray(r.data) ? r.data : [];
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
