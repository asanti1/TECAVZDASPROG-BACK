import { api, setUnauthorizedHandler } from './api.js';
import { RouteMap, legColor } from './map.js';
import { session } from './session.js';
import { DriverSimulator } from './simulator.js';
import { LiveTracking } from './tracking.js';

const POLL_MS = 3000;
const $ = (id) => document.getElementById(id);
const escapeHtml = (text) =>
  String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const short = (id) => id.slice(0, 8);

const state = {
  user: session.get()?.user ?? null,
  branches: [],
  products: [],
  customers: [],
  deliveryPeople: [],
  orders: [],
  trips: [],
  address: null,
  checked: new Set(),
  selectedTripId: null,
};

const map = new RouteMap('map', (latlng) => {
  state.address = { latitude: latlng.lat, longitude: latlng.lng };
  map.setPendingAddress(latlng);
  $('address-hint').textContent = `Dirección marcada: ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
});

function say(message, isError = false) {
  const status = $('status');
  status.textContent = message;
  status.classList.toggle('error', isError);
}

async function guarded(action) {
  try {
    await action();
  } catch (error) {
    say(error.message, true);
  }
}

const branchName = (id) => state.branches.find((b) => b.id === id)?.name ?? short(id);
const personName = (id) => state.deliveryPeople.find((p) => p.id === id)?.name ?? short(id);

function fillSelect(select, items, label) {
  select.innerHTML = items.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(label(item))}</option>`).join('');
}

// "Noroeste 30 · Noreste 10": quién tiene stock de un producto, en el orden de las sucursales.
function stockByBranch(product) {
  const parts = state.branches
    .map((branch) => ({ name: branch.name.replace('Sucursal ', ''), level: product.stock.find((s) => s.branchId === branch.id) }))
    .filter(({ level }) => level && level.quantity > 0)
    .map(({ name, level }) => `${name} ${level.quantity}`);
  return parts.length > 0 ? parts.join(' · ') : 'sin stock';
}

function renderProductStock() {
  const product = state.products.find((p) => p.id === $('product').value);
  $('product-stock').textContent = product ? `Stock: ${stockByBranch(product)}` : '';
}

function renderCatalog() {
  const selectedProduct = $('product').value;
  fillSelect($('customer'), state.customers, (c) => c.name);
  fillSelect($('product'), state.products, (p) => `${p.name} (${stockByBranch(p)})`);
  if (state.products.some((p) => p.id === selectedProduct)) $('product').value = selectedProduct;
  renderProductStock();
  map.showBranches(state.branches);
}

const hasRole = (...roles) => roles.includes(state.user?.role);

function renderMyOrders() {
  if (!hasRole('CUSTOMER')) return;
  $('my-orders').innerHTML =
    state.orders.length === 0
      ? '<li class="empty">Todavía no hiciste pedidos.</li>'
      : state.orders
          .map(
            (order) => `<li><div class="row"><strong>Pedido #${short(order.id)}</strong><span class="badge ${order.status}">${escapeHtml(order.status)}</span></div>
              <small>sale de ${escapeHtml(branchName(order.originBranchId))}</small></li>`,
          )
          .join('');
}

function renderPending() {
  const pending = state.orders.filter((o) => o.status === 'pending');
  state.checked = new Set([...state.checked].filter((id) => pending.some((o) => o.id === id)));
  const origin = state.checked.size > 0 ? pending.find((o) => state.checked.has(o.id)).originBranchId : null;

  $('pending-orders').innerHTML =
    pending.length === 0
      ? '<li class="empty">No hay pedidos pendientes.</li>'
      : pending
          .map((order) => {
            const blocked = origin !== null && order.originBranchId !== origin;
            const place = order.deliveryAddress
              ? `Entrega en ${order.deliveryAddress.latitude.toFixed(4)}, ${order.deliveryAddress.longitude.toFixed(4)}`
              : `Sucursal ${branchName(order.destinationBranchId)}`;
            return `<li>
              <label class="row">
                <span><input type="checkbox" data-order="${order.id}" ${state.checked.has(order.id) ? 'checked' : ''} ${blocked ? 'disabled' : ''} />
                  <strong>${escapeHtml(place)}</strong><br />
                  <small>#${short(order.id)} · sale de ${escapeHtml(branchName(order.originBranchId))}</small></span>
              </label>
            </li>`;
          })
          .join('');
  $('create-trip').disabled = state.checked.size === 0;
}

