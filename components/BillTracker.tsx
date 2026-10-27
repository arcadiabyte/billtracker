'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import BillDialog from './BillDialog';
import {
  Bill,
  BillInput,
  Data,
  Filter,
  billsForMonth,
  isData,
  loadData,
  money,
  monthKey,
  newId,
  payKey,
  saveData,
  shortDate,
  statusLabel,
} from '@/lib/bills';

export default function BillTracker() {
  // null until loaded from localStorage on the client, so server and client render the same
  const [data, setData] = useState<Data | null>(null);
  const [view, setView] = useState({ y: 0, m: 0 });
  const [filter, setFilter] = useState<Filter>('all');
  const [dialog, setDialog] = useState<{ open: boolean; bill: Bill | null }>({ open: false, bill: null });
  const [incomeDraft, setIncomeDraft] = useState<string | null>(null);

  useEffect(() => {
    const now = new Date();
    setView({ y: now.getFullYear(), m: now.getMonth() });
    setData(loadData());
  }, []);

  useEffect(() => {
    if (data) saveData(data);
  }, [data]);

  const items = useMemo(() => (data ? billsForMonth(data, view.y, view.m) : []), [data, view]);

  if (!data) return <p className="loading">Loading…</p>;

  const total = items.reduce((s, b) => s + b.amount, 0);
  const paid = items.reduce((s, b) => s + (b.payment?.amount ?? 0), 0);
  const due = items.filter((b) => !b.payment).reduce((s, b) => s + b.amount, 0);
  const left = data.income - total;
  const paidCount = items.filter((b) => b.payment).length;
  const overdue = items.filter((b) => b.status === 'overdue').length;
  const shown = items.filter((b) => filter === 'all' || (filter === 'paid' ? b.payment : !b.payment));

  const byCategory = Object.entries(
    items.reduce<Record<string, number>>((acc, b) => ({ ...acc, [b.category]: (acc[b.category] ?? 0) + b.amount }), {}),
  ).sort((a, b) => b[1] - a[1]);

  const goMonth = (offset: number) => {
    const d = new Date(view.y, view.m + offset, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() });
  };
  const goToday = () => {
    const t = new Date();
    setView({ y: t.getFullYear(), m: t.getMonth() });
  };

  function saveBill(input: BillInput) {
    const key = monthKey(view.y, view.m);
    setData((d) => {
      if (!d) return d;
      const editing = dialog.bill;
      const bills = editing
        ? d.bills.map((b) =>
            b.id === editing.id ? { ...b, ...input, month: input.recurring === 'once' ? (b.month ?? key) : b.month } : b,
          )
        : [...d.bills, { id: newId(), ...input, month: input.recurring === 'once' ? key : undefined, startMonth: key }];
      return { ...d, bills };
    });
    setDialog({ open: false, bill: null });
  }

  function togglePaid(bill: Bill, checked: boolean) {
    const k = payKey(bill.id, view.y, view.m);
    setData((d) => {
      if (!d) return d;
      const payments = { ...d.payments };
      if (checked) payments[k] = { amount: bill.amount, date: new Date().toISOString() };
      else delete payments[k];
      return { ...d, payments };
    });
  }

  function deleteBill(bill: Bill) {
    if (!confirm(`Delete "${bill.name}"? This removes it from every month, along with its payment history.`)) return;
    setData((d) => {
      if (!d) return d;
      const payments = Object.fromEntries(Object.entries(d.payments).filter(([k]) => !k.startsWith(bill.id + '|')));
      return { ...d, bills: d.bills.filter((b) => b.id !== bill.id), payments };
    });
  }

  function commitIncome() {
    if (incomeDraft === null) return;
    const n = parseFloat(incomeDraft.replace(/[^0-9.]/g, ''));
    setData((d) => d && { ...d, income: isNaN(n) ? 0 : Math.round(n * 100) / 100 });
    setIncomeDraft(null);
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bills-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importBackup(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!isData(parsed)) throw new Error('bad file');
      if (!confirm('Replace your current bills with this backup?')) return;
      setData({ bills: parsed.bills, payments: parsed.payments ?? {}, income: parsed.income ?? 0 });
    } catch {
      alert('That file is not a valid Bill Tracker backup.');
    }
  }

  return (
    <>
      <header className="topbar">
        <h1>Bill Tracker</h1>
        <div className="month-nav">
          <button className="icon-btn" aria-label="Previous month" onClick={() => goMonth(-1)}>
            ‹
          </button>
          <span className="month-label">
            {new Date(view.y, view.m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </span>
          <button className="icon-btn" aria-label="Next month" onClick={() => goMonth(1)}>
            ›
          </button>
          <button className="ghost-btn" onClick={goToday}>
            Today
          </button>
        </div>
      </header>

      <main>
        <section className="summary">
          <div className="card">
            <span className="label">Monthly income</span>
            {incomeDraft === null ? (
              <button className="value link-value" title="Click to edit" onClick={() => setIncomeDraft(data.income ? String(data.income) : '')}>
                {data.income ? money(data.income) : 'Set income'}
              </button>
            ) : (
              <input
                className="income-input"
                autoFocus
                inputMode="decimal"
                placeholder="Take-home pay"
                value={incomeDraft}
                onChange={(e) => setIncomeDraft(e.target.value)}
                onBlur={commitIncome}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitIncome();
                  if (e.key === 'Escape') setIncomeDraft(null);
                }}
              />
            )}
          </div>
          <div className="card">
            <span className="label">Bills this month</span>
            <span className="value">{money(total)}</span>
          </div>
          <div className="card">
            <span className="label">Paid</span>
            <span className="value good">{money(paid)}</span>
          </div>
          <div className="card">
            <span className="label">Still due</span>
            <span className="value warn">{money(due)}</span>
          </div>
          <div className="card">
            <span className="label">Left after bills</span>
            <span className={`value ${!data.income ? '' : left < 0 ? 'bad' : 'good'}`}>{data.income ? money(left) : '—'}</span>
          </div>
        </section>

        <div className="progress" aria-hidden="true">
          <div style={{ width: `${total ? Math.min(100, (paid / total) * 100) : 0}%` }} />
        </div>
        <p className="muted small">
          {items.length > 0 && `${paidCount} of ${items.length} bills paid${overdue ? ` · ${overdue} overdue` : ''}`}
        </p>

        <section className="panel">
          <div className="panel-head">
            <h2>Bills</h2>
            <div className="filters">
              {(['all', 'unpaid', 'paid'] as Filter[]).map((f) => (
                <button key={f} className={`chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                  {f[0].toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            <button className="primary-btn" onClick={() => setDialog({ open: true, bill: null })}>
              + Add bill
            </button>
          </div>

          <ul className="bill-list">
            {shown.map((b) => (
              <li key={b.id} className={`bill ${b.payment ? 'paid' : ''}`}>
                <input type="checkbox" checked={!!b.payment} aria-label={`Mark ${b.name} paid`} onChange={(e) => togglePaid(b, e.target.checked)} />
                <div>
                  <div className="name">{b.name}</div>
                  <div className="meta">
                    <span>Due {shortDate(b.due)}</span>
                    <span>· {b.category}</span>
                    {b.autopay && <span>· Autopay</span>}
                    {b.recurring === 'once' && <span>· One-time</span>}
                    {b.notes && <span>· {b.notes}</span>}
                    <span className={`badge ${b.status}`}>{statusLabel(b)}</span>
                  </div>
                </div>
                <div className="amount">{money(b.amount)}</div>
                <div className="actions">
                  <button onClick={() => setDialog({ open: true, bill: b })}>Edit</button>
                  <button onClick={() => deleteBill(b)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
          {shown.length === 0 && (
            <p className="empty">
              {items.length === 0 ? (
                <>
                  No bills here yet. Click <strong>+ Add bill</strong> to get started.
                </>
              ) : (
                `No ${filter} bills this month.`
              )}
            </p>
          )}
        </section>

        <section className="panel">
          <h2>By category</h2>
          <div className="categories">
            {byCategory.length === 0 ? (
              <p className="muted small" style={{ margin: 0 }}>
                Add bills to see where your money goes.
              </p>
            ) : (
              byCategory.map(([cat, amt]) => (
                <div key={cat} className="cat-row">
                  <span>{cat}</span>
                  <div className="cat-bar">
                    <div style={{ width: `${total ? (amt / total) * 100 : 0}%` }} />
                  </div>
                  <strong>{money(amt)}</strong>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      <footer>
        <span className="muted small">Your data is saved in this browser only.</span>
        <div>
          <button className="ghost-btn" onClick={exportBackup}>
            Export backup
          </button>
          <label className="ghost-btn">
            Import backup
            <input type="file" accept="application/json" hidden onChange={importBackup} />
          </label>
        </div>
      </footer>

      <BillDialog open={dialog.open} bill={dialog.bill} onSave={saveBill} onClose={() => setDialog({ open: false, bill: null })} />
    </>
  );
}
