/**
 * ============================================================
 *  ApexStore – Supabase Integration Layer
 * ============================================================
 *  Replace the two placeholders below with your actual Supabase
 *  project URL and anon key (found in Project Settings → API).
 *
 *  Once configured, all products, orders, customer registrations
 *  and login records are stored in Supabase instead of
 *  localStorage.  localStorage is kept as a fallback / cache
 *  so the site still works offline.
 * ============================================================
 */

// ─── CONFIG (Edit these two lines) ──────────────────────────
const SUPABASE_URL = 'https://yxxlexapirrmbvmxastj.supabase.co';   // e.g. https://xxxx.supabase.co
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4eGxleGFwaXJybWJ2bXhhc3RqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3OTMzMDcsImV4cCI6MjA5NzM2OTMwN30.rO5UoeXY6TJUIeDseHoIcFYojBh6jferY-Tom9cA3QA';
// ────────────────────────────────────────────────────────────

/** True when the developer has filled in real credentials */
const SUPABASE_CONFIGURED =
  SUPABASE_URL !== 'YOUR_SUPABASE_URL' &&
  SUPABASE_ANON !== 'YOUR_SUPABASE_ANON_KEY';

/* ── Lazy-load the Supabase JS client from CDN ─────────────── */
let _sb = null;

async function getClient() {
  if (_sb) return _sb;
  if (!SUPABASE_CONFIGURED) return null;

  // Load Supabase SDK from CDN if not already present
  if (!window.supabase) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  return _sb;
}

/* ── Helper: silent error logging ──────────────────────────── */
function dbErr(context, error) {
  console.warn(`[Supabase] ${context}:`, error?.message || error);
}

/* ============================================================
   PRODUCTS
   ============================================================ */

/**
 * Fetch all products.
 * @returns {Promise<Array>}
 */
async function db_getProducts() {
  const sb = await getClient();
  if (!sb) return JSON.parse(localStorage.getItem('products')) || [];

  const { data, error } = await sb
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) { dbErr('getProducts', error); return JSON.parse(localStorage.getItem('products')) || []; }

  // Mirror to localStorage as cache
  localStorage.setItem('products', JSON.stringify(data));
  return data;
}

/**
 * Upsert (insert or update) a product.
 * @param {Object} product
 * @returns {Promise<Object|null>}
 */
async function db_upsertProduct(product) {
  const sb = await getClient();

  // Always update local cache
  const local = JSON.parse(localStorage.getItem('products')) || [];
  const idx = local.findIndex(p => p.id === product.id);
  if (idx > -1) local[idx] = product; else local.unshift(product);
  localStorage.setItem('products', JSON.stringify(local));

  if (!sb) return product;

  const { data, error } = await sb
    .from('products')
    .upsert(product, { onConflict: 'id' })
    .select()
    .single();

  if (error) { dbErr('upsertProduct', error); return product; }
  return data;
}

/**
 * Delete a product by id.
 * @param {number|string} id
 */
async function db_deleteProduct(id) {
  // Update local cache
  const local = JSON.parse(localStorage.getItem('products')) || [];
  localStorage.setItem('products', JSON.stringify(local.filter(p => p.id !== id)));

  const sb = await getClient();
  if (!sb) return;

  const { error } = await sb.from('products').delete().eq('id', id);
  if (error) dbErr('deleteProduct', error);
}

/* ============================================================
   ORDERS
   ============================================================ */

/**
 * Fetch all orders.
 * @returns {Promise<Array>}
 */
async function db_getOrders() {
  const sb = await getClient();
  if (!sb) return JSON.parse(localStorage.getItem('orders')) || [];

  const { data, error } = await sb
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) { dbErr('getOrders', error); return JSON.parse(localStorage.getItem('orders')) || []; }

  localStorage.setItem('orders', JSON.stringify(data));
  return data;
}

/**
 * Insert a new order.
 * @param {Object} order
 * @returns {Promise<Object|null>}
 */
async function db_insertOrder(order) {
  // Local cache
  const local = JSON.parse(localStorage.getItem('orders')) || [];
  local.unshift(order);
  localStorage.setItem('orders', JSON.stringify(local));

  const sb = await getClient();
  if (!sb) return order;

  const { data, error } = await sb
    .from('orders')
    .insert(order)
    .select()
    .single();

  if (error) { dbErr('insertOrder', error); return order; }
  return data;
}

/**
 * Update an order's status (and optional timestamps).
 * @param {string} orderId
 * @param {Object} updates  e.g. { status: 'Shipped', shipped_at: '...' }
 */
async function db_updateOrder(orderId, updates) {
  // Local cache
  const local = JSON.parse(localStorage.getItem('orders')) || [];
  const o = local.find(x => x.id === orderId);
  if (o) Object.assign(o, updates);
  localStorage.setItem('orders', JSON.stringify(local));

  const sb = await getClient();
  if (!sb) return;

  const { error } = await sb.from('orders').update(updates).eq('id', orderId);
  if (error) dbErr('updateOrder', error);
}

/**
 * Delete an order by id.
 * @param {string} orderId
 */
async function db_deleteOrder(orderId) {
  const local = JSON.parse(localStorage.getItem('orders')) || [];
  localStorage.setItem('orders', JSON.stringify(local.filter(o => o.id !== orderId)));

  const sb = await getClient();
  if (!sb) return;

  const { error } = await sb.from('orders').delete().eq('id', orderId);
  if (error) dbErr('deleteOrder', error);
}

/* ============================================================
   CUSTOMER REGISTRATIONS
   ============================================================ */

