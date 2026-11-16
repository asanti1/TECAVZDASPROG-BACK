/** Hace de repartidor: recorre la ruta del viaje y va informando su posición. */
export class DriverSimulator {
  constructor(sendLocation, { intervalMs = 300, onChange = () => {} } = {}) {
    this.sendLocation = sendLocation;
    this.intervalMs = intervalMs;
    this.onChange = onChange;
    this.timers = new Map();
  }

  isRunning(tripId) {
    return this.timers.has(tripId);
  }

  start(trip) {
    if (this.isRunning(trip.id)) return;
    const points = trip.routes.flatMap((leg) => leg.geometry);
    let index = 0;
    const timer = setInterval(() => {
      if (index >= points.length) return this.stop(trip.id);
      this.sendLocation(trip.id, points[index++]);
    }, this.intervalMs);
    this.timers.set(trip.id, timer);
    this.onChange();
  }

  stop(tripId) {
    clearInterval(this.timers.get(tripId));
    if (this.timers.delete(tripId)) this.onChange();
  }
}
