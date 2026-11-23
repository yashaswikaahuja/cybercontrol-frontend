/** Address fields the village pick can fill, in profile order. */
export const FILL_FIELDS = [
  { key: 'sub_district', label: 'Sub-District / Tehsil' },
  { key: 'block', label: 'Block' },
  { key: 'district', label: 'District' },
  { key: 'state', label: 'State' },
  { key: 'post_office', label: 'Post Office' },
  { key: 'police_station', label: 'Police Station' },
  { key: 'pincode', label: 'PIN Code' },
] as const;

export interface VillageSuggestion {
  code: number;
  name: string;
  lgdVillage: string | null;
  subDistrict: string | null;
  block: string | null;
  district: string;
  state: string;
}

/** One field of POST /api/address/resolve. */
export interface ResolvedField {
  value: string;
  source: 'aadhaar_qr' | 'operator' | 'reference' | 'learned';
  confidence: number;
  needsReview: boolean;
}

export interface FillRow {
  key: string;
  label: string;
  value: string;
  /** reference: official LGD / India Post data. learned: what other operators saved. */
  origin: 'reference' | 'learned';
  needsReview: boolean;
  confidence: number;
  /** What the profile has now, when it differs. */
  current: string;
  /** Ticked by default: the profile field is empty and the value is not in doubt. */
  checked: boolean;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Rows to offer after a village is picked. LGD fields come from the pick itself; post office,
 * police station and pincode only from the engine (learned facts or the pincode's offices).
 * Values the profile already has are left out; differing ones are offered unticked.
 */
export function buildFillRows(
  pick: VillageSuggestion,
  resolved: Partial<Record<string, ResolvedField>>,
  profile: Record<string, string>,
): FillRow[] {
  const lgd: Record<string, string | null> = {
    sub_district: pick.subDistrict, block: pick.block, district: pick.district, state: pick.state,
  };
  const rows: FillRow[] = [];
  for (const { key, label } of FILL_FIELDS) {
    const r = resolved[key];
    const fromLgd = lgd[key];
    const engine = r && (r.source === 'reference' || r.source === 'learned') ? r : null;
    const value = fromLgd || engine?.value || '';
    if (!value) continue;
    const current = (profile[key] || '').trim();
    if (current && same(current, value)) continue;
    const origin: FillRow['origin'] = fromLgd ? 'reference' : engine!.source as FillRow['origin'];
    const needsReview = fromLgd ? false : engine!.needsReview;
    rows.push({
      key, label, value, origin, needsReview,
      confidence: fromLgd ? 0.95 : engine!.confidence,
      current,
      checked: !current && !needsReview,
    });
  }
  return rows;
}
