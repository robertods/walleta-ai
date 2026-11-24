import { openDB, type DBSchema } from 'idb';

export type Currency = 'JPY' | 'USD';
export interface Profile { id: 'local'; name: string }
export interface Trip {
  id: 'active';
  origin: string;
  destination: string;
  timeZone: string;
  baseCurrency: 'USD';
  localCurrency: 'JPY';
  start: string;
  end: string;
  budgetCents: number;
  rate: number;
  arsPerUsd?: number;
}
export interface Category { id: string; name: string; archived?: boolean; limitCents?: number }
export interface Expense {
  id: string;
  date: string;
  categoryId: string;
  currency: Currency;
  amount: number;
  rate: number;
  notes: string;
}
export interface Exchange { id: string; date: string; yen: number; rate: number; usdCents: number }
interface WalletaDB extends DBSchema {
  profile: { key: string; value: Profile };
  trips: { key: string; value: Trip };
  categories: { key: string; value: Category };
  expenses: { key: string; value: Expense; indexes: { date: string } };
  exchanges: { key: string; value: Exchange; indexes: { date: string } };
}
export interface Wallet {
  profile?: Profile;
  trip?: Trip;
  categories: Category[];
  expenses: Expense[];
  exchanges: Exchange[];
}

const defaultCategories: Record<string, { name: string; emoji: string }> = {
  '0': { name: 'Comida', emoji: '🍜' },
  '1': { name: 'Ropa', emoji: '👕' },
  '2': { name: 'Chucherías', emoji: '🎁' },
  '3': { name: 'Transporte', emoji: '🚆' },
  '4': { name: 'Hospedaje', emoji: '🏨' },
  '5': { name: 'Entradas', emoji: '🎟️' },
  '6': { name: 'Otros', emoji: '📦' },
};

export function categoryEmoji(id: string) {
  return defaultCategories[id]?.emoji ?? '🏷️';
}
let connection: ReturnType<typeof openDB<WalletaDB>> | undefined;

function database() {
  connection ??= openDB<WalletaDB>('walleta', 1, {
    upgrade(db) {
      db.createObjectStore('profile', { keyPath: 'id' });
      db.createObjectStore('trips', { keyPath: 'id' });
      db.createObjectStore('categories', { keyPath: 'id' });
      db.createObjectStore('expenses', { keyPath: 'id' }).createIndex('date', 'date');
      db.createObjectStore('exchanges', { keyPath: 'id' }).createIndex('date', 'date');
    },
  }).catch((error: unknown) => {
    connection = undefined;
    throw error;
  });
  return connection;
}

export async function readWallet(): Promise<Wallet> {
  const db = await database();
  const tx = db.transaction(['profile', 'trips', 'categories', 'expenses', 'exchanges']);
  const [profile, trip, categories, expenses, exchanges] = await Promise.all([
    tx.objectStore('profile').get('local'),
    tx.objectStore('trips').get('active'),
    tx.objectStore('categories').getAll(),
    tx.objectStore('expenses').index('date').getAll(),
    tx.objectStore('exchanges').index('date').getAll(),
    tx.done,
  ]);
  return { profile, trip, categories, expenses: expenses.reverse(), exchanges: exchanges.reverse() };
}

export async function saveTrip(profile: Profile, trip: Trip, first: boolean) {
  const db = await database();
  const tx = db.transaction(['profile', 'trips', 'categories'], 'readwrite');
  const writes = [tx.objectStore('profile').put(profile), tx.objectStore('trips').put(trip)];
  if (first) {
    Object.entries(defaultCategories).forEach(([id, { name }]) => {
      writes.push(tx.objectStore('categories').put({ id, name }));
    });
  }
  await Promise.all([...writes, tx.done]);
}

export async function saveExpense(expense: Expense) {
  await (await database()).put('expenses', expense);
}
export async function saveExchange(exchange: Exchange) {
  await (await database()).put('exchanges', exchange);
}
export async function saveCategory(category: Category) {
  await (await database()).put('categories', category);
}
export async function remove(store: 'expenses' | 'exchanges', id: string) {
  await (await database()).delete(store, id);
}
export async function removeCategory(category: Category) {
  const db = await database();
  const tx = db.transaction(['expenses', 'categories'], 'readwrite');
  const used = (await tx.objectStore('expenses').getAll()).some(expense => expense.categoryId === category.id);
  const categories = tx.objectStore('categories');
  await Promise.all([
    used ? categories.put({ ...category, archived: true }) : categories.delete(category.id),
    tx.done,
  ]);
}