function tripCard(trip) {
  const ready = trip.routesReady;
  const legs = trip.routes
    .map(
      (leg, i) =>
        `<li><span class="dot" style="background:${legColor(i)}"></span>Tramo ${leg.sequenceOrder}: ${leg.distanceKm} km · ${leg.estimatedTimeMin} min</li>`,
    )
    .join('');
  const totalKm = trip.routes.reduce((sum, leg) => sum + leg.distanceKm, 0).toFixed(2);
  const totalMin = trip.routes.reduce((sum, leg) => sum + leg.estimatedTimeMin, 0);
  const algorithm = trip.routes[0]?.algorithmUsed;
  const actions = [];
  if (trip.status === 'planned' && !ready) actions.push(`<button class="secondary" data-action="routes" data-trip="${trip.id}">Reintentar rutas</button>`);
  if (trip.status === 'planned' && ready) actions.push(`<button data-action="start" data-trip="${trip.id}">Salir</button>`);
  if (trip.status === 'in_progress') {
    const running = simulator.isRunning(trip.id);
    actions.push(`<button class="secondary" data-action="simulate" data-trip="${trip.id}">${running ? 'Detener simulación' : 'Simular repartidor'}</button>`);
    actions.push(`<button data-action="complete" data-trip="${trip.id}">Completar</button>`);
  }
  return `<li class="trip ${trip.id === state.selectedTripId ? 'selected' : ''}" data-trip="${trip.id}">
    <div class="row"><strong>Viaje #${short(trip.id)}</strong><span class="badge ${trip.status}">${trip.status}</span></div>
    <small>${escapeHtml(personName(trip.deliveryPersonId))} · ${trip.orderIds.length} pedido(s) · desde ${escapeHtml(branchName(trip.originBranchId))}</small>
    ${ready ? `<ul class="legs">${legs}<li><strong>Total: ${totalKm} km · ${totalMin} min (${escapeHtml(algorithm)})</strong></li></ul>` : '<br /><small>Calculando rutas…</small>'}
    ${actions.length ? `<div class="trip-actions">${actions.join('')}</div>` : ''}
  </li>`;
}

function renderTrips() {
  $('trips').innerHTML = state.trips.length === 0 ? '<li class="empty">Todavía no hay viajes.</li>' : state.trips.map(tripCard).join('');
}

// El admin ve lo pendiente de armar; el cliente, todos sus pedidos.
const ordersOnMap = () => (hasRole('CUSTOMER') ? state.orders : state.orders.filter((o) => o.status === 'pending'));

function renderMap() {
  map.showOrders(ordersOnMap());
  map.showTrip(state.trips.find((t) => t.id === state.selectedTripId));
}

// El seguimiento en vivo se abre con el token, así que solo existe con sesión iniciada.
const tracking = state.user
  ? new LiveTracking(
      (location) => map.showDriver(location.tripId, location),
      (message) => say(`Seguimiento: ${message}`),
    )
  : null;
const simulator = new DriverSimulator((tripId, point) => tracking.report(tripId, point), { onChange: () => renderTrips() });

async function refresh() {
  // Cada rol pide solo lo que el backend le permite ver.
  [state.orders, state.trips] = await Promise.all([
    hasRole('ADMIN', 'CUSTOMER') ? api.orders() : [],
    hasRole('ADMIN', 'DELIVERY_PERSON') ? api.trips() : [],
  ]);
  for (const trip of state.trips) {
    if (trip.status === 'in_progress') tracking.follow(trip.id);
    else {
      simulator.stop(trip.id);
      map.hideDriver(trip.id);
    }
  }
  renderPending();
  renderMyOrders();
  renderTrips();
}

let drawnSignature = '';
function redrawSelectedTripIfChanged() {
  const trip = state.trips.find((t) => t.id === state.selectedTripId);
  const signature = trip ? `${trip.id}:${trip.routes.length}` : '';
  if (signature !== drawnSignature) {
    drawnSignature = signature;
    map.showTrip(trip);
  }
}

