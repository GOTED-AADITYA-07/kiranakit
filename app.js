/* ==========================================================
   KiranaKit — app.js
   Complete application logic: data layer, inventory,
   billing, reports, voice input, PWA
   ========================================================== */

'use strict';

/* ──────────────────────────────────────────────
   1. CONSTANTS & CONFIG
────────────────────────────────────────────── */
const APP_VERSION = '1.0.0';
const DB_KEYS = {
  products:  'kk_products',
  bills:     'kk_bills',
  settings:  'kk_settings',
  billCount: 'kk_bill_count',
  khata:     'kk_khata',
};

// Category → emoji mapping
const CATEGORY_EMOJI = {
  grains:    '🌾',
  dairy:     '🥛',
  snacks:    '🍿',
  beverages: '🥤',
  spices:    '🌶️',
  cleaning:  '🧹',
  other:     '📦',
};

/* ──────────────────────────────────────────────
   2. DATA LAYER  (localStorage CRUD)
────────────────────────────────────────────── */
const DB = {
  // ── Generic helpers ──
  get(key) {
    try { return JSON.parse(localStorage.getItem(key)) || null; }
    catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { console.error('DB.set failed', e); return false; }
  },

  // ── Products ──
  getProducts()       { return this.get(DB_KEYS.products) || []; },
  saveProducts(prods) { return this.set(DB_KEYS.products, prods); },

  addProduct(product) {
    const prods = this.getProducts();
    product.id = `p_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
    product.createdAt = new Date().toISOString();
    product.updatedAt = new Date().toISOString();
    prods.push(product);
    this.saveProducts(prods);
    return product;
  },

  updateProduct(id, changes) {
    const prods = this.getProducts();
    const idx = prods.findIndex(p => p.id === id);
    if (idx === -1) return null;
    prods[idx] = { ...prods[idx], ...changes, updatedAt: new Date().toISOString() };
    this.saveProducts(prods);
    return prods[idx];
  },

  deleteProduct(id) {
    const prods = this.getProducts().filter(p => p.id !== id);
    this.saveProducts(prods);
  },

  getProductById(id) {
    return this.getProducts().find(p => p.id === id) || null;
  },

  adjustStock(id, delta) {
    const prods = this.getProducts();
    const idx = prods.findIndex(p => p.id === id);
    if (idx === -1) return;
    prods[idx].stock = Math.max(0, (prods[idx].stock || 0) + delta);
    prods[idx].updatedAt = new Date().toISOString();
    this.saveProducts(prods);
    return prods[idx];
  },

  // ── Bills ──
  getBills()       { return this.get(DB_KEYS.bills) || []; },
  saveBills(bills) { return this.set(DB_KEYS.bills, bills); },

  addBill(bill) {
    const bills = this.getBills();
    const count = (this.get(DB_KEYS.billCount) || 0) + 1;
    this.set(DB_KEYS.billCount, count);
    bill.id = `b_${Date.now()}`;
    bill.number = String(count).padStart(4, '0');
    bill.createdAt = new Date().toISOString();
    bills.unshift(bill); // newest first
    this.saveBills(bills);
    return bill;
  },

  // ── Settings ──
  getSettings() {
    return this.get(DB_KEYS.settings) || {
      storeName:  'My Kirana Store',
      ownerName:  '',
      phone:      '',
      address:    '',
      gstin:      '',
      language:   'en',
    };
  },
  saveSettings(s) { return this.set(DB_KEYS.settings, s); },

  getBillCount() {
    return this.get(DB_KEYS.billCount) || 0;
  },
  saveBillCount(n) {
    return this.set(DB_KEYS.billCount, n);
  },

  getKhata() { return this.get(DB_KEYS.khata) || []; },
  saveKhata(list) { return this.set(DB_KEYS.khata, list); },

  addKhataEntry(customerName, bill) {
    const name = customerName.trim();
    if (!name) return;
    const list = this.getKhata();
    let rec = list.find(k => k.customerName.toLowerCase() === name.toLowerCase());
    if (!rec) {
      rec = {
        id: `k_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        customerName: name,
        entries: [],
      };
      list.push(rec);
    }
    rec.entries.push({
      billId: bill.id,
      billNumber: bill.number,
      amount: bill.total,
      createdAt: bill.createdAt,
      settled: false,
    });
    this.saveKhata(list);
    return rec;
  },

  settleKhataEntry(customerId, billId) {
    const list = this.getKhata();
    const rec = list.find(k => k.id === customerId);
    if (!rec) return;
    rec.entries.forEach(e => {
      if (e.billId === billId) e.settled = true;
    });
    this.saveKhata(list);
  },

  settleKhataCustomer(customerId) {
    const list = this.getKhata();
    const rec = list.find(k => k.id === customerId);
    if (!rec) return;
    rec.entries.forEach(e => { e.settled = true; });
    this.saveKhata(list);
  },
};

/* ──────────────────────────────────────────────
   3. UTILITY FUNCTIONS
────────────────────────────────────────────── */
const Utils = {
  formatCurrency(amount) {
    return '₹' + Number(amount).toFixed(2);
  },

  formatDate(dateStr) {
    const d = dateStr ? new Date(dateStr) : new Date();
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  },

  formatTime(dateStr) {
    const d = dateStr ? new Date(dateStr) : new Date();
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  },

  formatDateTime(dateStr) {
    return `${this.formatDate(dateStr)}, ${this.formatTime(dateStr)}`;
  },

  /** Returns today's date as YYYY-MM-DD */
  today() {
    return new Date().toISOString().slice(0, 10);
  },

  /** Returns start-of-week (Mon) as YYYY-MM-DD */
  startOfWeek() {
    const d = new Date();
    const day = d.getDay() || 7; // Mon=1..Sun=7
    d.setDate(d.getDate() - day + 1);
    return d.toISOString().slice(0, 10);
  },

  /** Returns start-of-month as YYYY-MM-DD */
  startOfMonth() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  },

  escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  /** Fuzzy product search */
  searchProducts(query, products) {
    if (!query) return products;
    const q = query.toLowerCase().trim();
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  },

  /** Download a file from a string */
  downloadFile(content, filename, type = 'application/json') {
    const blob = new Blob([content], { type });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  /** Stock status for a product */
  stockStatus(product) {
    if (product.stock === 0) return 'out';
    if (product.stock <= (product.lowThreshold || 5)) return 'low';
    return 'ok';
  },
};

/* ──────────────────────────────────────────────
   4. TOAST NOTIFICATIONS
────────────────────────────────────────────── */
let _toastTimer = null;
function showToast(message, type = 'info', duration = 2500) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = `toast ${type}`;
  el.classList.remove('hidden');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.add('hidden'), duration);
}

/* ──────────────────────────────────────────────
   5. NAVIGATION (Tab switching)
────────────────────────────────────────────── */
const Nav = {
  currentTab: 'inventory',

  init() {
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => this.switchTo(btn.dataset.tab));
    });
  },

  switchTo(tabName) {
    // Hide all panels
    document.querySelectorAll('.tab-panel').forEach(p => {
      p.classList.remove('active');
      p.setAttribute('aria-hidden', 'true');
    });
    // Deactivate all nav buttons
    document.querySelectorAll('.nav-item').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });

    // Activate target
    const panel = document.getElementById(`tab-${tabName}`);
    const btn   = document.getElementById(`nav-${tabName}`);
    if (panel) { panel.classList.add('active'); panel.removeAttribute('aria-hidden'); }
    if (btn)   { btn.classList.add('active'); btn.setAttribute('aria-selected', 'true'); }

    this.currentTab = tabName;

    // Refresh data for the newly-visible tab
    if (tabName === 'inventory') Inventory.render();
    if (tabName === 'billing')   Billing.refreshSuggestions();
    if (tabName === 'reports')   Reports.render();
  },
};

