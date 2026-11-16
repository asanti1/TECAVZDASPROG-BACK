import { session } from './session.js';

const WS_URL = (window.LOGISTICS_API ?? 'http://localhost:3000').replace(/^http/, 'ws') + '/tracking';

/** Canal en vivo con el backend: avisa cada vez que un repartidor cambia de posición. */
export class LiveTracking {
  constructor(onLocation, onError = () => {}) {
    this.onLocation = onLocation;
    this.onError = onError;
    this.followed = new Set();
    this.closed = false;
    this.connect();
  }

  /** Deja de reconectar (al cerrar sesión). */
  close() {
    this.closed = true;
    this.socket.close();
  }

  follow(tripId) {
    if (this.followed.has(tripId)) return;
    this.followed.add(tripId);
    this.send({ event: 'subscribe', data: { tripId } });
  }

  connect() {
    this.socket = new WebSocket(`${WS_URL}?token=${encodeURIComponent(session.get()?.accessToken ?? '')}`);
    this.socket.onopen = () => this.followed.forEach((tripId) => this.send({ event: 'subscribe', data: { tripId } }));
    this.socket.onmessage = (message) => {
      const { event, data } = JSON.parse(message.data);
      if (event === 'location') this.onLocation(data);
      if (event === 'error') this.onError(data.message);
      if (event === 'subscribed' && data.lastLocation) this.onLocation(data.lastLocation);
    };
    this.socket.onclose = () => {
      if (!this.closed) setTimeout(() => this.connect(), 2000);
    };
  }

  /** Informa la posición del repartidor (lo que haría su app). */
  report(tripId, point) {
    this.send({ event: 'location', data: { tripId, latitude: point.latitude, longitude: point.longitude } });
  }

  send(message) {
    if (this.socket.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }
}
