const LEG_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#be185d', '#4d7c0f'];

export const legColor = (index) => LEG_COLORS[index % LEG_COLORS.length];

const toLatLng = (point) => [point.latitude, point.longitude];

/** Todo lo que se dibuja en el mapa. No sabe nada de la API ni de la lista de viajes. */
export class RouteMap {
  constructor(elementId, onClick) {
    this.map = L.map(elementId).setView([-38.7183, -62.2663], 13);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(this.map);
    this.branchLayer = L.layerGroup().addTo(this.map);
    this.orderLayer = L.layerGroup().addTo(this.map);
    this.routeLayer = L.layerGroup().addTo(this.map);
    this.pending = null;
    this.drivers = new Map();
    this.map.on('click', (event) => onClick(event.latlng));
  }

  showBranches(branches) {
    this.branchLayer.clearLayers();
    for (const branch of branches) {
      L.circleMarker(toLatLng(branch.location), {
        radius: 9, color: '#111827', fillColor: '#facc15', fillOpacity: 1, weight: 2,
      }).bindTooltip(branch.name, { permanent: false }).addTo(this.branchLayer);
    }
  }

  showOrders(orders) {
    this.orderLayer.clearLayers();
    for (const order of orders) {
      if (!order.deliveryAddress) continue;
      L.circleMarker(toLatLng(order.deliveryAddress), {
        radius: 5, color: '#92400e', fillColor: '#fb923c', fillOpacity: 0.9, weight: 1,
      }).bindTooltip(`Pedido ${order.id.slice(0, 8)} (${order.status})`).addTo(this.orderLayer);
    }
  }

  setPendingAddress(latlng) {
    if (this.pending) this.pending.remove();
    this.pending = L.marker(latlng).addTo(this.map);
  }

  clearPendingAddress() {
    this.pending?.remove();
    this.pending = null;
  }

  showTrip(trip) {
    this.routeLayer.clearLayers();
    if (!trip || trip.routes.length === 0) return;
    const bounds = [];
    trip.routes.forEach((leg, index) => {
      const points = leg.geometry.map(toLatLng);
      bounds.push(...points);
      L.polyline(points, { color: legColor(index), weight: 5, opacity: 0.85 }).addTo(this.routeLayer);
      L.marker(points[points.length - 1], {
        icon: L.divIcon({
          className: '',
          html: `<div class="stop-number" style="background:${legColor(index)}">${leg.sequenceOrder}</div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        }),
      }).addTo(this.routeLayer);
    });
    this.map.fitBounds(bounds, { padding: [40, 40] });
  }

  showDriver(tripId, point) {
    const latlng = toLatLng(point);
    const existing = this.drivers.get(tripId);
    if (existing) return existing.setLatLng(latlng);
    const marker = L.marker(latlng, {
      zIndexOffset: 1000,
      icon: L.divIcon({ className: '', html: '<div class="stop-number driver">🚚</div>', iconSize: [26, 26], iconAnchor: [13, 13] }),
    }).addTo(this.map);
    this.drivers.set(tripId, marker);
  }

  hideDriver(tripId) {
    this.drivers.get(tripId)?.remove();
    this.drivers.delete(tripId);
  }
}
