// Types and pure helpers for the bill tracker. Data lives in localStorage.

export type Recurring = 'monthly' | 'once';
export type Status = 'paid' | 'overdue' | 'soon' | 'upcoming';
export type Filter = 'all' | 'unpaid' | 'paid';

export interface Bill {
  id: string;
  name: string;
  amount: number;
  dueDay: number;
  category: string;
  recurring: Recurring;
  autopay: boolean;
  notes: string;
  month?: string; // one-time bills: the YYYY-MM they belong to
  startMonth?: string; // recurring bills: first YYYY-MM they appear in
}

export type BillInput = Omit<Bill, 'id' | 'month' | 'startMonth'>;

export interface Payment {
  amount: number;
  date: string; // ISO timestamp
}

export interface Data {
  bills: Bill[];
  payments: Record<string, Payment>;
  income: number;
}

export interface BillView extends Bill {
  day: number;
  due: Date;
  payment?: Payment;
  status: Status;
}

export const CATEGORIES = [
  'Housing',
  'Utilities',
  'Phone & Internet',
  'Insurance',
  'Transport',
  'Loans & Credit',
  'Subscriptions',
  'Other',
];

const STORAGE_KEY = 'billTracker.v1';
const DAY_MS = 86_400_000;

export const emptyData = (): Data => ({ bills: [], payments: {}, income: 0 });

export function isData(x: unknown): x is Data {
  return typeof x === 'object' && x !== null && Array.isArray((x as Data).bills);
}

export function loadData(): Data {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (isData(parsed)) {
      return { bills: parsed.bills, payments: parsed.payments ?? {}, income: parsed.income ?? 0 };
    }
  } catch {
    // storage unavailable or corrupt: start fresh
  }
  return emptyData();
}

export function saveData(data: Data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export const monthKey = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, '0')}`;
export const payKey = (billId: string, y: number, m: number) => `${billId}|${monthKey(y, m)}`;
const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function startOfToday() {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

function statusOf(due: Date, payment?: Payment): Status {
  if (payment) return 'paid';
  const diffDays = Math.round((due.getTime() - startOfToday().getTime()) / DAY_MS);
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 3) return 'soon';
  return 'upcoming';
}

export function billsForMonth(data: Data, y: number, m: number): BillView[] {
  const key = monthKey(y, m);
  return data.bills
    .filter((b) => (b.recurring === 'monthly' ? !b.startMonth || b.startMonth <= key : b.month === key))
    .map((b) => {
      const day = Math.min(b.dueDay, daysInMonth(y, m));
      const due = new Date(y, m, day);
      const payment = data.payments[payKey(b.id, y, m)];
      return { ...b, day, due, payment, status: statusOf(due, payment) };
    })
    .sort((a, b) => a.day - b.day || a.name.localeCompare(b.name));
}

const shortDate = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export function statusLabel(b: BillView): string {
  switch (b.status) {
    case 'paid':
      return `Paid ${shortDate(new Date(b.payment!.date))}`;
    case 'overdue':
      return 'Overdue';
    case 'soon': {
      const d = Math.round((b.due.getTime() - startOfToday().getTime()) / DAY_MS);
      return d === 0 ? 'Due today' : d === 1 ? 'Due tomorrow' : `Due in ${d} days`;
    }
    default:
      return 'Upcoming';
  }
}

export { shortDate };

const moneyFmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' });
export const money = (n: number) => moneyFmt.format(n);