/* ──────────────────────────────────────────────
   6. INVENTORY MODULE
────────────────────────────────────────────── */
const Inventory = {
  currentCategory: 'all',
  currentQuery:    '',

  init() {
    // Search input
    document.getElementById('inventory-search').addEventListener('input', e => {
      this.currentQuery = e.target.value;
      this.render();
    });

    // Category pills
    document.getElementById('category-pills').addEventListener('click', e => {
      const pill = e.target.closest('.pill');
      if (!pill) return;
      document.querySelectorAll('#category-pills .pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      this.currentCategory = pill.dataset.category;
      this.render();
    });

    // Add product button
    document.getElementById('btn-add-product').addEventListener('click', () => ProductModal.open());

    // Voice search
    document.getElementById('btn-voice-inventory').addEventListener('click', () => {
      Voice.start('inventory');
    });

    // Dismiss low-stock banner
    document.getElementById('dismiss-low-stock').addEventListener('click', () => {
      document.getElementById('low-stock-banner').classList.add('hidden');
    });

    this.render();
  },

  getFiltered() {
    let prods = DB.getProducts();
    if (this.currentCategory !== 'all') {
      prods = prods.filter(p => p.category === this.currentCategory);
    }
    if (this.currentQuery) {
      prods = Utils.searchProducts(this.currentQuery, prods);
    }
    return prods;
  },

  render() {
    const products  = this.getFiltered();
    const allProds  = DB.getProducts();
    const list      = document.getElementById('product-list');
    const empty     = document.getElementById('inventory-empty');
    const banner    = document.getElementById('low-stock-banner');
    const bannerTxt = document.getElementById('low-stock-text');

    // Low stock banner
    const lowCount = allProds.filter(p => Utils.stockStatus(p) !== 'ok').length;
    if (lowCount > 0 && !banner.classList.contains('hidden-by-user')) {
      banner.classList.remove('hidden');
      bannerTxt.textContent = Lang.t(lowCount === 1 ? 'low_stock_one' : 'low_stock_many', { n: lowCount });
    } else if (lowCount === 0) {
      banner.classList.add('hidden');
    }

    if (products.length === 0) {
      list.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }

    empty.classList.add('hidden');
    list.innerHTML = products.map(p => this.renderCard(p)).join('');

    // Bind card events
    list.querySelectorAll('.product-card').forEach(card => {
      const id = card.dataset.id;
      card.querySelector('.btn-product-edit')?.addEventListener('click', e => {
        e.stopPropagation();
        ProductModal.open(id);
      });
      card.querySelector('.btn-product-delete')?.addEventListener('click', e => {
        e.stopPropagation();
        this.confirmDelete(id);
      });
      // Tap card body → add to billing cart
      card.addEventListener('click', () => {
        const prod = DB.getProductById(id);
        if (prod) {
          showToast(Lang.t('added_to_bill', { name: prod.name }), 'success');
        }
      });
    });
  },

  renderCard(product) {
    const status = Utils.stockStatus(product);
    const emoji  = CATEGORY_EMOJI[product.category] || '📦';
    const badgeClass = { ok: 'ok', low: 'low', out: 'out' }[status];
    const badgeIcon  = { ok: '✅', low: '⚠️', out: '❌' }[status];
    const badgeLabel = {
      ok:  `${product.stock} ${Lang.t('unit_' + product.unit) || product.unit}`,
      low: Lang.t('stock_low', { n: product.stock }),
      out: Lang.t('out_of_stock'),
    }[status];

    return `
      <div class="product-card stock-${status}" data-id="${product.id}" role="listitem">
        <div class="product-emoji">${emoji}</div>
        <div class="product-info">
          <div class="product-name">${Utils.escapeHtml(product.name)}</div>
          <div class="product-meta">
            <span class="product-price">${Utils.formatCurrency(product.price)}</span>
            <span class="product-category">${Lang.t('unit_' + product.unit) || product.unit} · ${Lang.t('cat_' + product.category) || product.category}</span>
          </div>
        </div>
        <div class="product-stock-info">
          <span class="stock-badge ${badgeClass}">${badgeIcon} ${badgeLabel}</span>
        </div>
        <div class="product-actions">
          <button class="btn-product-edit" aria-label="Edit ${Utils.escapeHtml(product.name)}">✏️</button>
          <button class="btn-product-delete" aria-label="Delete ${Utils.escapeHtml(product.name)}">🗑️</button>
        </div>
      </div>
    `;
  },

  confirmDelete(id) {
    const prod = DB.getProductById(id);
    if (!prod) return;
    if (confirm(Lang.t('confirm_delete_product', { name: prod.name }))) {
      DB.deleteProduct(id);
      this.render();
      showToast(Lang.t('product_deleted', { name: prod.name }), 'error');
    }
  },
};

/* ──────────────────────────────────────────────
   7. PRODUCT ADD / EDIT MODAL
────────────────────────────────────────────── */
const ProductModal = {
  init() {
    document.getElementById('product-form').addEventListener('submit', e => {
      e.preventDefault();
      this.save();
    });
    document.getElementById('btn-cancel-product').addEventListener('click', () => this.close());

    // Close on overlay click
    document.getElementById('modal-product').addEventListener('click', e => {
      if (e.target === e.currentTarget) this.close();
    });
  },

  open(productId = null) {
    const modal = document.getElementById('modal-product');
    const title = document.getElementById('modal-product-title');
    this.clear();

    if (productId) {
      const p = DB.getProductById(productId);
      if (!p) return;
      title.textContent = Lang.t('edit_product');
      document.getElementById('product-id').value           = p.id;
      document.getElementById('product-name').value         = p.name;
      document.getElementById('product-price').value        = p.price;
      document.getElementById('product-stock').value        = p.stock;
      document.getElementById('product-unit').value         = p.unit;
      document.getElementById('product-category').value     = p.category;
      document.getElementById('product-low-threshold').value = p.lowThreshold || 5;
    } else {
      title.textContent = Lang.t('add_product');
    }

    modal.classList.remove('hidden');
    setTimeout(() => document.getElementById('product-name').focus(), 100);
  },

  close() {
    document.getElementById('modal-product').classList.add('hidden');
    this.clear();
  },

  clear() {
    document.getElementById('product-form').reset();
    document.getElementById('product-id').value = '';
    document.getElementById('product-low-threshold').value = '5';
  },

  save() {
    const id    = document.getElementById('product-id').value;
    const name  = document.getElementById('product-name').value.trim();
    const price = parseFloat(document.getElementById('product-price').value);
    const stock = parseInt(document.getElementById('product-stock').value, 10);

    if (!name)          return showToast(Lang.t('err_product_name'), 'error');
    if (isNaN(price) || price < 0) return showToast(Lang.t('err_price'), 'error');
    if (isNaN(stock) || stock < 0) return showToast(Lang.t('err_stock'), 'error');

    const data = {
      name,
      price,
      stock,
      unit:         document.getElementById('product-unit').value,
      category:     document.getElementById('product-category').value,
      lowThreshold: parseInt(document.getElementById('product-low-threshold').value, 10) || 5,
    };

    if (id) {
      DB.updateProduct(id, data);
      showToast(Lang.t('product_updated', { name }), 'success');
    } else {
      DB.addProduct(data);
      showToast(Lang.t('product_added', { name }), 'success');
    }

    this.close();
    Inventory.render();
  },
};

/* ──────────────────────────────────────────────
   8. BILLING MODULE
────────────────────────────────────────────── */
const KhataModal = {
  callback: null,

  init() {
    const modal = document.getElementById('modal-khata');
    document.getElementById('khata-form').addEventListener('submit', event => {
      event.preventDefault();
      const name = document.getElementById('khata-customer-name').value.trim();
      if (!name) {
        showToast(Lang.t('err_customer_name'), 'error');
        return;
      }
      const callback = this.callback;
      this.close();
      if (callback) callback(name);
    });
    document.getElementById('btn-cancel-khata').addEventListener('click', () => this.close());
    modal.addEventListener('click', event => {
      if (event.target === event.currentTarget) this.close();
    });
  },

  prompt(callback) {
    this.callback = callback;
    document.getElementById('khata-form').reset();
    document.getElementById('modal-khata').classList.remove('hidden');
    setTimeout(() => document.getElementById('khata-customer-name').focus(), 100);
  },

  close() {
    this.callback = null;
    document.getElementById('modal-khata').classList.add('hidden');
  },
};

const Billing = {
  cart:          [],  // [{product, qty, unitPrice, total}]
  paymentMethod: 'cash',

  init() {
    // Billing search
    const searchEl = document.getElementById('billing-search');
    searchEl.addEventListener('input', e => this.showSuggestions(e.target.value));
    searchEl.addEventListener('focus', e => this.showSuggestions(e.target.value));

    // Voice add
    document.getElementById('btn-voice-billing').addEventListener('click', () => {
      Voice.start('billing');
    });

    // GST toggle
    document.getElementById('gst-select').addEventListener('change', () => this.renderTotals());

    // Payment method buttons
    document.querySelectorAll('.pay-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.paymentMethod = btn.dataset.method;
      });
    });

    // Clear bill
    document.getElementById('btn-clear-bill').addEventListener('click', () => {
      if (this.cart.length === 0) return;
      if (confirm(Lang.t('confirm_clear_bill'))) { this.clearCart(); }
    });

    // Finalize bill
    document.getElementById('btn-finalize-bill').addEventListener('click', () => this.finalize());

    // Close suggestions when clicking outside
    document.addEventListener('click', e => {
      if (!e.target.closest('#billing-search') && !e.target.closest('#billing-suggestions')) {
        document.getElementById('billing-suggestions').classList.add('hidden');
      }
    });

    this.updateBillHeader();
    this.renderCart();
  },

  addToCart(product, qty = 1) {
    const existing = this.cart.find(i => i.product.id === product.id);
    if (existing) {
      existing.qty += qty;
      existing.total = existing.qty * existing.unitPrice;
    } else {
      this.cart.push({
        product,
        qty,
        unitPrice: product.price,
        total: product.price * qty,
      });
    }
    document.getElementById('billing-search').value = '';
    document.getElementById('billing-suggestions').classList.add('hidden');
    this.renderCart();
  },

  removeFromCart(productId) {
    this.cart = this.cart.filter(i => i.product.id !== productId);
    this.renderCart();
  },

  updateQty(productId, delta) {
    const item = this.cart.find(i => i.product.id === productId);
    if (!item) return;
    item.qty = Math.max(1, item.qty + delta);
    item.total = item.qty * item.unitPrice;
    this.renderCart();
  },

  clearCart() {
    this.cart = [];
    document.getElementById('gst-select').value = '0';
    this.renderCart();
  },

  renderCart() {
    const cartEl    = document.getElementById('cart-items');
    const emptyEl   = document.getElementById('cart-empty');
    const totalsEl  = document.getElementById('bill-totals');
    const actionsEl = document.getElementById('bill-actions');

    if (this.cart.length === 0) {
      cartEl.innerHTML = '';
      emptyEl.classList.remove('hidden');
      totalsEl.classList.add('hidden');
      actionsEl.classList.add('hidden');
      return;
    }

    emptyEl.classList.add('hidden');
    totalsEl.classList.remove('hidden');
    actionsEl.classList.remove('hidden');

    cartEl.innerHTML = this.cart.map(item => `
      <div class="cart-item" data-id="${item.product.id}" role="listitem">
        <span class="cart-item-name">${Utils.escapeHtml(item.product.name)}</span>
        <div class="qty-controls">
          <button class="qty-btn btn-qty-minus" data-id="${item.product.id}" aria-label="Decrease quantity">−</button>
          <span class="qty-val">${item.qty}</span>
          <button class="qty-btn btn-qty-plus" data-id="${item.product.id}" aria-label="Increase quantity">+</button>
        </div>
        <span class="cart-item-price">${Utils.formatCurrency(item.total)}</span>
        <button class="cart-remove btn-cart-remove" data-id="${item.product.id}" aria-label="Remove ${Utils.escapeHtml(item.product.name)}">✕</button>
      </div>
    `).join('');

    // Bind cart events
    cartEl.querySelectorAll('.btn-qty-minus').forEach(b =>
      b.addEventListener('click', () => this.updateQty(b.dataset.id, -1))
    );
    cartEl.querySelectorAll('.btn-qty-plus').forEach(b =>
      b.addEventListener('click', () => this.updateQty(b.dataset.id, +1))
    );
    cartEl.querySelectorAll('.btn-cart-remove').forEach(b =>
      b.addEventListener('click', () => this.removeFromCart(b.dataset.id))
    );

    this.renderTotals();
  },

  renderTotals() {
    const subtotal  = this.cart.reduce((s, i) => s + i.total, 0);
    const gstRate   = parseFloat(document.getElementById('gst-select').value) || 0;
    const gstAmt    = subtotal * (gstRate / 100);
    const total     = subtotal + gstAmt;

    document.getElementById('subtotal-val').textContent = Utils.formatCurrency(subtotal);
    document.getElementById('gst-val').textContent      = Utils.formatCurrency(gstAmt);
    document.getElementById('total-val').textContent    = Utils.formatCurrency(total);
  },

  showSuggestions(query) {
    const dropEl  = document.getElementById('billing-suggestions');
    const products = DB.getProducts();
    const results  = Utils.searchProducts(query, products).slice(0, 8);

    if (results.length === 0 || !query) {
      // Show all when no query but focused
      const allProds = query ? [] : products.slice(0, 8);
      if (allProds.length === 0) { dropEl.classList.add('hidden'); return; }
      this._renderSuggestions(allProds, dropEl);
      return;
    }

    this._renderSuggestions(results, dropEl);
  },

  _renderSuggestions(products, dropEl) {
    dropEl.classList.remove('hidden');
    dropEl.innerHTML = products.map(p => `
      <div class="suggestion-item" data-id="${p.id}" role="option" tabindex="0">
        <span>${CATEGORY_EMOJI[p.category] || '📦'}</span>
        <span class="suggestion-name">${Utils.escapeHtml(p.name)}</span>
        <span class="suggestion-stock">${p.stock} ${p.unit}</span>
        <span class="suggestion-price">${Utils.formatCurrency(p.price)}</span>
      </div>
    `).join('');

    dropEl.querySelectorAll('.suggestion-item').forEach(item => {
      const addProduct = () => {
        const prod = DB.getProductById(item.dataset.id);
        if (prod) {
          if (prod.stock === 0) {
            showToast(Lang.t('item_out_of_stock', { name: prod.name }), 'error');
            return;
          }
          this.addToCart(prod);
          showToast(Lang.t('item_added', { name: prod.name }), 'success');
        }
      };
      item.addEventListener('click', addProduct);
      item.addEventListener('keypress', e => { if (e.key === 'Enter') addProduct(); });
    });
  },

  refreshSuggestions() {
    // Called when switching to billing tab — show all products if search is empty
    const query = document.getElementById('billing-search').value;
    if (!query) {
      const products = DB.getProducts().slice(0, 8);
      if (products.length) this._renderSuggestions(products, document.getElementById('billing-suggestions'));
    }
  },

  updateBillHeader() {
    const now = new Date();
    document.getElementById('bill-date').textContent = Utils.formatDateTime();
    const count = (DB.getBillCount() || 0) + 1;
    document.getElementById('bill-number').textContent = `#${String(count).padStart(4, '0')}`;
  },

  finalize() {
    if (this.cart.length === 0) {
      showToast(Lang.t('cart_empty_toast'), 'error');
      return;
    }

    if (this.paymentMethod === 'credit') {
      KhataModal.prompt(name => this.completeFinalize(name));
      return;
    }

    this.completeFinalize(null);
  },

  completeFinalize(customerName) {
    const subtotal = this.cart.reduce((s, i) => s + i.total, 0);
    const gstRate  = parseFloat(document.getElementById('gst-select').value) || 0;
    const gstAmt   = subtotal * (gstRate / 100);
    const total    = subtotal + gstAmt;

    this.cart.forEach(item => {
      DB.adjustStock(item.product.id, -item.qty);
    });

    const bill = DB.addBill({
      items:         this.cart.map(i => ({
        productId:   i.product.id,
        productName: i.product.name,
        qty:         i.qty,
        unit:        i.product.unit,
        unitPrice:   i.unitPrice,
        total:       i.total,
      })),
      subtotal,
      gstRate,
      gstAmt,
      total,
      paymentMethod: this.paymentMethod,
      customerName:  customerName || '',
    });

    if (this.paymentMethod === 'credit' && customerName) {
      DB.addKhataEntry(customerName, bill);
    }

    Receipt.show(bill);
    this.clearCart();
    this.updateBillHeader();
    Inventory.render();
  },
};

