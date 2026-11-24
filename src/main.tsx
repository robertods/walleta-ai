import { render, type JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  readWallet, remove, removeCategory, saveCategory, saveExchange, saveExpense, saveTrip,
  type Category, type Currency, type Exchange, type Expense, type Trip, type Wallet,
} from './data';
import { daysBetween, estimate, expenseValue, formatDate, localDate, minorUnits, money, priceEquivalents, walletBalances } from './money';
import { InviteGate } from './invite';
import { UpdateNotice } from './update';
import './style.css';

type SubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];
type Mutation = (action: () => Promise<unknown>, destination?: string) => Promise<void>;

function formData(event: SubmitEvent) {
  event.preventDefault();
  return new FormData(event.currentTarget);
}
function value(form: FormData, key: string) {
  return String(form.get(key) ?? '').trim();
}
function numberValue(form: FormData, key: string) {
  return Number(value(form, key));
}
function go(path: string) {
  window.location.hash = path;
}

function Field({ label, ...props }: JSX.IntrinsicElements['input'] & { label: string }) {
  return <label class="field">{label}<input required {...props} /></label>;
}
type AmountProps = Pick<JSX.IntrinsicElements['input'],
  'name' | 'value' | 'defaultValue' | 'onInput' | 'min' | 'step' | 'required' | 'inputMode'>;

function Amount({ label, ...props }: AmountProps & { label: string }) {
  return <label class="field">{label}<input type="number" inputMode="decimal" min="0.01" step="0.01"
    required {...props} /></label>;
}
function Title({ children }: { children: string }) {
  return <div class="page-title"><a href="#/" class="back">Inicio</a><h1>{children}</h1></div>;
}
function tripDate(trip: Trip) {
  const today = localDate(trip.timeZone);
  return today < trip.start ? trip.start : today > trip.end ? trip.end : today;
}

function TripForm({ wallet, mutate }: { wallet: Wallet; mutate: Mutation }) {
  const { trip, profile } = wallet;
  const [start, setStart] = useState(trip?.start ?? localDate());
  const [error, setError] = useState('');
  function submit(event: SubmitEvent) {
    const data = formData(event);
    const name = value(data, 'name');
    const budgetCents = minorUnits(numberValue(data, 'budget'), 'USD');
    const rate = numberValue(data, 'rate');
    const arsRateInput = value(data, 'arsPerUsd');
    const arsPerUsd = arsRateInput ? Number(arsRateInput) : undefined;
    const end = value(data, 'end');
    if (!name || end < start || !Number.isSafeInteger(budgetCents) || budgetCents < 1 ||
      !Number.isFinite(rate) || rate <= 0 ||
      (arsPerUsd !== undefined && (!Number.isFinite(arsPerUsd) || arsPerUsd <= 0))) {
      setError('Revisá el nombre, las fechas, el presupuesto y las cotizaciones.');
      return;
    }
    setError('');
    void mutate(() => saveTrip({ id: 'local', name }, {
      id: 'active', start, end, budgetCents, rate, arsPerUsd,
      origin: 'Argentina', destination: 'Japón', timeZone: 'Asia/Tokyo',
      baseCurrency: 'USD', localCurrency: 'JPY',
    }, !trip), '/');
  }

  return <form class="panel form" onSubmit={submit}>
    <Field label="Tu nombre" name="name" defaultValue={profile?.name} maxLength={80} autoComplete="given-name" />
    <div class="cols">
      <Field label="Inicio" name="start" type="date" value={start}
        onInput={event => setStart(event.currentTarget.value)} />
      <Field label="Fin" name="end" type="date" min={start} defaultValue={trip?.end ?? start} />
    </div>
    <Amount label="Presupuesto inicial (USD)" name="budget" defaultValue={trip && trip.budgetCents / 100} />
    <Amount label="Cotización de referencia (JPY por USD)" name="rate" step="any" defaultValue={trip?.rate} />
    <Amount label="Cotización en pesos argentinos (ARS por USD)" name="arsPerUsd"
      step="any" required={false} defaultValue={trip?.arsPerUsd} />
    {error && <p role="alert" class="error">{error}</p>}
    <button class="primary">{trip ? 'Guardar configuración' : 'Crear viaje'}</button>
  </form>;
}

