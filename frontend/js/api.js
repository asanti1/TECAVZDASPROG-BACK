import { session } from './session.js';

const BASE = window.LOGISTICS_API ?? 'http://localhost:3000';

// app.js decide qué hacer cuando el token deja de servir (vuelve al login).
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (handler) => (onUnauthorized = handler);

async function request(method, path, body) {
  const response = await fetch(BASE + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(session.get() ? { Authorization: `Bearer ${session.get().accessToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (response.status === 401 && path !== '/auth/login') onUnauthorized();
  if (!response.ok) {
    const message = Array.isArray(data?.message) ? data.message.join(', ') : data?.message;
    throw new Error(message ?? `Error ${response.status}`);
  }
  return data;
}

export const api = {
  login: (email, password) => request('POST', '/auth/login', { email, password }),
  branches: () => request('GET', '/branches'),
  products: () => request('GET', '/products'),
  users: (role) => request('GET', `/users?role=${role}`),
  orders: () => request('GET', '/orders'),
  createOrder: (order) => request('POST', '/orders', order),
  trips: () => request('GET', '/trips'),
  createTrip: (trip) => request('POST', '/trips', trip),
  startTrip: (id) => request('POST', `/trips/${id}/start`),
  completeTrip: (id) => request('POST', `/trips/${id}/complete`),
  requestRoutes: (id) => request('POST', `/trips/${id}/request-routes`),
};
