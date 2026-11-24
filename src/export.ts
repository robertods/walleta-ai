import { utils, writeFile } from 'xlsx';
import type { Wallet } from './data';
import { walletBalances } from './money';

export function exportWallet(wallet: Wallet) {
  const { trip, profile, categories, expenses, exchanges } = wallet;
  if (!trip || !profile) return;

  const book = utils.book_new();
  const balance = walletBalances(trip, expenses, exchanges);
  utils.book_append_sheet(book, utils.aoa_to_sheet([
    ['Nombre', profile.name], ['Origen', trip.origin], ['Destino', trip.destination],
    ['Inicio', trip.start], ['Fin', trip.end], ['Presupuesto USD', trip.budgetCents / 100],
    ['Cotización de referencia (JPY/USD)', trip.rate], ['Efectivo USD', balance.usd],
    ['Efectivo JPY', balance.yen],
  ]), 'Resumen');
  utils.book_append_sheet(book, utils.aoa_to_sheet([
    ['Fecha', 'Categoría', 'Moneda', 'Monto', 'Cotización (JPY/USD)', 'Observaciones'],
    ...expenses.map(expense => [
      expense.date, categories.find(category => category.id === expense.categoryId)?.name ?? '',
      expense.currency, expense.currency === 'USD' ? expense.amount / 100 : expense.amount,
      expense.rate, expense.notes,
    ]),
  ]), 'Gastos');
  utils.book_append_sheet(book, utils.aoa_to_sheet([
    ['Fecha', 'JPY recibidos', 'Cotización (JPY/USD)', 'USD entregados'],
    ...exchanges.map(exchange => [exchange.date, exchange.yen, exchange.rate, exchange.usdCents / 100]),
  ]), 'Compras de yenes');
  writeFile(book, 'Walleta.xlsx', { compression: true });
}
