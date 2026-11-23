/** Address fields the village pick can fill, in profile order. */
export const FILL_FIELDS = [
  { key: 'city', label: 'City' },
  { key: 'sub_district', label: 'Sub-District / Tehsil' },
  { key: 'block', label: 'Block' },
  { key: 'district', label: 'District' },
  { key: 'state', label: 'State' },
  { key: 'post_office', label: 'Post Office' },
  { key: 'police_station', label: 'Police Station' },
  { key: 'pincode', label: 'PIN Code' },
] as const;

export interface VillageSuggestion {
  /** village: LGD village. hamlet: linked to an LGD village. town: India Post head or sub office. */
  kind: 'village' | 'hamlet' | 'town';
  code: number | null;
  name: string;
  lgdVillage: string | null;
  subDistrict: string | null;
  block: string | null;
  district: string;
  state: string;
  /** Towns only. */
  pincode?: string;
  postOffice?: string;
  /** Approximate straight-line km from the cafe; absent when the cafe or place point is unknown or rough. */
  distanceKm?: number;
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
  /** What the profile has now, when it differs (the save replaces it). */
  current: string;
  /** Ticked by default unless it is a learned value still in doubt. */
  checked: boolean;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Rows to offer after a village is picked. LGD fields come from the pick itself; post office,
 * police station and pincode only from the engine (learned facts or the pincode's offices).
 * Values the profile already has are left out. The operator picked this village, so differing
 * values are ticked too (shown as replacing the old one); only learned values in doubt are not.
 */
export function buildFillRows(
  pick: VillageSuggestion,
  resolved: Partial<Record<string, ResolvedField>>,
  profile: Record<string, string>,
): FillRow[] {
  // From the pick itself: LGD for villages and hamlets, India Post for towns.
  const lgd: Record<string, string | null | undefined> = {
    sub_district: pick.subDistrict, block: pick.block, district: pick.district, state: pick.state,
    ...(pick.kind === 'town' ? { city: pick.name, post_office: pick.postOffice, pincode: pick.pincode } : {}),
  };
  const rows: FillRow[] = [];
  for (const { key, label } of FILL_FIELDS) {
    const r = resolved[key];
    const fromLgd = lgd[key] || null;
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
      checked: !needsReview,
    });
  }
  return rows;
}