/* ──────────────────────────────────────────────
   9. RECEIPT MODULE
────────────────────────────────────────────── */
const Receipt = {
  currentBill: null,

  init() {
    document.getElementById('btn-print-receipt').addEventListener('click', () => window.print());
    document.getElementById('btn-share-receipt').addEventListener('click', () => this.shareWhatsApp());
    document.getElementById('btn-new-bill').addEventListener('click', () => {
      document.getElementById('modal-receipt').classList.add('hidden');
    });
    document.getElementById('modal-receipt').addEventListener('click', e => {
      if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
    });
  },

  show(bill) {
    this.currentBill = bill;
    const settings   = DB.getSettings();
    const content    = document.getElementById('receipt-content');

    const itemsHTML = bill.items.map(item => `
      <div class="receipt-item-row">
        <span class="receipt-item-name">${Utils.escapeHtml(item.productName)}</span>
        <span class="receipt-item-qty">${item.qty}</span>
        <span class="receipt-item-rate">${Utils.formatCurrency(item.unitPrice)}</span>
        <span class="receipt-item-amt">${Utils.formatCurrency(item.total)}</span>
      </div>
    `).join('');

    const store = settings.storeName || Lang.t('my_store');
    const payLabel = Lang.t('method_' + bill.paymentMethod);
    const customerRow = bill.customerName
      ? `<div class="receipt-payment-row">${Lang.t('receipt_customer')}: ${Utils.escapeHtml(bill.customerName)}</div>`
      : '';

    content.innerHTML = `
      <div class="receipt-store-name">${Utils.escapeHtml(store)}</div>
      ${settings.address ? `<div class="receipt-address">${Utils.escapeHtml(settings.address)}</div>` : ''}
      ${settings.phone   ? `<div class="receipt-address">📱 ${Utils.escapeHtml(settings.phone)}</div>` : ''}
      ${settings.gstin   ? `<div class="receipt-gstin">${Lang.t('gstin_label')}: ${Utils.escapeHtml(settings.gstin)}</div>` : ''}
      <hr class="receipt-divider" />
      <div class="receipt-address">${Lang.t('bill')} #${bill.number} &nbsp;|&nbsp; ${Utils.formatDateTime(bill.createdAt)}</div>
      <hr class="receipt-divider" />
      <div class="receipt-header-row">
        <span class="receipt-item-name">${Lang.t('receipt_item')}</span>
        <span class="receipt-item-qty">${Lang.t('receipt_qty')}</span>
        <span class="receipt-item-rate">${Lang.t('receipt_rate')}</span>
        <span class="receipt-item-amt">${Lang.t('receipt_amt')}</span>
      </div>
      <hr class="receipt-divider" />
      ${itemsHTML}
      <hr class="receipt-divider" />
      <div class="receipt-total-row">
        <span class="receipt-total-label">${Lang.t('subtotal')}</span>
        <span class="receipt-total-value">${Utils.formatCurrency(bill.subtotal)}</span>
      </div>
      ${bill.gstRate > 0 ? `
      <div class="receipt-total-row">
        <span class="receipt-total-label">${Lang.t('gst')} (${bill.gstRate}%)</span>
        <span class="receipt-total-value">${Utils.formatCurrency(bill.gstAmt)}</span>
      </div>` : ''}
      <hr class="receipt-divider" />
      <div class="receipt-total-row receipt-grand-total">
        <span class="receipt-total-label">${Lang.t('total').toUpperCase()}</span>
        <span class="receipt-total-value">${Utils.formatCurrency(bill.total)}</span>
      </div>
      <div class="receipt-payment-row">${Lang.t('payment')} ${payLabel}</div>
      ${customerRow}
      <hr class="receipt-divider" />
      <div class="receipt-thank-you">${Lang.t('thank_you')}</div>
      <div class="receipt-footer">${Lang.t('visit_again')} — ${Utils.escapeHtml(store)}</div>
    `;

    document.getElementById('modal-receipt').classList.remove('hidden');
  },

  shareWhatsApp() {
    if (!this.currentBill) return;
    const settings = DB.getSettings();
    const bill     = this.currentBill;

    const store = settings.storeName || Lang.t('my_store');
    const lines = [
      `*${store}*`,
      settings.address || '',
      `${Lang.t('bill')} #${bill.number} | ${Utils.formatDateTime(bill.createdAt)}`,
      '─────────────────',
      ...bill.items.map(i => `${i.productName} x${i.qty} = ${Utils.formatCurrency(i.total)}`),
      '─────────────────',
      bill.gstRate > 0 ? `${Lang.t('subtotal')}: ${Utils.formatCurrency(bill.subtotal)}` : '',
      bill.gstRate > 0 ? `${Lang.t('gst')} (${bill.gstRate}%): ${Utils.formatCurrency(bill.gstAmt)}` : '',
      `*${Lang.t('total')}: ${Utils.formatCurrency(bill.total)}*`,
      `${Lang.t('payment')} ${Lang.t('method_' + bill.paymentMethod)}`,
      bill.customerName ? `${Lang.t('receipt_customer')}: ${bill.customerName}` : '',
      '',
      Lang.t('thank_you_shop'),
    ].filter(l => l !== null && l !== undefined && l !== '').join('\n');

    const url = `https://wa.me/?text=${encodeURIComponent(lines)}`;
    window.open(url, '_blank', 'noopener');
  },
};

