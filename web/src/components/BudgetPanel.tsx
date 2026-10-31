import { useState, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { CATEGORY_LABELS, fmtDate, inr, todayIso } from '../lib/format';
import type { BudgetCategoryKey, BudgetSummary, Expense, TripDetail } from '../lib/types';
import { Button, Card, EmptyState, Field, Input, Notice, Select, cx } from './ui';

function Bar({ value, max, tone }: { value: number; max: number; tone: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden>
      <div className={cx('h-full rounded-full', tone)} style={{ width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%` }} />
    </div>
  );
}

export function BudgetPanel({ trip, onChange }: { trip: TripDetail; onChange: (patch: Partial<TripDetail>) => void }) {
  const b = trip.budgetSummary;
  const [editing, setEditing] = useState(false);
  const [planned, setPlanned] = useState<Record<string, number>>(() => Object.fromEntries(b.lines.map((l) => [l.category, l.planned])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState<BudgetCategoryKey>('food');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [spentOn, setSpentOn] = useState(todayIso());
  const [adding, setAdding] = useState(false);

  const usedPct = b.budget > 0 ? Math.round((b.actualTotal / b.budget) * 100) : 0;

  async function savePlanned() {
    setBusy(true);
    setError(null);
    try {
      const summary = await api<BudgetSummary>(`/trips/${trip.id}/budget`, { method: 'PUT', body: { lines: Object.entries(planned).map(([category, p]) => ({ category, planned: p })) } });
      onChange({ budgetSummary: summary });
      setEditing(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function addExpense(e: FormEvent) {
    e.preventDefault();
    const value = Math.round(Number(amount));
    if (!value || value < 1) return setError('Enter an amount of at least ₹1.');
    setAdding(true);
    setError(null);
    try {
      const exp = await api<Expense>(`/trips/${trip.id}/expenses`, { method: 'POST', body: { category, amount: value, note: note || undefined, spentOn } });
      const expenses = [exp, ...trip.expenses];
      onChange({ expenses, budgetSummary: recompute(b, expenses) });
      setAmount('');
      setNote('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setAdding(false);
    }
  }

  async function removeExpense(id: string) {
    if (!confirm('Delete this expense?')) return;
    try {
      await api(`/trips/${trip.id}/expenses/${id}`, { method: 'DELETE' });
      const expenses = trip.expenses.filter((x) => x.id !== id);
      onChange({ expenses, budgetSummary: recompute(b, expenses) });
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div className="space-y-6">
      {error && <Notice tone="error">{error}</Notice>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4"><p className="text-xs uppercase tracking-wide text-muted">Your budget</p><p className="mt-1 text-2xl font-semibold">{inr(b.budget)}</p><p className="text-xs text-muted">{inr(Math.round(b.budget / Math.max(1, b.travellers)))} per person</p></Card>
        <Card className="p-4"><p className="text-xs uppercase tracking-wide text-muted">Planned (estimate)</p><p className="mt-1 text-2xl font-semibold">{inr(b.plannedTotal)}</p><p className="text-xs text-muted">{inr(b.perPersonPlanned)} per person</p></Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Spent so far</p>
          <p className="mt-1 text-2xl font-semibold">{inr(b.actualTotal)}</p>
          <p className={cx('text-xs', b.remaining < 0 ? 'text-red-700' : 'text-muted')}>{b.remaining < 0 ? `${inr(-b.remaining)} over budget` : `${inr(b.remaining)} remaining`} · {usedPct}% used</p>
        </Card>
      </div>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Planned vs actual</h3>
          {trip.canEdit && !editing && <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>Adjust plan</Button>}
        </div>
        <ul className="space-y-4">
          {b.lines.map((l) => (
            <li key={l.category}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-medium">{CATEGORY_LABELS[l.category]}</span>
                <span className="flex items-center gap-2 tabular-nums">
                  <span className={cx(l.actual > l.planned && l.planned > 0 ? 'text-red-700' : 'text-ink')}>{inr(l.actual)}</span>
                  <span className="text-muted">of</span>
                  {editing ? (
                    <Input aria-label={`Planned ${CATEGORY_LABELS[l.category]}`} type="number" min={0} className="w-28 py-1" value={planned[l.category] ?? 0} onChange={(e) => setPlanned((p) => ({ ...p, [l.category]: Math.max(0, Number(e.target.value) || 0) }))} />
                  ) : (
                    <span className="text-muted">{inr(l.planned)}</span>
                  )}
                </span>
              </div>
              <div className="mt-1.5"><Bar value={l.actual} max={Math.max(l.planned, l.actual)} tone={l.actual > l.planned && l.planned > 0 ? 'bg-red-500' : 'bg-brand-600'} /></div>
              {l.basis && <p className="mt-1 text-xs text-muted">Estimate basis: {l.basis}</p>}
            </li>
          ))}
        </ul>
        {editing && (
          <div className="mt-4 flex gap-2">
            <Button size="sm" onClick={savePlanned} loading={busy}>Save plan</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        )}
        <p className="mt-4 text-xs text-muted">Planned amounts are estimates, not current prices. Actuals are what your group recorded below.</p>
      </Card>

      <Card className="p-5">
        <h3 className="mb-3 font-semibold">Add an expense</h3>
        <form onSubmit={addExpense} className="grid gap-3 sm:grid-cols-[150px_130px_1fr_150px_auto] sm:items-end">
          <Field label="Category"><Select value={category} onChange={(e) => setCategory(e.target.value as BudgetCategoryKey)}>{Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="Amount (₹)"><Input type="number" min={1} required value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <Field label="Note"><Input maxLength={300} placeholder="e.g. Dinner at the ghat" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <Field label="Date"><Input type="date" value={spentOn} onChange={(e) => setSpentOn(e.target.value)} /></Field>
          <Button type="submit" loading={adding}>Add</Button>
        </form>
      </Card>

      {trip.expenses.length === 0 ? (
        <EmptyState title="No expenses yet">Record spending as you go to see how you're tracking against the plan.</EmptyState>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
              <tr><th className="px-4 py-2.5">Date</th><th className="px-4 py-2.5">Category</th><th className="px-4 py-2.5">Note</th><th className="px-4 py-2.5">By</th><th className="px-4 py-2.5 text-right">Amount</th><th className="w-10" /></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {trip.expenses.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-2.5 whitespace-nowrap">{fmtDate(e.spentOn, { day: 'numeric', month: 'short' })}</td>
                  <td className="px-4 py-2.5">{CATEGORY_LABELS[e.category]}</td>
                  <td className="px-4 py-2.5 text-muted">{e.note}</td>
                  <td className="px-4 py-2.5 text-muted">{e.userName}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{inr(e.amount)}</td>
                  <td className="px-2">{e.canDelete && <button onClick={() => removeExpense(e.id)} aria-label="Delete expense" className="rounded p-1 text-muted hover:text-red-700"><Trash2 className="h-4 w-4" /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

export function recompute(b: BudgetSummary, expenses: Expense[]): BudgetSummary {
  const actual: Record<string, number> = {};
  for (const e of expenses) actual[e.category] = (actual[e.category] ?? 0) + e.amount;
  const lines = b.lines.map((l) => ({ ...l, actual: actual[l.category] ?? 0 }));
  const actualTotal = lines.reduce((s, l) => s + l.actual, 0);
  return { ...b, lines, actualTotal, remaining: b.budget - actualTotal, perPersonActual: Math.round(actualTotal / Math.max(1, b.travellers)) };
}