function Home({ wallet, trip }: { wallet: Wallet; trip: Trip }) {
  const [period, setPeriod] = useState<'trip' | 'today'>('trip');
  const [currency, setCurrency] = useState<Currency>('JPY');
  const today = localDate(trip.timeZone);
  const onTrip = today >= trip.start && today <= trip.end;
  const balance = walletBalances(trip, wallet.expenses, wallet.exchanges);
  const expenses = wallet.expenses.filter(expense => expense.date >= trip.start && expense.date <= trip.end);
  const shown = period === 'trip' ? expenses : expenses.filter(expense => expense.date === today);
  const spent = shown.reduce((sum, expense) => sum + expenseValue(expense, currency), 0);
  const daysLeft = onTrip ? daysBetween(today, trip.end) + 1 : 0;
  const opening = walletBalances(trip, wallet.expenses.filter(expense => expense.date < today),
    wallet.exchanges.filter(exchange => exchange.date < today));
  const daily = daysLeft ? estimate(opening, trip.rate, currency) / daysLeft : undefined;
  const available = period === 'trip' ? estimate(balance, trip.rate, currency)
    : daily === undefined ? undefined : daily - spent;

  return <>
    <div class="home-title">
      <div><p class="eyebrow">Argentina · Japón</p><h1>Hola, {wallet.profile?.name}</h1>
        <p class="muted">{formatDate(trip.start)} – {formatDate(trip.end)}</p></div>
      <a class="button secondary settings" href="#/config">Configuración</a>
    </div>
    <div class="filter-bar">
      <div class="segments" aria-label="Período">
        <button aria-pressed={period === 'trip'} onClick={() => setPeriod('trip')}>Todo el viaje</button>
        <button aria-pressed={period === 'today'} onClick={() => setPeriod('today')}>Hoy</button>
      </div>
      <div class="segments" aria-label="Moneda">
        <button aria-pressed={currency === 'JPY'} onClick={() => setCurrency('JPY')}>JPY</button>
        <button aria-pressed={currency === 'USD'} onClick={() => setCurrency('USD')}>USD</button>
      </div>
    </div>
    <section class="hero">
      <p>{period === 'trip' ? 'Disponible estimado' : 'Disponible hoy'} · {currency}</p>
      <strong>{available === undefined ? '—' : money(available, currency)}</strong>
      <div class="hero-detail">
        <span>Gastado <b>{money(spent, currency)}</b></span>
        {period === 'today' && daily !== undefined && <span>Asignado <b>{money(daily, currency)}</b></span>}
        {period === 'today' && !onTrip && <span>Fuera del período del viaje</span>}
      </div>
    </section>
    <div class="cols cash">
      <div class="panel"><span>Efectivo en yenes</span><strong>{money(balance.yen, 'JPY')}</strong></div>
      <div class="panel"><span>Efectivo en USD</span><strong>{money(balance.usd, 'USD')}</strong></div>
    </div>
    <div class="section-heading"><h2>Categorías</h2><a href="#/historial">Ver historial</a></div>
    <ul class="panel ledger">
      {wallet.categories.filter(category => !category.archived ||
        shown.some(expense => expense.categoryId === category.id)).map(category => {
        const categorySpent = shown.filter(expense => expense.categoryId === category.id)
          .reduce((sum, expense) => sum + expenseValue(expense, currency), 0);
        const categoryBeforeToday = expenses.filter(expense => expense.categoryId === category.id && expense.date < today)
          .reduce((sum, expense) => sum + expenseValue(expense, currency), 0);
        const limit = category.limitCents === undefined ? undefined
          : category.limitCents / 100 * (currency === 'JPY' ? trip.rate : 1);
        const dailyLimit = limit !== undefined && daysLeft > 0
          ? Math.max(0, limit - categoryBeforeToday) / daysLeft : undefined;
        const periodLimit = period === 'trip' ? limit : dailyLimit;
        const remaining = periodLimit === undefined ? undefined : periodLimit - categorySpent;
        return <li key={category.id}>
          <span class="category-mark">{category.name.slice(0, 1).toUpperCase()}</span>
          <div class="row-main"><b>{category.name}</b>
            {period === 'today' && dailyLimit !== undefined &&
              <small>Máximo de hoy · {money(dailyLimit, currency)}</small>}
            {remaining !== undefined && <small>
              {remaining < 0 ? 'Excedido' : period === 'today' ? 'Quedan hoy' : 'Quedan'}
              {' '}{money(Math.abs(remaining), currency)}
            </small>}</div>
          <b>{money(categorySpent, currency)}</b>
          {!category.archived && <a class="button square" href={'#/gasto?category=' + encodeURIComponent(category.id)}
            aria-label={'Cargar gasto en ' + category.name}>+</a>}
        </li>;
      })}
    </ul>
    <nav class="bottom" aria-label="Acciones del viaje">
      <a href="#/calculadora"><span aria-hidden="true">÷</span>Calculadora</a>
      <a href="#/cambio"><span aria-hidden="true">¥</span>Comprar yenes</a>
      <a href="#/gasto" class="new"><span aria-hidden="true">+</span>Nuevo gasto</a>
    </nav>
  </>;
}