/* ──────────────────────────────────────────────
   10. REPORTS MODULE
────────────────────────────────────────────── */
const Reports = {
  currentPeriod: 'today',

  init() {
    // Period pills
    document.querySelectorAll('[data-period]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-period]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentPeriod = btn.dataset.period;
        this.render();
      });
    });

    // Export button
    document.getElementById('btn-export').addEventListener('click', () => this.exportData());

    document.getElementById('khata-due-list').addEventListener('click', e => this.onKhataClick(e));
    document.getElementById('khata-settled-list').addEventListener('click', e => this.onKhataClick(e));

    this.render();
  },

  getDateFilter() {
    const p = this.currentPeriod;
    if (p === 'today') return Utils.today();
    if (p === 'week')  return Utils.startOfWeek();
    if (p === 'month') return Utils.startOfMonth();
    return null;
  },

  getFilteredBills() {
    const since = this.getDateFilter();
    return DB.getBills().filter(b => !since || b.createdAt.slice(0, 10) >= since);
  },

  render() {
    const bills    = this.getFilteredBills();
    const products = DB.getProducts();

    // ── KPI Cards ──
    const totalSales = bills.reduce((s, b) => s + b.total, 0);
    const billCount  = bills.length;
    const avgBill    = billCount > 0 ? totalSales / billCount : 0;
    const lowStockCount = products.filter(p => Utils.stockStatus(p) !== 'ok').length;

    document.getElementById('kpi-sales-val').textContent    = Utils.formatCurrency(totalSales);
    document.getElementById('kpi-bills-val').textContent    = billCount;
    document.getElementById('kpi-avg-val').textContent      = Utils.formatCurrency(avgBill);
    document.getElementById('kpi-lowstock-val').textContent = lowStockCount;

    // ── Top Products ──
    const salesMap = {};
    bills.forEach(b => {
      b.items.forEach(item => {
        if (!salesMap[item.productName]) {
          salesMap[item.productName] = { qty: 0, revenue: 0 };
        }
        salesMap[item.productName].qty     += item.qty;
        salesMap[item.productName].revenue += item.total;
      });
    });

    const topProds = Object.entries(salesMap)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 5);

    const topEl = document.getElementById('top-products-list');
    if (topProds.length === 0) {
      topEl.innerHTML = `<div class="empty-inline"><span>${Lang.t('no_sales_yet')}</span></div>`;
    } else {
      const rankClasses = ['gold', 'silver', 'bronze', '', ''];
      topEl.innerHTML = topProds.map(([name, data], i) => `
        <div class="top-product-item">
          <span class="top-rank ${rankClasses[i] || ''}">${i + 1}</span>
          <span class="top-product-name">${Utils.escapeHtml(name)}</span>
          <span class="top-product-sold">${Lang.t('qty_sold', { n: data.qty })}</span>
          <span class="top-product-rev">${Utils.formatCurrency(data.revenue)}</span>
        </div>
      `).join('');
    }

    // ── Low Stock List ──
    const lowProds  = products.filter(p => Utils.stockStatus(p) !== 'ok');
    const lowEl     = document.getElementById('low-stock-list');
    const lowEmpty  = document.getElementById('low-stock-report-empty');

    if (lowProds.length === 0) {
      lowEl.innerHTML = '';
      lowEmpty.classList.remove('hidden');
    } else {
      lowEmpty.classList.add('hidden');
      lowEl.innerHTML = lowProds.map(p => `
        <div class="low-stock-item">
          <span class="low-stock-name">${Utils.escapeHtml(p.name)}</span>
          <span class="low-stock-qty">${p.stock === 0 ? Lang.t('out_badge') : Lang.t('left_badge', { n: p.stock, unit: Lang.t('unit_' + p.unit) || p.unit })}</span>
        </div>
      `).join('');
    }

    // ── Recent Bills ──
    const recentEl = document.getElementById('recent-bills-list');
    const recent   = bills.slice(0, 10);
    if (recent.length === 0) {
      recentEl.innerHTML = `<div class="empty-inline"><span>${Lang.t('no_bills_yet')}</span></div>`;
    } else {
      recentEl.innerHTML = recent.map(b => {
        const itemLabel = b.items.length === 1 ? Lang.t('item_one') : Lang.t('item_many', { n: b.items.length });
        const method = Lang.t('method_' + b.paymentMethod);
        const who = b.customerName ? ` · ${Utils.escapeHtml(b.customerName)}` : '';
        return `
        <div class="bill-item">
          <div class="bill-item-left">
            <span class="bill-item-num">#${b.number}</span>
            <span class="bill-item-time">${Utils.formatDateTime(b.createdAt)}</span>
            <span class="bill-item-method">${method}${who} · ${itemLabel}</span>
          </div>
          <span class="bill-item-total">${Utils.formatCurrency(b.total)}</span>
        </div>`;
      }).join('');
    }

    this.renderKhata();

    // ── Sales Chart ──
    this.renderChart(bills);
  },

  renderKhata() {
    const ledger = DB.getKhata();
    const dueEl = document.getElementById('khata-due-list');
    const settledEl = document.getElementById('khata-settled-list');
    const outEl = document.getElementById('khata-outstanding-val');

    let outstanding = 0;
    const dueBlocks = [];
    const settledBlocks = [];

    ledger.forEach(rec => {
      const dueEntries = rec.entries.filter(e => !e.settled);
      const paidEntries = rec.entries.filter(e => e.settled);
      const dueSum = dueEntries.reduce((s, e) => s + e.amount, 0);
      outstanding += dueSum;

      if (dueEntries.length) {
        dueBlocks.push(`
          <div class="khata-customer" data-id="${rec.id}">
            <div class="khata-customer-head">
              <div>
                <div class="khata-customer-name">${Utils.escapeHtml(rec.customerName)}</div>
                <div class="khata-customer-due">${Lang.t('due')}: ${Utils.formatCurrency(dueSum)}</div>
              </div>
              <button type="button" class="btn-secondary khata-mark-all" data-action="settle-all" data-id="${rec.id}">${Lang.t('mark_all_paid')}</button>
            </div>
            ${dueEntries.map(e => `
              <div class="khata-entry">
                <span>#${e.billNumber} · ${Utils.formatDate(e.createdAt)}</span>
                <span>${Utils.formatCurrency(e.amount)}</span>
                <button type="button" class="btn-ghost khata-mark-one" data-action="settle-one" data-id="${rec.id}" data-bill="${e.billId}">${Lang.t('mark_paid')}</button>
              </div>
            `).join('')}
          </div>
        `);
      }

      if (paidEntries.length) {
        settledBlocks.push(`
          <div class="khata-customer khata-customer-settled" data-id="${rec.id}">
            <div class="khata-customer-name">${Utils.escapeHtml(rec.customerName)}</div>
            ${paidEntries.map(e => `
              <div class="khata-entry khata-entry-paid">
                <span>#${e.billNumber} · ${Utils.formatDate(e.createdAt)}</span>
                <span>${Utils.formatCurrency(e.amount)}</span>
                <span class="khata-paid-tag">${Lang.t('paid')}</span>
              </div>
            `).join('')}
          </div>
        `);
      }
    });

    outEl.textContent = Utils.formatCurrency(outstanding);
    dueEl.innerHTML = dueBlocks.length
      ? dueBlocks.join('')
      : `<div class="empty-inline"><span>${Lang.t('khata_empty_due')}</span></div>`;
    settledEl.innerHTML = settledBlocks.length
      ? settledBlocks.join('')
      : `<div class="empty-inline"><span>${Lang.t('khata_empty_settled')}</span></div>`;
  },

  onKhataClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'settle-all') {
      DB.settleKhataCustomer(id);
      showToast(Lang.t('khata_marked_paid'), 'success');
      this.render();
    }
    if (btn.dataset.action === 'settle-one') {
      DB.settleKhataEntry(id, btn.dataset.bill);
      showToast(Lang.t('khata_marked_paid'), 'success');
      this.render();
    }
  },

  renderChart(bills) {
    const canvas = document.getElementById('sales-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W   = canvas.width  = canvas.offsetWidth  || 340;
    const H   = canvas.height = 160;

    ctx.clearRect(0, 0, W, H);

    // Build last-7-days buckets
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({
        label: d.toLocaleDateString('en-IN', { weekday: 'short' }),
        date:  d.toISOString().slice(0, 10),
        total: 0,
      });
    }
    bills.forEach(b => {
      const day = days.find(d => d.date === b.createdAt.slice(0, 10));
      if (day) day.total += b.total;
    });

    const maxVal = Math.max(...days.map(d => d.total), 1);
    const pad    = { top: 16, right: 12, bottom: 28, left: 8 };
    const barW   = (W - pad.left - pad.right) / days.length;
    const chartH = H - pad.top - pad.bottom;

    // Background grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth   = 1;
    [0.25, 0.5, 0.75, 1].forEach(f => {
      const y = pad.top + chartH * (1 - f);
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
    });

    // Bars
    days.forEach((day, i) => {
      const barH  = (day.total / maxVal) * chartH;
      const x     = pad.left + i * barW + barW * 0.15;
      const bw    = barW * 0.7;
      const y     = pad.top + chartH - barH;

      // Gradient fill
      const grad = ctx.createLinearGradient(0, y, 0, y + barH);
      grad.addColorStop(0,   '#ff8c61');
      grad.addColorStop(1,   '#ff6b35');
      ctx.fillStyle = grad;

      // Rounded top
      const r = Math.min(4, bw / 2, barH);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + bw - r, y);
      ctx.quadraticCurveTo(x + bw, y, x + bw, y + r);
      ctx.lineTo(x + bw, y + barH);
      ctx.lineTo(x, y + barH);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.fill();

      // Day label
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(day.label, x + bw / 2, H - 6);
    });
  },

  exportData() {
    const data = {
      exportedAt: new Date().toISOString(),
      settings:   DB.getSettings(),
      products:   DB.getProducts(),
      bills:      DB.getBills(),
      billCount:  DB.getBillCount(),
      khata:      DB.getKhata(),
    };
    Utils.downloadFile(JSON.stringify(data, null, 2), `kiranakit-export-${Utils.today()}.json`);
    showToast(Lang.t('data_exported'), 'success');
  },
};

