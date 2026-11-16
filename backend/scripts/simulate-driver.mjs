import { WebSocket } from 'ws';

const [tripId, intervalArg] = process.argv.slice(2);
if (!tripId) {
  console.error('Uso: node scripts/simulate-driver.mjs <tripId> [intervaloMs]');
  process.exit(1);
}

const api = process.env.API_URL ?? 'http://localhost:3000';
const intervalMs = Number(intervalArg ?? 400);

const login = await fetch(`${api}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: process.env.EMAIL ?? 'admin@demo.local',
    password: process.env.PASSWORD ?? 'demo1234',
  }),
});

if (!login.ok) {
  console.error(`No se pudo iniciar sesion (${login.status}): ${await login.text()}`);
  process.exit(1);
}
const { accessToken } = await login.json();

const response = await fetch(`${api}/trips/${tripId}/route`, {
  headers: { Authorization: `Bearer ${accessToken}` },
});
if (!response.ok) {
  console.error(`No se pudo leer el viaje (${response.status}): ${await response.text()}`);
  process.exit(1);
}

const { legs } = await response.json();
const points = legs.flatMap((leg) => leg.geometry);
if (points.length === 0) {
  console.error('El viaje todavía no tiene rutas calculadas.');
  process.exit(1);
}

const socket = new WebSocket(`${api.replace(/^http/, 'ws')}/tracking?token=${accessToken}`);
socket.on('message', (raw) => {
  const message = JSON.parse(raw.toString());
  if (message.event === 'error') {
    console.error('Error del servidor:', message.data.message);
    process.exit(1);
  }
});

await new Promise((resolve, reject) => {
  socket.once('open', resolve);
  socket.once('error', reject);
});

console.log(`Enviando ${points.length} posiciones de a una cada ${intervalMs} ms…`);
for (const [index, point] of points.entries()) {
  socket.send(JSON.stringify({ event: 'location', data: { tripId, latitude: point.latitude, longitude: point.longitude } }));
  if (index % 20 === 0) console.log(`  ${index + 1}/${points.length}`);
  await new Promise((resolve) => setTimeout(resolve, intervalMs));
}

socket.close();
console.log('Listo.');