function ExpenseForm({ wallet, trip, expense, selected, mutate }: {
  wallet: Wallet; trip: Trip; expense?: Expense; selected?: string; mutate: Mutation;
}) {
  const [currency, setCurrency] = useState<Currency>(expense?.currency ?? 'JPY');
  const [categoryId, setCategoryId] = useState(expense?.categoryId ?? selected ?? '');
  const [error, setError] = useState('');
  const categories = wallet.categories.filter(item => !item.archived || item.id === expense?.categoryId);
  function submit(event: SubmitEvent) {
    const data = formData(event);
    const amount = minorUnits(numberValue(data, 'amount'), currency);
    const date = value(data, 'date');
    const categoryId = value(data, 'category');
    if (!Number.isSafeInteger(amount) || amount <= 0 || !categories.some(item => item.id === categoryId) ||
      date < trip.start || date > trip.end) {
      setError('Revisá el monto, la categoría y la fecha del gasto.');
      return;
    }
    void mutate(() => saveExpense({
      id: expense?.id ?? crypto.randomUUID(), date, currency, amount, categoryId,
      notes: value(data, 'notes'), rate: expense?.rate ?? trip.rate,
    }), expense ? '/historial' : '/');
  }
  return <>
    <Title>{expense ? 'Editar gasto' : 'Nuevo gasto'}</Title>
    <form class="panel form" onSubmit={submit}>
      {!expense && <div class="scan">
        <button type="button" disabled aria-describedby="scan-status">Escanear ticket</button>
        <small id="scan-status">Disponible en una próxima versión</small>
      </div>}
      <div class="cols">
        <Amount label="Monto" name="amount" min={currency === 'JPY' ? 1 : 0.01}
          step={currency === 'JPY' ? 1 : 0.01} inputMode={currency === 'JPY' ? 'numeric' : 'decimal'}
          defaultValue={expense && (expense.currency === 'USD' ? expense.amount / 100 : expense.amount)} />
        <label class="field">Moneda<select value={currency}
          onChange={event => setCurrency(event.currentTarget.value === 'USD' ? 'USD' : 'JPY')}>
          <option value="JPY">JPY</option><option value="USD">USD</option>
        </select></label>
      </div>
      <Field label="Fecha" name="date" type="date" min={trip.start} max={trip.end}
        defaultValue={expense?.date ?? tripDate(trip)} />
      <label class="field">Categoría<select name="category" required
        value={categoryId} onChange={event => setCategoryId(event.currentTarget.value)}>
        <option value="">Elegí una categoría</option>
        {categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
      <label class="field">Observaciones<textarea name="notes" defaultValue={expense?.notes} maxLength={500} /></label>
      {error && <p role="alert" class="error">{error}</p>}
      <button class="primary">Guardar gasto</button>
    </form>
  </>;
}

function ExchangeForm({ trip, exchange, mutate }: { trip: Trip; exchange?: Exchange; mutate: Mutation }) {
  const [yen, setYen] = useState(String(exchange?.yen ?? ''));
  const [rate, setRate] = useState(String(exchange?.rate ?? ''));
  const [override, setOverride] = useState<string | undefined>(exchange && String(exchange.usdCents / 100));
  const calculated = Number(rate) > 0 ? minorUnits(Number(yen) / Number(rate), 'USD') : 0;
  const [error, setError] = useState('');
  function submit(event: SubmitEvent) {
    const data = formData(event);
    const date = value(data, 'date');
    const usdCents = minorUnits(numberValue(data, 'usd'), 'USD');
    if (!Number.isSafeInteger(usdCents) || usdCents <= 0 || !Number.isSafeInteger(Number(yen)) ||
      Number(yen) <= 0 || !Number.isFinite(Number(rate)) || Number(rate) <= 0) {
      setError('Revisá los yenes recibidos, la cotización y los dólares entregados.');
      return;
    }
    void mutate(() => saveExchange({
      id: exchange?.id ?? crypto.randomUUID(), date, usdCents, yen: Number(yen), rate: Number(rate),
    }), exchange ? '/historial?tipo=cambios' : '/');
  }
  return <>
    <Title>{exchange ? 'Editar compra' : 'Comprar yenes'}</Title>
    <form class="panel form" onSubmit={submit}>
      <Amount label="Yenes recibidos (JPY)" min="1" step="1" inputMode="numeric" value={yen}
        onInput={event => { setYen(event.currentTarget.value); setOverride(undefined); }} />
      <Amount label="Cotización de la operación (JPY por USD)" value={rate} step="any"
        onInput={event => { setRate(event.currentTarget.value); setOverride(undefined); }} />
      <Amount label="Dólares entregados (USD)" name="usd"
        value={override ?? (calculated > 0 && Number.isSafeInteger(calculated) ? (calculated / 100).toFixed(2) : '')}
        onInput={event => setOverride(event.currentTarget.value)} />
      <p class="muted">Ajustá los dólares entregados si hubo una comisión o un redondeo.</p>
      <Field label="Fecha" name="date" type="date" defaultValue={exchange?.date ?? localDate(trip.timeZone)} />
      {error && <p role="alert" class="error">{error}</p>}
      <button class="primary">Guardar compra</button>
    </form>
    <p><a href="#/historial?tipo=cambios">Ver compras de yenes</a></p>
  </>;
}

function Calculator({ trip }: { trip: Trip }) {
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('JPY');
  const target = currency === 'JPY' ? 'USD' : 'JPY';
  const price = Number(amount);
  const equivalents = priceEquivalents(price, currency, trip);
  const converted = target === 'USD' ? equivalents.usd : equivalents.yen;
  const hasPrice = amount !== '' && Number.isFinite(price) && price >= 0;
  const show = (value: number | undefined, unit: Currency | 'ARS') =>
    hasPrice && value !== undefined && Number.isFinite(value) ? money(value, unit) : '—';
  const rateFormat = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 10 });
  return <>
    <Title>Calculadora</Title>
    <section class="panel form">
      <div class="cols">
        <Amount label="Precio" value={amount} min="0" step="any" required={false}
          onInput={event => setAmount(event.currentTarget.value)} />
        <label class="field">Moneda<select value={currency}
          onChange={event => setCurrency(event.currentTarget.value === 'USD' ? 'USD' : 'JPY')}>
          <option value="JPY">JPY</option><option value="USD">USD</option>
        </select></label>
      </div>
      <div class="calculation"><span>Equivalente en {target}</span>
        <output>{show(converted, target)}</output></div>
      <div class="calculation"><span>Equivalente en ARS</span>
        <output>{show(equivalents.ars, 'ARS')}</output></div>
      <p class="muted">1 USD = {rateFormat.format(trip.rate)} JPY
        {trip.arsPerUsd !== undefined && <> · {rateFormat.format(trip.arsPerUsd)} ARS</>}</p>
      {trip.arsPerUsd === undefined && <p><a href="#/config">Configurá la cotización en ARS para ver el equivalente.</a></p>}
    </section>
  </>;
}