/* ──────────────────────────────────────────────
   11. SETTINGS MODULE
────────────────────────────────────────────── */
const Settings = {
  init() {
    document.getElementById('btn-settings').addEventListener('click', () => this.open());
    document.getElementById('btn-cancel-settings').addEventListener('click', () => this.close());
    document.getElementById('btn-save-settings').addEventListener('click', () => this.save());
    document.getElementById('modal-settings').addEventListener('click', e => {
      if (e.target === e.currentTarget) this.close();
    });

    // Data management
    document.getElementById('btn-export-data').addEventListener('click', () => Reports.exportData());
    document.getElementById('btn-import-data').addEventListener('click', () => {
      document.getElementById('import-file-input').click();
    });
    document.getElementById('btn-clear-data').addEventListener('click', () => this.clearAllData());
    document.getElementById('import-file-input').addEventListener('change', e => this.importData(e));
  },

  open() {
    const s = DB.getSettings();
    document.getElementById('setting-store-name').value  = s.storeName  || '';
    document.getElementById('setting-owner-name').value  = s.ownerName  || '';
    document.getElementById('setting-phone').value       = s.phone      || '';
    document.getElementById('setting-address').value     = s.address    || '';
    document.getElementById('setting-gstin').value       = s.gstin      || '';
    document.getElementById('modal-settings').classList.remove('hidden');
  },

  close() {
    document.getElementById('modal-settings').classList.add('hidden');
  },

  save() {
    const s = {
      storeName: document.getElementById('setting-store-name').value.trim(),
      ownerName: document.getElementById('setting-owner-name').value.trim(),
      phone:     document.getElementById('setting-phone').value.trim(),
      address:   document.getElementById('setting-address').value.trim(),
      gstin:     document.getElementById('setting-gstin').value.trim(),
    };
    DB.saveSettings({ ...DB.getSettings(), ...s });

    // Update header store name
    document.getElementById('store-name').textContent = s.storeName || Lang.t('my_store');

    this.close();
    showToast(Lang.t('settings_saved'), 'success');
  },

  clearAllData() {
    if (!confirm(Lang.t('confirm_clear_1'))) return;
    if (!confirm(Lang.t('confirm_clear_2'))) return;
    Object.values(DB_KEYS).forEach(key => localStorage.removeItem(key));
    showToast(Lang.t('all_data_cleared'), 'error');
    location.reload();
  },

  importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.products)  DB.saveProducts(data.products);
        if (data.bills)     DB.saveBills(data.bills);
        if (data.settings)  DB.saveSettings(data.settings);
        if (data.khata)     DB.saveKhata(data.khata);
        if (typeof data.billCount === 'number') {
          DB.saveBillCount(data.billCount);
        } else if (data.bills) {
          const maxNum = data.bills.reduce((m, b) => {
            const n = parseInt(b.number, 10);
            return Number.isFinite(n) ? Math.max(m, n) : m;
          }, 0);
          DB.saveBillCount(maxNum || data.bills.length);
        }
        showToast(Lang.t('data_imported'), 'success');
        Inventory.render();
        Billing.updateBillHeader();
        Reports.render();
        document.getElementById('store-name').textContent = DB.getSettings().storeName || Lang.t('my_store');
      } catch {
        showToast(Lang.t('invalid_file'), 'error');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  },
};

