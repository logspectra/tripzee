import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import type { ItemKind, ItineraryItem } from '../lib/types';
import { addDays, fmtDate } from '../lib/format';
import { KIND_META, groupByDay } from './Itinerary';
import { Button, Input, Notice, Select, Textarea } from './ui';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function ItineraryEditor({ items, days, startDate, saving, error, onSave, onCancel }: {
  items: ItineraryItem[];
  days: number;
  startDate: string;
  saving: boolean;
  error?: string | null;
  onSave: (items: ItineraryItem[]) => void;
  onCancel: () => void;
}) {
  const [byDay, setByDay] = useState(() => groupByDay(items.map((i) => ({ ...i })), days));
  const [localError, setLocalError] = useState<string | null>(null);

  const update = (d: number, k: number, patch: Partial<ItineraryItem>) =>
    setByDay((all) => all.map((list, di) => (di === d ? list.map((it, ki) => (ki === k ? { ...it, ...patch } : it)) : list)));
  const move = (d: number, k: number, dir: -1 | 1) =>
    setByDay((all) => all.map((list, di) => {
      if (di !== d) return list;
      const next = [...list];
      const j = k + dir;
      if (j < 0 || j >= next.length) return list;
      [next[k], next[j]] = [next[j], next[k]];
      return next;
    }));
  const remove = (d: number, k: number) => setByDay((all) => all.map((list, di) => (di === d ? list.filter((_, ki) => ki !== k) : list)));
  const add = (d: number) =>
    setByDay((all) => all.map((list, di) => (di === d ? [...list, { day: d + 1, position: list.length, title: '', kind: 'other' as ItemKind, estCost: 0 }] : list)));

  function submit() {
    const flat = byDay.flatMap((list, d) => list.map((it, k) => ({ ...it, day: d + 1, position: k, title: it.title.trim(), startTime: it.startTime || null, endTime: it.endTime || null })));
    const bad = flat.find((i) => !i.title || (i.startTime && !TIME.test(i.startTime)) || (i.endTime && !TIME.test(i.endTime)) || i.estCost < 0);
    if (bad) return setLocalError(`Check the item on day ${bad.day}: every stop needs a title, times must be HH:MM and costs can't be negative.`);
    setLocalError(null);
    onSave(flat);
  }

  return (
    <div className="space-y-6">
      {(localError || error) && <Notice tone="error">{localError ?? error}</Notice>}
      {byDay.map((list, d) => (
        <section key={d} className="rounded-2xl border border-line p-4">
          <h3 className="mb-3 font-semibold">Day {d + 1} <span className="text-sm font-normal text-muted">· {fmtDate(addDays(startDate, d), { weekday: 'short', day: 'numeric', month: 'short' })}</span></h3>
          <ul className="space-y-3">
            {list.map((it, k) => (
              <li key={it.id ?? `new-${d}-${k}`} className="grid gap-2 rounded-xl bg-slate-50 p-3 md:grid-cols-[90px_90px_1fr_130px_110px_auto]">
                <Input aria-label="Start time" type="time" value={it.startTime ?? ''} onChange={(e) => update(d, k, { startTime: e.target.value })} />
                <Input aria-label="End time" type="time" value={it.endTime ?? ''} onChange={(e) => update(d, k, { endTime: e.target.value })} />
                <Input aria-label="Title" placeholder="What are you doing?" maxLength={200} value={it.title} onChange={(e) => update(d, k, { title: e.target.value, destinationId: it.destinationId, destinationSlug: it.destinationSlug })} />
                <Select aria-label="Type" value={it.kind} onChange={(e) => update(d, k, { kind: e.target.value as ItemKind })}>
                  {(Object.keys(KIND_META) as ItemKind[]).map((kind) => <option key={kind} value={kind}>{KIND_META[kind].label}</option>)}
                </Select>
                <Input aria-label="Estimated cost (₹)" type="number" min={0} placeholder="₹ est." value={it.estCost || ''} onChange={(e) => update(d, k, { estCost: Math.max(0, Number(e.target.value) || 0) })} />
                <div className="flex items-center gap-1">
                  <Button type="button" variant="ghost" size="sm" aria-label="Move up" disabled={k === 0} onClick={() => move(d, k, -1)}><ArrowUp className="h-4 w-4" /></Button>
                  <Button type="button" variant="ghost" size="sm" aria-label="Move down" disabled={k === list.length - 1} onClick={() => move(d, k, 1)}><ArrowDown className="h-4 w-4" /></Button>
                  <Button type="button" variant="ghost" size="sm" aria-label="Remove" onClick={() => remove(d, k)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                </div>
                <Textarea aria-label="Notes" className="min-h-0 md:col-span-6" rows={1} placeholder="Notes (optional)" maxLength={2000} value={it.notes ?? ''} onChange={(e) => update(d, k, { notes: e.target.value })} />
              </li>
            ))}
          </ul>
          <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={() => add(d)}><Plus className="h-4 w-4" /> Add stop</Button>
        </section>
      ))}
      <div className="sticky bottom-4 flex gap-2 rounded-2xl border border-line bg-white/95 p-3 shadow-lg backdrop-blur">
        <Button onClick={submit} loading={saving}>Save itinerary</Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