$('product').addEventListener('change', renderProductStock);

$('order-form').addEventListener('submit', (event) => {
  event.preventDefault();
  guarded(async () => {
    if (!state.address) throw new Error('Marcá la dirección en el mapa primero.');
    const order = await api.createOrder({
      type: 'CUSTOMER',
      customerId: hasRole('ADMIN') ? $('customer').value : undefined, // al cliente lo identifica su token
      deliveryAddress: state.address,
      items: [{ productId: $('product').value, quantity: Number($('quantity').value) }],
    });
    say(`Pedido #${short(order.id)} creado; sale de ${branchName(order.originBranchId)}.`);
    state.address = null;
    map.clearPendingAddress();
    $('address-hint').textContent = 'Hacé click en el mapa para marcar la dirección de entrega.';
    state.products = await api.products();
    renderCatalog();
    await refresh();
    renderMap();
  });
});

$('pending-orders').addEventListener('change', (event) => {
  const id = event.target.dataset.order;
  if (!id) return;
  if (event.target.checked) state.checked.add(id);
  else state.checked.delete(id);
  renderPending();
});

$('create-trip').addEventListener('click', () => {
  guarded(async () => {
    // El sistema elige al repartidor: uno libre de la sucursal de la que salen los pedidos.
    const trip = await api.createTrip({ orderIds: [...state.checked] });
    state.checked.clear();
    state.selectedTripId = trip.id;
    say(`Viaje #${short(trip.id)} creado. Calculando rutas…`);
    await refresh();
    renderMap();
  });
});

$('trips').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  const card = event.target.closest('li[data-trip]');
  if (button) {
    const id = button.dataset.trip;
    if (button.dataset.action === 'simulate') {
      if (simulator.isRunning(id)) simulator.stop(id);
      else simulator.start(state.trips.find((t) => t.id === id));
      return;
    }
    const actions = { start: api.startTrip, complete: api.completeTrip, routes: api.requestRoutes };
    guarded(async () => {
      await actions[button.dataset.action](id);
      say(button.dataset.action === 'routes' ? 'Pedido de rutas reenviado.' : 'Viaje actualizado.');
      await refresh();
    });
  } else if (card) {
    state.selectedTripId = card.dataset.trip;
    drawnSignature = '';
    renderTrips();
    redrawSelectedTripIfChanged();
  }
});

async function start() {
  const admin = hasRole('ADMIN');
  [state.branches, state.products, state.customers, state.deliveryPeople] = await Promise.all([
    api.branches(),
    api.products(),
    admin ? api.users('CUSTOMER') : [],
    admin ? api.users('DELIVERY_PERSON') : [{ id: state.user.id, name: state.user.name }],
  ]);
  renderCatalog();
  await refresh();
  renderMap();
  setInterval(() => guarded(async () => {
    await refresh();
    map.showOrders(ordersOnMap());
    redrawSelectedTripIfChanged();
  }), POLL_MS);
  say('Listo.');
}

function showSession() {
  document.querySelectorAll('[data-roles]').forEach((element) => {
    element.hidden = !element.dataset.roles.split(' ').includes(state.user?.role);
  });
  $('login-panel').hidden = state.user !== null;
  $('user-bar').hidden = state.user === null;
  if (state.user) $('user-name').textContent = `${state.user.name} · ${ROLE_LABELS[state.user.role]}`;
}

const ROLE_LABELS = { ADMIN: 'Administrador', CUSTOMER: 'Cliente', DELIVERY_PERSON: 'Repartidor' };

// Entrar y salir recargan la página: cada sesión arranca limpia (mapa, socket, simulaciones).
$('login-form').addEventListener('submit', (event) => {
  event.preventDefault();
  guarded(async () => {
    session.save(await api.login($('login-email').value.trim(), $('login-password').value));
    location.reload();
  });
});

function logout() {
  session.clear();
  location.reload();
}
$('logout').addEventListener('click', logout);
setUnauthorizedHandler(logout); // token vencido o inválido

showSession();
if (state.user) guarded(start);
else say('Iniciá sesión para empezar.');