/* ──────────────────────────────────────────────
   12. VOICE INPUT MODULE
   Uses Web Speech API (Chrome/Android)
────────────────────────────────────────────── */
const Voice = {
  recognition: null,
  context:     'inventory',  // 'inventory' | 'billing'
  supported:   false,

  init() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Voice: SpeechRecognition not supported in this browser');
      // Hide voice buttons gracefully
      document.querySelectorAll('.btn-voice').forEach(b => b.style.display = 'none');
      return;
    }

    this.supported = true;
    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'en-IN';
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;

    this.recognition.onresult = e => {
      const transcript = Array.from(e.results)
        .map(r => r[0].transcript)
        .join('');
      document.getElementById('voice-transcript').textContent = transcript;

      if (e.results[e.results.length - 1].isFinal) {
        this.processCommand(transcript.toLowerCase().trim());
        this.stop();
      }
    };

    this.recognition.onerror = e => {
      console.error('Voice error:', e.error);
      showToast(Lang.t('voice_error', { err: e.error }), 'error');
      this.stop();
    };

    this.recognition.onend = () => this.stop();

    // Stop button
    document.getElementById('btn-stop-voice').addEventListener('click', () => this.stop());
  },

  start(context) {
    if (!this.supported) {
      showToast(Lang.t('voice_unsupported'), 'error');
      return;
    }
    this.context = context;
    document.getElementById('voice-overlay').classList.remove('hidden');
    document.getElementById('voice-transcript').textContent = Lang.t('voice_hint');
    document.querySelectorAll('.btn-voice').forEach(b => b.classList.add('listening'));
    try { this.recognition.start(); }
    catch { /* already started */ }
  },

  stop() {
    try { this.recognition?.stop(); } catch { /* ignore */ }
    document.getElementById('voice-overlay').classList.add('hidden');
    document.querySelectorAll('.btn-voice').forEach(b => b.classList.remove('listening'));
  },

  /**
   * Parse free-form voice commands into actions.
   * Examples handled:
   *   "add sugar"         → search "sugar", add to cart
   *   "5 kg chawal"       → add 5 of chawal to cart
   *   "stock update atta 20" → update atta stock to 20 (inventory context)
   *   "new item biscuit 10 rupees stock 100" → add new product
   */
  processCommand(text) {
    const products = DB.getProducts();

    // ── NEW ITEM command (inventory context) ──
    // "new item <name> <price> rupees stock <qty>"
    const newItemMatch = text.match(/new\s+item\s+(.+?)\s+(\d+(?:\.\d+)?)\s+(?:rupees?|rs\.?|price)?\s*(?:stock\s+(\d+))?/i);
    if (newItemMatch) {
      const name  = newItemMatch[1].trim();
      const price = parseFloat(newItemMatch[2]);
      const stock = parseInt(newItemMatch[3] || '0', 10);
      DB.addProduct({ name, price, stock, unit: 'piece', category: 'other', lowThreshold: 5 });
      Inventory.render();
      showToast(Lang.t('product_added', { name }), 'success');
      return;
    }

    // ── BILLING: qty + product name ──
    // "5 kg atta" | "3 sugar" | "add 2 biscuits"
    const qtyMatch = text.match(/(?:add\s+)?(\d+(?:\.\d+)?)\s*(?:kg|gram|litre|ml|piece|pc|pcs|pack|box|dozen)?\s+(.+)/i);
    if (qtyMatch) {
      const qty  = parseFloat(qtyMatch[1]);
      const name = qtyMatch[2].trim();
      const prod = products.find(p => p.name.toLowerCase().includes(name));
      if (prod) {
        if (this.context === 'billing') {
          Billing.addToCart(prod, Math.max(1, Math.round(qty)));
          showToast(Lang.t('added_qty', { name: prod.name, n: Math.round(qty) }), 'success');
        } else {
          Nav.switchTo('billing');
          Billing.addToCart(prod, Math.max(1, Math.round(qty)));
          showToast(Lang.t('added_to_bill', { name: prod.name }), 'success');
        }
        return;
      }
    }

    // ── Simple product name search ──
    // "add sugar" | "sugar"
    const cleanText = text.replace(/^(add|find|search|show)\s+/i, '').trim();
    const found     = products.find(p => p.name.toLowerCase().includes(cleanText));
    if (found) {
      if (this.context === 'billing') {
        Billing.addToCart(found, 1);
        showToast(Lang.t('added_to_bill', { name: found.name }), 'success');
      } else {
        // In inventory context, populate search
        const searchEl = document.getElementById('inventory-search');
        if (searchEl) { searchEl.value = cleanText; Inventory.currentQuery = cleanText; Inventory.render(); }
      }
      return;
    }

    // ── Fallback ──
    showToast(Lang.t('voice_unknown', { text }), 'error');
  },
};