/**
 * Fetch all customer registrations.
 * @returns {Promise<Array>}
 */
async function db_getRegistrations() {
  const sb = await getClient();
  if (!sb) return JSON.parse(localStorage.getItem('customer_registrations')) || [];

  const { data, error } = await sb
    .from('customer_registrations')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) { dbErr('getRegistrations', error); return JSON.parse(localStorage.getItem('customer_registrations')) || []; }

  localStorage.setItem('customer_registrations', JSON.stringify(data));
  return data;
}

/**
 * Save a new customer registration.
 * @param {Object} reg  { name, email, phone, gender, date }
 */
async function db_insertRegistration(reg) {
  const local = JSON.parse(localStorage.getItem('customer_registrations')) || [];
  local.unshift(reg);
  localStorage.setItem('customer_registrations', JSON.stringify(local));

  const sb = await getClient();
  if (!sb) return reg;

  const { data, error } = await sb
    .from('customer_registrations')
    .insert(reg)
    .select()
    .single();

  if (error) { dbErr('insertRegistration', error); return reg; }
  return data;
}

/* ============================================================
   LOGIN RECORDS
   ============================================================ */

/**
 * Fetch all login records.
 * @returns {Promise<Array>}
 */
async function db_getLogins() {
  const sb = await getClient();
  if (!sb) return JSON.parse(localStorage.getItem('user_logins')) || [];

  const { data, error } = await sb
    .from('user_logins')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) { dbErr('getLogins', error); return JSON.parse(localStorage.getItem('user_logins')) || []; }

  localStorage.setItem('user_logins', JSON.stringify(data));
  return data;
}

/**
 * Save a new login record.
 * @param {Object} login  { name, email, picture, time }
 */
async function db_insertLogin(login) {
  const local = JSON.parse(localStorage.getItem('user_logins')) || [];
  local.unshift(login);
  localStorage.setItem('user_logins', JSON.stringify(local));

  const sb = await getClient();
  if (!sb) return login;

  const { data, error } = await sb
    .from('user_logins')
    .insert(login)
    .select()
    .single();

  if (error) { dbErr('insertLogin', error); return login; }
  return data;
}

/* ============================================================
   HERO BANNER  (stored in a single-row settings table)
   ============================================================ */

/**
 * Fetch the hero banner settings.
 * @returns {Promise<Object>}
 */
async function db_getBanner() {
  const fallback = JSON.parse(localStorage.getItem('hero_banner')) || {
    enabled: true,
    title: 'The Minimal Collection',
    description: 'Curated premium essentials for a modern wardrobe.',
    image: 'banner.png'
  };

  const sb = await getClient();
  if (!sb) return fallback;

  const { data, error } = await sb
    .from('settings')
    .select('value')
    .eq('key', 'hero_banner')
    .single();

  if (error || !data) return fallback;

  const parsed = data.value;
  localStorage.setItem('hero_banner', JSON.stringify(parsed));
  return parsed;
}

/**
 * Save hero banner settings.
 * @param {Object} bannerData
 */
async function db_saveBanner(bannerData) {
  localStorage.setItem('hero_banner', JSON.stringify(bannerData));

  const sb = await getClient();
  if (!sb) return;

  const { error } = await sb
    .from('settings')
    .upsert({ key: 'hero_banner', value: bannerData }, { onConflict: 'key' });

  if (error) dbErr('saveBanner', error);
}

/* ============================================================
   BULK ACTIONS
   ============================================================ */

/**
 * Factory reset: delete all products, orders, registrations, logins.
 */
async function db_factoryReset() {
  localStorage.clear();
  const sb = await getClient();
  if (!sb) return;

  // We use filter that always evaluates to true to delete all rows
  await Promise.all([
    sb.from('products').delete().neq('id', -1),
    sb.from('orders').delete().neq('id', 'dummy_order_id'),
    sb.from('customer_registrations').delete().neq('email', 'dummy@dummy.com'),
    sb.from('user_logins').delete().neq('email', 'dummy@dummy.com')
  ]);
}

/**
 * Delete all login records.
 */
async function db_deleteAllLogins() {
  localStorage.removeItem('user_logins');
  const sb = await getClient();
  if (!sb) return;
  
  const { error } = await sb.from('user_logins').delete().neq('email', 'dummy@dummy.com');
  if (error) dbErr('deleteAllLogins', error);
}

/* ── Export as globals so store.js / admin.js can call them ─ */
window.DB = {
  isConfigured: SUPABASE_CONFIGURED,

  // Bulk Actions
  factoryReset: db_factoryReset,
  deleteAllLogins: db_deleteAllLogins,

  // Products
  getProducts: db_getProducts,
  upsertProduct: db_upsertProduct,
  deleteProduct: db_deleteProduct,

  // Orders
  getOrders: db_getOrders,
  insertOrder: db_insertOrder,
  updateOrder: db_updateOrder,
  deleteOrder: db_deleteOrder,

  // Registrations
  getRegistrations: db_getRegistrations,
  insertRegistration: db_insertRegistration,

  // Logins
  getLogins: db_getLogins,
  insertLogin: db_insertLogin,

  // Banner
  getBanner: db_getBanner,
  saveBanner: db_saveBanner,
};

console.log(
  SUPABASE_CONFIGURED
    ? '%c[ApexStore] Supabase connected ✓'
    : '%c[ApexStore] Supabase not configured – using localStorage fallback',
  'color: ' + (SUPABASE_CONFIGURED ? '#22c55e' : '#f97316')
);
