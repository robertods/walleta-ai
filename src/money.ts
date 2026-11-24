import type { Currency, Exchange, Expense, Trip } from './data';

const dayMs = 86_400_000;

export function localDate(timeZone = 'Asia/Tokyo') {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts();
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value).join('-');
}

export function daysBetween(start: string, end: string) {
  return (Date.parse(end) - Date.parse(start)) / dayMs;
}

export function money(value: number, currency: Currency | 'ARS') {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })
    .format(value);
}

export function priceEquivalents(price: number, currency: Currency, rates: Pick<Trip, 'rate' | 'arsPerUsd'>) {
  const usd = currency === 'JPY' ? price / rates.rate : price;
  const yen = currency === 'USD' ? price * rates.rate : price;
  const ars = rates.arsPerUsd === undefined ? undefined : usd * rates.arsPerUsd;
  return { usd, yen, ars };
}

export function formatDate(date: string) {
  return date.split('-').reverse().join('/');
}

export function expenseValue(expense: Expense, currency: Currency) {
  if (expense.currency === 'USD') {
    const usd = expense.amount / 100;
    return currency === 'USD' ? usd : usd * expense.rate;
  }
  return currency === 'JPY' ? expense.amount : expense.amount / expense.rate;
}

export function walletBalances(trip: Trip, expenses: Expense[], exchanges: Exchange[]) {
  let usdCents = trip.budgetCents;
  let yen = 0;
  for (const exchange of exchanges) {
    usdCents -= exchange.usdCents;
    yen += exchange.yen;
  }
  for (const expense of expenses) {
    if (expense.currency === 'USD') usdCents -= expense.amount;
    else yen -= expense.amount;
  }
  return { usd: usdCents / 100, yen };
}

export function estimate(balance: ReturnType<typeof walletBalances>, rate: number, currency: Currency) {
  return currency === 'JPY' ? balance.yen + balance.usd * rate : balance.usd + balance.yen / rate;
}

export function minorUnits(amount: number, currency: Currency) {
  return currency === 'USD' ? Math.round(amount * 100) : amount;
}