/* ──────────────────────────────────────────────
   13. LANGUAGE TOGGLE (EN / हिं)
────────────────────────────────────────────── */
const Lang = {
  current: 'en',

  translations: {
    en: {
      toggle_lang: 'Toggle Hindi/English', settings: 'Settings', voice_search: 'Voice Search',
      nav_inventory: 'Inventory', nav_billing: 'Billing', nav_reports: 'Reports',
      voice_add_bill: 'Voice Add to Bill', search_items: 'Search items...', search_bill: 'Search & add to bill...',
      search_inventory: 'Search inventory', search_bill_aria: 'Search products to add to bill',
      aria_add_product: 'Add new product', filter_category: 'Filter by category', product_inventory: 'Product inventory',
      product_suggestions: 'Product suggestions', cart_items: 'Cart items', main_nav: 'Main navigation',
      cat_all: 'All', cat_grains: 'Grains', cat_dairy: 'Dairy', cat_snacks: 'Snacks', cat_beverages: 'Beverages',
      cat_spices: 'Spices', cat_cleaning: 'Cleaning', cat_other: 'Other', btn_add: '+ Add',
      empty_inventory_title: 'No products yet', empty_inventory_sub: 'Tap "+ Add" or use 🎙️ voice to add your first item',
      current_bill: '🧾 Current Bill', cart_empty_title: 'Cart is empty', cart_empty_sub: 'Search above or tap a product to add it',
      subtotal: 'Subtotal', gst: 'GST', gst_none: 'None (0%)', total: 'Total', payment: 'Payment:',
      payment_method: 'Payment method', pay_cash: '💵 Cash', pay_upi: '📲 UPI', pay_credit: '📒 Khata',
      clear_bill: '🗑️ Clear', finalize_bill: '✅ Finalize Bill', period_today: 'Today', period_week: 'This Week',
      period_month: 'This Month', export: 'Export data', export_btn: '📤 Export', kpi_sales: 'Total Sales',
      kpi_bills: 'Bills Generated', kpi_avg: 'Avg Bill Value', kpi_lowstock: 'Low Stock Items',
      khata_title: '📒 Khata', khata_outstanding: 'Outstanding', khata_settled_heading: 'Settled',
      top_selling: '🏆 Top Selling Items', sales_overview: '📈 Sales Overview', low_stock_alerts: '⚠️ Low Stock Alerts',
      all_stocked: '✅ All items well-stocked!', recent_bills: '🕐 Recent Bills', receipt_title: '🧾 Receipt',
      print: '🖨️ Print', share_wa: '📲 Share (WhatsApp)', new_bill: '+ New Bill', settings_title: '⚙️ Settings',
      store_name: 'Store Name', owner_name: 'Owner Name', phone_upi: 'Phone / UPI', address: 'Address',
      gstin: 'GSTIN (optional)', data_management: '⚠️ Data Management', export_json: '📤 Export All Data (JSON)',
      import_data: '📥 Import Data', clear_all_data: '🗑️ Clear All Data', cancel: 'Cancel', save_settings: 'Save Settings',
      listening: 'Listening...', stop: 'Stop', product_name: 'Product Name', price: 'Price (₹)', stock: 'Stock',
      unit: 'Unit', category: 'Category', low_stock_alert: 'Low Stock Alert (below)', save_product: 'Save Product',
      khata_customer_title: '📒 Khata customer', khata_customer_hint: 'Enter the customer name to save this bill on their credit account.',
      customer_name: 'Customer Name', save_khata: 'Save to Khata', ph_product_name: 'e.g. Basmati Rice',
      ph_low_stock: 'e.g. 5', ph_customer_name: 'e.g. Ramesh', ph_store_name: 'My Kirana Store',
      ph_owner_name: 'Ramesh Gupta', ph_address: 'Shop No. 1, Main Market...', select_gst: 'Select GST rate',
      report_period: 'Report period', sales_chart: 'Sales bar chart',
      unit_piece: 'Piece', unit_kg: 'Kg', unit_gram: 'Gram', unit_litre: 'Litre', unit_ml: 'ml', unit_pack: 'Pack',
      unit_dozen: 'Dozen', unit_box: 'Box',
      my_store: 'My Store', bill: 'Bill', receipt_customer: 'Customer', receipt_item: 'Item',
      receipt_qty: 'Qty', receipt_rate: 'Rate', receipt_amt: 'Amount', gstin_label: 'GSTIN',
      thank_you: 'Thank you!', visit_again: 'Please visit again', thank_you_shop: 'Thank you for shopping!',
      method_cash: 'Cash', method_upi: 'UPI', method_credit: 'Khata', out_of_stock: 'Out of stock',
      stock_low: 'Low stock ({n})', out_badge: 'Out of stock', left_badge: '{n} {unit} left',
      qty_sold: '{n} sold', item_one: '1 item', item_many: '{n} items', due: 'Due',
      mark_all_paid: 'Mark all paid', mark_paid: 'Mark paid', paid: 'Paid',
      khata_empty_due: 'No outstanding credit', khata_empty_settled: 'No settled entries',
      no_sales_yet: 'No sales yet', no_bills_yet: 'No bills yet', low_stock_one: '{n} item is running low on stock',
      low_stock_many: '{n} items are running low on stock', added_to_bill: '{name} added to bill',
      item_added: '{name} added', item_out_of_stock: '{name} is out of stock', cart_empty_toast: 'Cart is empty',
      confirm_delete_product: 'Delete {name}?', product_deleted: '{name} deleted', edit_product: 'Edit Product',
      add_product: 'Add Product', err_product_name: 'Enter a product name', err_price: 'Enter a valid price',
      err_stock: 'Enter valid stock', err_customer_name: 'Enter a customer name', product_updated: '{name} updated',
      product_added: '{name} added', confirm_clear_bill: 'Clear this bill?', data_exported: 'Data exported',
      data_imported: 'Data imported', invalid_file: 'Invalid import file', settings_saved: 'Settings saved',
      confirm_clear_1: 'Delete all products, bills, and settings?', confirm_clear_2: 'This cannot be undone. Continue?',
      all_data_cleared: 'All data cleared', voice_error: 'Voice error: {err}', voice_hint: 'Try “add sugar” or “2 kg rice”',
      voice_unknown: 'Could not understand: {text}', voice_unsupported: 'Voice input is not supported in this browser',
      added_qty: '{name}: added {n}', khata_marked_paid: 'Payment marked as paid',
    },
    hi: {
      toggle_lang: 'हिंदी/अंग्रेज़ी बदलें', settings: 'सेटिंग्स', voice_search: 'आवाज़ से खोजें',
      nav_inventory: 'इन्वेंट्री', nav_billing: 'बिलिंग', nav_reports: 'रिपोर्ट',
      voice_add_bill: 'आवाज़ से बिल में जोड़ें', search_items: 'सामान खोजें...', search_bill: 'बिल में जोड़ने के लिए खोजें...',
      search_inventory: 'इन्वेंट्री खोजें', search_bill_aria: 'बिल में जोड़ने के लिए सामान खोजें',
      aria_add_product: 'नया सामान जोड़ें', filter_category: 'श्रेणी से फ़िल्टर करें', product_inventory: 'सामान की इन्वेंट्री',
      product_suggestions: 'सामान के सुझाव', cart_items: 'कार्ट के सामान', main_nav: 'मुख्य नेविगेशन',
      cat_all: 'सभी', cat_grains: 'अनाज', cat_dairy: 'डेयरी', cat_snacks: 'नाश्ता', cat_beverages: 'पेय',
      cat_spices: 'मसाले', cat_cleaning: 'सफाई', cat_other: 'अन्य', btn_add: '+ जोड़ें',
      empty_inventory_title: 'अभी कोई सामान नहीं', empty_inventory_sub: 'पहला सामान जोड़ने के लिए "+ जोड़ें" दबाएँ या 🎙️ बोलें',
      current_bill: '🧾 वर्तमान बिल', cart_empty_title: 'कार्ट खाली है', cart_empty_sub: 'ऊपर खोजें या सामान पर टैप करके जोड़ें',
      subtotal: 'उप-योग', gst: 'जीएसटी', gst_none: 'कोई नहीं (0%)', total: 'कुल', payment: 'भुगतान:',
      payment_method: 'भुगतान का तरीका', pay_cash: '💵 नकद', pay_upi: '📲 यूपीआई', pay_credit: '📒 उधार',
      clear_bill: '🗑️ साफ़ करें', finalize_bill: '✅ बिल पूरा करें', period_today: 'आज', period_week: 'इस सप्ताह',
      period_month: 'इस महीने', export: 'डेटा निर्यात करें', export_btn: '📤 निर्यात', kpi_sales: 'कुल बिक्री',
      kpi_bills: 'बनाए गए बिल', kpi_avg: 'औसत बिल मूल्य', kpi_lowstock: 'कम स्टॉक वाले सामान',
      khata_title: '📒 खाता', khata_outstanding: 'बाकी राशि', khata_settled_heading: 'निपटाए गए',
      top_selling: '🏆 सबसे ज़्यादा बिके सामान', sales_overview: '📈 बिक्री का विवरण', low_stock_alerts: '⚠️ कम स्टॉक चेतावनी',
      all_stocked: '✅ सभी सामान पर्याप्त स्टॉक में हैं!', recent_bills: '🕐 हाल के बिल', receipt_title: '🧾 रसीद',
      print: '🖨️ प्रिंट', share_wa: '📲 WhatsApp पर भेजें', new_bill: '+ नया बिल', settings_title: '⚙️ सेटिंग्स',
      store_name: 'दुकान का नाम', owner_name: 'मालिक का नाम', phone_upi: 'फ़ोन / UPI', address: 'पता',
      gstin: 'GSTIN (वैकल्पिक)', data_management: '⚠️ डेटा प्रबंधन', export_json: '📤 सारा डेटा निर्यात करें (JSON)',
      import_data: '📥 डेटा आयात करें', clear_all_data: '🗑️ सारा डेटा मिटाएँ', cancel: 'रद्द करें', save_settings: 'सेटिंग्स सहेजें',
      listening: 'सुन रहे हैं...', stop: 'रोकें', product_name: 'सामान का नाम', price: 'कीमत (₹)', stock: 'स्टॉक',
      unit: 'इकाई', category: 'श्रेणी', low_stock_alert: 'कम स्टॉक चेतावनी (इससे कम)', save_product: 'सामान सहेजें',
      khata_customer_title: '📒 खाता ग्राहक', khata_customer_hint: 'यह बिल उधार खाते में जोड़ने के लिए ग्राहक का नाम लिखें।',
      customer_name: 'ग्राहक का नाम', save_khata: 'खाते में सहेजें', ph_product_name: 'जैसे: बासमती चावल',
      ph_low_stock: 'जैसे: 5', ph_customer_name: 'जैसे: रमेश', ph_store_name: 'मेरी किराना दुकान',
      ph_owner_name: 'रमेश गुप्ता', ph_address: 'दुकान नंबर 1, मुख्य बाज़ार...', select_gst: 'जीएसटी दर चुनें',
      report_period: 'रिपोर्ट अवधि', sales_chart: 'बिक्री बार चार्ट',
      unit_piece: 'नग', unit_kg: 'किलो', unit_gram: 'ग्राम', unit_litre: 'लीटर', unit_ml: 'मिलीलीटर', unit_pack: 'पैक',
      unit_dozen: 'दर्जन', unit_box: 'डिब्बा',
      my_store: 'मेरी दुकान', bill: 'बिल', receipt_customer: 'ग्राहक', receipt_item: 'सामान',
      receipt_qty: 'मात्रा', receipt_rate: 'दर', receipt_amt: 'राशि', gstin_label: 'GSTIN',
      thank_you: 'धन्यवाद!', visit_again: 'फिर पधारें', thank_you_shop: 'खरीदारी के लिए धन्यवाद!',
      method_cash: 'नकद', method_upi: 'UPI', method_credit: 'उधार', out_of_stock: 'स्टॉक खत्म',
      stock_low: 'कम स्टॉक ({n})', out_badge: 'स्टॉक खत्म', left_badge: '{n} {unit} बाकी',
      qty_sold: '{n} बिके', item_one: '1 सामान', item_many: '{n} सामान', due: 'बाकी',
      mark_all_paid: 'सबका भुगतान', mark_paid: 'भुगतान करें', paid: 'भुगतान हुआ',
      khata_empty_due: 'कोई उधार बाकी नहीं', khata_empty_settled: 'कोई निपटा खाता नहीं',
      no_sales_yet: 'अभी कोई बिक्री नहीं', no_bills_yet: 'अभी कोई बिल नहीं', low_stock_one: '{n} सामान का स्टॉक कम है',
      low_stock_many: '{n} सामानों का स्टॉक कम है', added_to_bill: '{name} बिल में जोड़ा गया',
      item_added: '{name} जोड़ा गया', item_out_of_stock: '{name} का स्टॉक खत्म है', cart_empty_toast: 'कार्ट खाली है',
      confirm_delete_product: '{name} हटाएँ?', product_deleted: '{name} हटाया गया', edit_product: 'सामान संपादित करें',
      add_product: 'सामान जोड़ें', err_product_name: 'सामान का नाम लिखें', err_price: 'सही कीमत लिखें',
      err_stock: 'सही स्टॉक लिखें', err_customer_name: 'ग्राहक का नाम लिखें', product_updated: '{name} अपडेट हुआ',
      product_added: '{name} जोड़ा गया', confirm_clear_bill: 'यह बिल साफ़ करें?', data_exported: 'डेटा निर्यात हुआ',
      data_imported: 'डेटा आयात हुआ', invalid_file: 'अमान्य फ़ाइल', settings_saved: 'सेटिंग्स सहेजी गईं',
      confirm_clear_1: 'सारे सामान, बिल और सेटिंग्स मिटाएँ?', confirm_clear_2: 'यह वापस नहीं हो सकता। जारी रखें?',
      all_data_cleared: 'सारा डेटा मिट गया', voice_error: 'आवाज़ त्रुटि: {err}', voice_hint: '“चीनी जोड़ें” या “2 किलो चावल” बोलें',
      voice_unknown: 'समझ नहीं आया: {text}', voice_unsupported: 'इस ब्राउज़र में आवाज़ सुविधा उपलब्ध नहीं है',
      added_qty: '{name}: {n} जोड़े गए', khata_marked_paid: 'भुगतान पूरा चिह्नित हुआ',
    },
  },

  init() {
    const settings = DB.getSettings();
    this.current   = settings.language || 'en';
    this.updateToggleBtn();

    document.getElementById('btn-lang-toggle').addEventListener('click', () => {
      this.current = this.current === 'en' ? 'hi' : 'en';
      DB.saveSettings({ ...DB.getSettings(), language: this.current });
      this.updateToggleBtn();
      showToast(this.current === 'hi' ? 'हिंदी में बदला गया ✅' : 'Switched to English ✅', 'info');
      this.apply();
      Inventory.render();
      Reports.render();
    });
    this.apply();
  },

  updateToggleBtn() {
    document.getElementById('btn-lang-toggle').textContent = this.current === 'en' ? 'EN' : 'हिं';
  },

  t(key, vars = {}) {
    const value = this.translations[this.current]?.[key] ?? this.translations.en[key] ?? key;
    return String(value).replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? `{${name}}`);
  },

  apply() {
    document.documentElement.lang = this.current === 'hi' ? 'hi' : 'en';
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = this.t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = this.t(el.dataset.i18nPlaceholder); });
    document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = this.t(el.dataset.i18nTitle); });
    document.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', this.t(el.dataset.i18nAria)); });
  },
};

