'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { Bill, BillInput, CATEGORIES, Recurring } from '@/lib/bills';

interface Props {
  open: boolean;
  bill: Bill | null; // null = adding a new bill
  onSave: (input: BillInput) => void;
  onClose: () => void;
}

const blank = { name: '', amount: '', dueDay: '', category: CATEGORIES[0], recurring: 'monthly' as Recurring, autopay: false, notes: '' };

export default function BillDialog({ open, bill, onSave, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState(blank);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open) {
      setForm(
        bill
          ? { ...bill, amount: String(bill.amount), dueDay: String(bill.dueDay) }
          : blank,
      );
      if (!dlg.open) dlg.showModal();
    } else if (dlg.open) {
      dlg.close();
    }
  }, [open, bill]);

  const set = <K extends keyof typeof blank>(key: K, value: (typeof blank)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  function submit(e: FormEvent) {
    e.preventDefault();
    const amount = Math.round(parseFloat(form.amount) * 100) / 100;
    const dueDay = Math.max(1, Math.min(31, parseInt(form.dueDay, 10)));
    const name = form.name.trim();
    if (!name || isNaN(amount) || isNaN(dueDay)) return;
    onSave({ name, amount, dueDay, category: form.category, recurring: form.recurring, autopay: form.autopay, notes: form.notes.trim() });
  }

  return (
    <dialog ref={ref} onClose={onClose}>
      <form onSubmit={submit}>
        <h3>{bill ? 'Edit bill' : 'Add bill'}</h3>
        <label>
          Name
          <input value={form.name} onChange={(e) => set('name', e.target.value)} required maxLength={60} placeholder="e.g. Electricity" autoFocus />
        </label>
        <div className="row">
          <label>
            Amount
            <input type="number" min="0" step="0.01" required placeholder="0.00" value={form.amount} onChange={(e) => set('amount', e.target.value)} />
          </label>
          <label>
            Due day
            <input type="number" min="1" max="31" required placeholder="1–31" value={form.dueDay} onChange={(e) => set('dueDay', e.target.value)} />
          </label>
        </div>
        <div className="row">
          <label>
            Category
            <select value={form.category} onChange={(e) => set('category', e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Repeats
            <select value={form.recurring} onChange={(e) => set('recurring', e.target.value as Recurring)}>
              <option value="monthly">Every month</option>
              <option value="once">This month only</option>
            </select>
          </label>
        </div>
        <label className="check">
          <input type="checkbox" checked={form.autopay} onChange={(e) => set('autopay', e.target.checked)} /> Autopay
        </label>
        <label>
          Notes
          <input value={form.notes} onChange={(e) => set('notes', e.target.value)} maxLength={120} placeholder="Optional" />
        </label>
        <div className="dialog-actions">
          <button type="button" className="ghost-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-btn">
            Save
          </button>
        </div>
      </form>
    </dialog>
  );
}
