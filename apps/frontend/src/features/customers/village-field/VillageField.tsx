import { useEffect, useId, useState } from 'react';
import api from '../../../shared/api';
import { buildFillRows, type FillRow, type ResolvedField, type VillageSuggestion } from './fillRows';
import { useVillageSuggestions } from './useVillageSuggestions';

interface Props {
  initial: string;
  /** Flattened profile values (district, state, pincode, ...). */
  profile: Record<string, string>;
  /** Saves the village and the ticked fields in one profile update. */
  onSave: (fields: Record<string, any>) => Promise<void>;
  onCancel: () => void;
}

const ink = { color: 'hsl(var(--ink))' };
const muted = { color: 'hsl(var(--pt-muted))' };
const review = { color: 'hsl(35 92% 38%)', background: 'hsl(35 92% 48% / 0.12)' };

const place = (s: VillageSuggestion) => [
  s.kind === 'town' ? `town · PIN ${s.pincode}` : s.lgdVillage ? `hamlet of ${s.lgdVillage}` : null,
  s.subDistrict, `${s.district}, ${s.state}`,
].filter(Boolean).join(' · ');

/**
 * Village field with LGD suggestions. Picking a village offers the rest of the address
 * (sub-district, block, district, state from LGD; post office and police station from what
 * operators saved before) as ticked rows the operator confirms before saving.
 */
export function VillageField({ initial, profile, onSave, onCancel }: Props) {
  const listId = useId();
  const [query, setQuery] = useState(initial);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [pick, setPick] = useState<VillageSuggestion | null>(null);
  const [rows, setRows] = useState<FillRow[] | null>(null);
  const [saving, setSaving] = useState(false);
  const { items, loading, failed } = useVillageSuggestions(query, profile.district || '', profile.state || '', open && !pick);

  useEffect(() => { setActive(-1); }, [items]);

  const choose = async (s: VillageSuggestion) => {
    setPick(s); setQuery(s.name); setOpen(false); setRows(null);
    let resolved: Record<string, ResolvedField> = {};
    try {
      const input = s.kind === 'town'
        ? { post_office: s.postOffice, pincode: s.pincode, district: s.district, state: s.state }
        : {
          village: s.name, district: s.district, state: s.state,
          ...(s.subDistrict ? { sub_district: s.subDistrict } : {}),
          ...(s.block ? { block: s.block } : {}),
          ...(profile.pincode ? { pincode: profile.pincode } : {}),
        };
      const r = await api.post('/address/resolve', { input }, { skipErrorToast: true } as any);
      resolved = r.data?.fields || {};
    } catch {
      // Engine unavailable: the LGD fields from the pick are still offered.
    }
    setRows(buildFillRows(s, resolved, profile));
  };

  const save = async () => {
    const value = query.trim();
    if (!value) { onCancel(); return; }
    const fields: Record<string, any> = { village: { value, source: 'manual', confidence: 1 } };
    if (pick && rows) {
      for (const r of rows) {
        if (!r.checked) continue;
        fields[r.key] = { value: r.value, source: 'address_engine', addressSource: r.origin, confidence: r.confidence };
      }
    }
    setSaving(true);
    try { await onSave(fields); } finally { setSaving(false); }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { if (open && items.length) setOpen(false); else onCancel(); return; }
    if (e.key === 'ArrowDown' && items.length) { e.preventDefault(); setOpen(true); setActive((i) => Math.min(items.length - 1, i + 1)); return; }
    if (e.key === 'ArrowUp' && items.length) { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (open && active >= 0 && items[active]) void choose(items[active]);
      else void save();
    }
  };

  const showList = open && !pick && items.length > 0;
  const q = query.trim();
  const status = pick ? null
    : q.length < 2 ? 'Type 2 or more letters to see villages and towns.'
      : loading ? 'Searching LGD villages…'
        : failed ? 'Suggestions are unavailable. Enter saves the name as typed.'
          : open && !items.length ? 'No village or town found. Enter saves the name as typed.' : null;
  const ticked = rows?.filter((r) => r.checked).length ?? 0;

  return (
    <div className="w-full min-w-0">
      <input
        autoFocus
        role="combobox"
        aria-label="Village"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setPick(null); setRows(null); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="text-[15px] rounded-lg px-2.5 py-1.5 outline-none w-full"
        style={{ background: 'hsl(var(--marigold) / 0.1)', border: '1px solid hsl(var(--marigold) / 0.4)', ...ink }}
      />
      {showList && (
        <ul id={listId} role="listbox" aria-label="Villages and towns" className="mt-1 rounded-lg overflow-hidden max-h-64 overflow-y-auto"
          style={{ background: 'hsl(var(--pt-card))', border: '1px solid hsl(var(--pt-border))' }}>
          {items.map((s, i) => (
            <li key={`${s.kind}-${s.code ?? s.pincode}-${s.name}-${s.district}`} id={`${listId}-${i}`} role="option" aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); void choose(s); }}
              onMouseEnter={() => setActive(i)}
              className="px-3 py-2 cursor-pointer"
              style={i === active ? { background: 'hsl(var(--marigold) / 0.12)' } : undefined}>
              <span className="block text-[14px]" style={ink}>{s.name}</span>
              <span className="block text-[11px]" style={muted}>{place(s)}</span>
            </li>
          ))}
        </ul>
      )}
      {status && <p role="status" className="mt-1 text-[11px]" style={muted}>{status}</p>}

      {pick && (
        <div className="mt-2 rounded-lg px-3 py-2" style={{ border: '1px solid hsl(var(--pt-border))', background: 'hsl(var(--pt-secondary) / 0.35)' }}>
          <p className="text-[11px] mb-1.5" style={muted}>
            {pick.kind === 'town' ? `${pick.name} is a town (India Post, PIN ${pick.pincode}). ` : pick.lgdVillage ? `${pick.name} is a hamlet of ${pick.lgdVillage} (LGD). ` : ''}Fill the rest of the address:
          </p>
          {!rows ? (
            <p role="status" className="text-[12px]" style={muted}>Looking up the address…</p>
          ) : !rows.length ? (
            <p className="text-[12px]" style={muted}>The profile already has these address fields.</p>
          ) : (
            <ul className="space-y-1">
              {rows.map((r, i) => (
                <li key={r.key}>
                  <label className="flex items-start gap-2 text-[13px] cursor-pointer">
                    <input type="checkbox" className="mt-0.5" checked={r.checked}
                      onChange={() => setRows((prev) => prev!.map((x, j) => (j === i ? { ...x, checked: !x.checked } : x)))} />
                    <span className="min-w-0">
                      <span style={muted}>{r.label}: </span>
                      <span style={ink}>{r.value}</span>
                      <span className="ml-1 text-[10px]" style={muted}>{r.origin === 'learned' ? 'saved by operators' : 'LGD'}</span>
                      {r.needsReview && <span className="ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={review}>Check, then tick</span>}
                      {r.current && <span className="block text-[11px]" style={muted}>{r.checked ? 'replaces' : 'keeps'}: {r.current}</span>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-2 flex gap-2">
        <button type="button" onClick={() => void save()} disabled={saving} className="btn-primary text-xs px-3 py-1.5">
          {saving ? 'Saving…' : ticked ? `Save village + ${ticked} field${ticked === 1 ? '' : 's'}` : rows?.length ? 'Save village only' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} disabled={saving} className="btn-ghost text-xs px-3 py-1.5">Cancel</button>
      </div>
    </div>
  );
}