function History({ wallet, exchanges, mutate }: { wallet: Wallet; exchanges: boolean; mutate: Mutation }) {
  const [category, setCategory] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const matchesDate = (date: string) => (!start || date >= start) && (!end || date <= end);
  const expenses = wallet.expenses.filter(item => matchesDate(item.date) && (!category || item.categoryId === category));
  const changes = wallet.exchanges.filter(item => matchesDate(item.date));
  async function exportExcel() {
    setExporting(true);
    setError('');
    try {
      const { exportWallet } = await import('./export');
      exportWallet(wallet);
    } catch {
      setError('No pudimos generar el archivo Excel.');
    } finally {
      setExporting(false);
    }
  }
  return <>
    <Title>Historial</Title>
    <div class="history-tools">
      <nav class="segments" aria-label="Tipo de movimiento">
        <a href="#/historial" aria-current={!exchanges ? 'page' : undefined}>Gastos</a>
        <a href="#/historial?tipo=cambios" aria-current={exchanges ? 'page' : undefined}>Compras de yenes</a>
      </nav>
      <button class="secondary" disabled={exporting} onClick={() => void exportExcel()}>
        {exporting ? 'Exportando…' : 'Exportar Excel'}
      </button>
    </div>
    {error && <p role="alert" class="error">{error}</p>}
    <div class="panel form">
      <div class="cols">
        <Field label="Desde" type="date" required={false} value={start} max={end || undefined}
          onInput={event => setStart(event.currentTarget.value)} />
        <Field label="Hasta" type="date" required={false} value={end} min={start || undefined}
          onInput={event => setEnd(event.currentTarget.value)} />
      </div>
      {!exchanges && <label class="field">Categoría<select value={category}
        onChange={event => setCategory(event.currentTarget.value)}>
        <option value="">Todas</option>
        {wallet.categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>}
    </div>
    <ul class="panel ledger history">
      {exchanges ? changes.map(item => <li key={item.id}>
        <div class="row-main"><b>{money(item.yen, 'JPY')}</b>
          <small>{formatDate(item.date)} · {money(item.usdCents / 100, 'USD')} USD</small></div>
        <a href={'#/cambio?id=' + item.id}>Editar</a>
        <button type="button" class="text danger" onClick={() => {
          if (confirm('¿Borrar esta compra de yenes?')) void mutate(() => remove('exchanges', item.id));
        }}>Borrar</button>
      </li>) : expenses.map(item => <li key={item.id}>
        <div class="row-main"><b>{wallet.categories.find(entry => entry.id === item.categoryId)?.name ?? 'Categoría'}</b>
          <small>{formatDate(item.date)} · {money(item.currency === 'USD' ? item.amount / 100 : item.amount, item.currency)} {item.currency}</small>
          {item.notes && <small>{item.notes}</small>}</div>
        <a href={'#/gasto?id=' + item.id}>Editar</a>
        <button type="button" class="text danger" onClick={() => {
          if (confirm('¿Borrar este gasto?')) void mutate(() => remove('expenses', item.id));
        }}>Borrar</button>
      </li>)}
      {(exchanges ? changes.length : expenses.length) === 0 && <li>Sin movimientos para estos filtros.</li>}
    </ul>
  </>;
}

function CategoryForm({ category, mutate }: { category?: Category; mutate: Mutation }) {
  const archived = category?.archived;
  function submit(event: SubmitEvent) {
    const data = formData(event);
    const element = event.currentTarget;
    const name = value(data, 'name');
    const limit = value(data, 'limit');
    const limitCents = limit ? minorUnits(Number(limit), 'USD') : undefined;
    if (!name || (limitCents !== undefined && (!Number.isSafeInteger(limitCents) || limitCents < 0))) return;
    void mutate(async () => {
      await saveCategory({ id: category?.id ?? crypto.randomUUID(), name, limitCents, archived });
      if (!category) element.reset();
    });
  }
  return <form class="category-form" onSubmit={submit}>
    <Field label="Nombre" name="name" defaultValue={category?.name} maxLength={40} />
    <Amount label="Límite del viaje (USD)" name="limit" min="0" required={false}
      defaultValue={category?.limitCents === undefined ? undefined : category.limitCents / 100} />
    <div class="category-tools">
      {archived && <small>Archivada</small>}
      <button class="secondary">{category ? 'Guardar' : 'Agregar categoría'}</button>
      {category && <button type="button" class="text" onClick={() => {
        if (archived) void mutate(() => saveCategory({ ...category, archived: false }));
        else if (confirm('¿Quitar esta categoría de los gastos nuevos?')) void mutate(() => removeCategory(category));
      }}>{archived ? 'Reactivar' : 'Quitar'}</button>}
    </div>
  </form>;
}

function App() {
  const [wallet, setWallet] = useState<Wallet>();
  const [route, setRoute] = useState(location.hash.slice(1) || '/');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  useEffect(() => {
    function onHash() {
      setRoute(location.hash.slice(1) || '/');
      setError('');
      window.scrollTo(0, 0);
    }
    window.addEventListener('hashchange', onHash);
    readWallet().then(setWallet).catch(() => setError('No pudimos abrir los datos locales. Recargá para reintentar.'));
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const mutate: Mutation = async (action, destination) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
      setWallet(await readWallet());
      if (destination) go(destination);
    } catch {
      setError('No pudimos completar la operación. Verificá el almacenamiento del navegador e intentá de nuevo.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  const [path, query] = route.split('?');
  const params = new URLSearchParams(query);
  const id = params.get('id');
  const trip = wallet?.trip;
  let page;
  if (!wallet) page = !error && <p role="status">Abriendo Walleta…</p>;
  else if (!trip) page = <>
    <div class="page-title"><p class="eyebrow">Argentina · Japón</p><h1>Prepará tu viaje</h1></div>
    <TripForm wallet={wallet} mutate={mutate} />
  </>;
  else if (path === '/config') page = <>
    <Title>Configuración</Title>
    <TripForm wallet={wallet} mutate={mutate} />
    <h2>Categorías</h2>
    <section class="panel category-list">
      {wallet.categories.map(item => <CategoryForm key={item.id} category={item} mutate={mutate} />)}
      <CategoryForm mutate={mutate} />
    </section>
  </>;
  else if (path === '/gasto') {
    const expense = wallet.expenses.find(item => item.id === id);
    page = id && !expense ? <><Title>Gasto</Title><p>Ese gasto ya no existe.</p></>
      : <ExpenseForm key={route} wallet={wallet} trip={trip} expense={expense}
        selected={params.get('category') ?? undefined} mutate={mutate} />;
  } else if (path === '/cambio') {
    const exchange = wallet.exchanges.find(item => item.id === id);
    page = id && !exchange ? <><Title>Compra de yenes</Title><p>Esa compra ya no existe.</p></>
      : <ExchangeForm key={route} trip={trip} exchange={exchange} mutate={mutate} />;
  } else if (path === '/historial') page = <History wallet={wallet} exchanges={params.get('tipo') === 'cambios'} mutate={mutate} />;
  else if (path === '/calculadora') page = <Calculator trip={trip} />;
  else page = <Home wallet={wallet} trip={trip} />;

  return <>
    <header class="top"><div><a href="#/" class="brand">
      <img src={import.meta.env.BASE_URL + 'icon-192.png'} width="30" height="30" alt="" />
      Walleta
    </a>
      {trip && <span class="top-trip">Viaje a Japón</span>}</div></header>
    <main aria-busy={busy}>{error && <p class="error panel" role="alert">{error}</p>}
      {busy && <p class="saving" role="status">Guardando…</p>}{page}</main>
  </>;
}

render(<>
  <InviteGate><App /></InviteGate>
  {import.meta.env.PROD && 'serviceWorker' in navigator && <UpdateNotice />}
</>, document.getElementById('app')!);
