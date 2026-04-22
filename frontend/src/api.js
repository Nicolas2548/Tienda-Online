const BASE = {
  users:   'http://147.182.165.71:8001',
  catalog: 'http://147.182.165.71:8002',
  cart:    'http://147.182.165.71:8003',
  orders:  'http://147.182.165.71:8004',
  payments:'http://147.182.165.71:8005',
};

function getToken() {
  return localStorage.getItem('token');
}

async function req(base, path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE[base]}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Error desconocido' }));
    throw new Error(err.detail || 'Error en la solicitud');
  }
  if (res.status === 204) return null;
  return res.json();
}

// AUTH
export const authAPI = {
  register: (data) => req('users', '/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (email, password) => {
    const body = new URLSearchParams({ username: email, password });
    return fetch(`${BASE.users}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    }).then(async r => {
      if (!r.ok) { const e = await r.json(); throw new Error(e.detail); }
      return r.json();
    });
  },
  me: () => req('users', '/me'),
};

// CATALOG
export const catalogAPI = {
  products: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return req('catalog', `/products${qs ? '?' + qs : ''}`);
  },
  product: (id) => req('catalog', `/products/${id}`),
  categories: () => req('catalog', '/categories'),
};

// CART
export const cartAPI = {
  get: () => req('cart', '/cart'),
  add: (product_id, quantity = 1) => req('cart', '/cart/items', { method: 'POST', body: JSON.stringify({ product_id, quantity }) }),
  update: (item_id, quantity) => req('cart', `/cart/items/${item_id}`, { method: 'PUT', body: JSON.stringify({ quantity }) }),
  remove: (item_id) => req('cart', `/cart/items/${item_id}`, { method: 'DELETE' }),
  clear: () => req('cart', '/cart', { method: 'DELETE' }),
};

// ORDERS
export const ordersAPI = {
  create: (items) => req('orders', '/orders', { method: 'POST', body: JSON.stringify({ items }) }),
  list: () => req('orders', '/orders'),
  get: (id) => req('orders', `/orders/${id}`),
};

// PAYMENTS
export const paymentsAPI = {
  process: (order_id, method = 'card') => req('payments', '/payments/process', { method: 'POST', body: JSON.stringify({ order_id, method }) }),
};