/* ──────────────────────────────────────────────
   14. PWA — Service Worker Registration
────────────────────────────────────────────── */
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('[KiranaKit] SW registered', reg.scope))
      .catch(err => console.warn('[KiranaKit] SW registration failed', err));
  }
}

/* ──────────────────────────────────────────────
   15. SEED DATA  (first-run demo products)
────────────────────────────────────────────── */
function seedDemoData() {
  if (DB.getProducts().length > 0) return; // already has data

  const demoProducts = [
    { name: 'Basmati Rice',    price: 80,  stock: 50, unit: 'kg',    category: 'grains',    lowThreshold: 10 },
    { name: 'Whole Wheat Atta',price: 45,  stock: 30, unit: 'kg',    category: 'grains',    lowThreshold: 5  },
    { name: 'Amul Full Cream', price: 68,  stock: 20, unit: 'litre', category: 'dairy',     lowThreshold: 5  },
    { name: 'Parle-G Biscuits',price: 10,  stock: 100,unit: 'piece', category: 'snacks',    lowThreshold: 20 },
    { name: 'Tata Salt',       price: 22,  stock: 3,  unit: 'kg',    category: 'spices',    lowThreshold: 5  },
    { name: 'Surf Excel',      price: 55,  stock: 15, unit: 'piece', category: 'cleaning',  lowThreshold: 5  },
    { name: 'Tata Tea Gold',   price: 120, stock: 0,  unit: 'pack',  category: 'beverages', lowThreshold: 3  },
    { name: 'Yellow Moong Dal',price: 110, stock: 12, unit: 'kg',    category: 'grains',    lowThreshold: 5  },
  ];

  demoProducts.forEach(p => DB.addProduct(p));
}

/* ──────────────────────────────────────────────
   16. APP INIT
────────────────────────────────────────────── */
function initApp() {
  // Load settings
  const settings = DB.getSettings();
  document.getElementById('store-name').textContent = settings.storeName || 'My Store';

  // Seed demo data on first run
  seedDemoData();

  Lang.init();
  KhataModal.init();

  // Initialize all modules
  Nav.init();
  Inventory.init();
  ProductModal.init();
  Billing.init();
  Receipt.init();
  Reports.init();
  Settings.init();
  Voice.init();

  // PWA
  registerSW();
}

/* ──────────────────────────────────────────────
   17. SPLASH → APP TRANSITION
────────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const splash = document.getElementById('splash');
    const app    = document.getElementById('app');

    splash.style.transition = 'opacity 0.4s ease';
    splash.style.opacity    = '0';

    setTimeout(() => {
      splash.classList.add('hidden');
      app.classList.remove('hidden');
      initApp();
    }, 400);
  }, 1300); // Show splash for ~1.3s
});
