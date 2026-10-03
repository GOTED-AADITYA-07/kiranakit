# CURSOR HANDOFF — KiranaKit 🏪

> **Read this first.** This doc tells you exactly what's built, what's missing, and where to start.

---

## Project

**KiranaKit** — Voice + text inventory & billing PWA for Indian kirana/small retail stores.  
**Stack:** Vanilla HTML + CSS + JS. No framework. No build step. Just open `index.html` in a browser.  
**Data:** 100% `localStorage` — no backend, no auth, works offline.

---

## File Structure

```
kiranakit/
├── index.html          ✅ DONE — Full app shell, all 3 tabs, all modals
├── style.css           ✅ DONE — Complete design system (dark saffron theme)
├── app.js              ✅ DONE — All core logic (see module list below)
├── manifest.json       ✅ DONE — PWA manifest
├── sw.js               ✅ DONE — Service worker (offline cache)
└── CURSOR_HANDOFF.md   ← you are here
```

---

## What's Already Built (app.js modules)

| # | Module | Status | Description |
|---|--------|--------|-------------|
| 1 | `DB` | ✅ Done | localStorage CRUD for products, bills, settings |
| 2 | `Utils` | ✅ Done | formatCurrency, dates, search, export, stockStatus |
| 3 | `Nav` | ✅ Done | Tab switching with ARIA |
| 4 | `Inventory` | ✅ Done | List, search, filter by category, low-stock banner, card render |
| 5 | `ProductModal` | ✅ Done | Add/edit product form modal |
| 6 | `Billing` | ✅ Done | Cart, qty controls, GST select, payment method, finalize |
| 7 | `Receipt` | ✅ Done | Thermal receipt render, WhatsApp share text |
| 8 | `Reports` | ✅ Done | KPI cards, top products, low-stock list, recent bills, bar chart |
| 9 | `Settings` | ✅ Done | Store name, owner, phone, address, GSTIN, import/export/clear |
| 10 | `Voice` | ✅ Done | Web Speech API, command parser (add item, qty + name, new item) |
| 11 | `Lang` | 🟡 Stub | EN/हिं toggle exists, but **translations not applied yet** |
| 12 | PWA | ✅ Done | SW registered, manifest linked |
| 13 | Seed data | ✅ Done | 8 demo products on first launch |

---

## What Cursor Needs To Do (TODO list)

### 🔴 Priority 1 — Must Fix / Complete

- [x] **Hindi translations** — Implemented with English/Hindi dictionaries and `data-i18n` updates for text, placeholders, titles, and ARIA labels.
  
- [x] **Print receipt CSS** — Receipt print output is isolated to a 72mm thermal layout with mono font and no shadow.

- [ ] **Bill number persistence** — `DB_KEYS.billCount` in `app.js` is saved to localStorage correctly. But on fresh install after `clearAllData()`, verify it resets to 0. Test this flow.

### 🟡 Priority 2 — Nice to Have

- [ ] **Swipe to delete cart item** — Add touch swipe-left gesture on `.cart-item` to reveal a delete button. Use `touchstart`/`touchmove`/`touchend` events.

- [ ] **Stock restock flow** — In the inventory card, add a quick "+Stock" button that opens a small input to add quantity without opening the full edit modal.

- [x] **Khata (credit) tracking** — Credit checkout prompts for a customer, stores debt records, and exposes due/settled entries in Reports.

- [ ] **Product image / emoji picker** — Currently using category emoji from `CATEGORY_EMOJI` map. Let user pick a custom emoji per product. Add an emoji picker to the product form.

- [ ] **Hindi voice recognition** — In `Voice.init()`, `recognition.lang = 'en-IN'`. Change to `'hi-IN'` and test. The command parser in `Voice.processCommand()` would need Hindi keyword support.

- [ ] **Barcode scan** — Use `BarcodeDetector` API or `QuaggaJS` library to scan product barcodes via camera. Hook into product add form to auto-fill name.

### 🟢 Priority 3 — Polish

- [ ] **Animated stock counter** — When stock changes (after finalizing bill), animate the number counting down on the inventory card.

- [ ] **PWA install prompt** — Listen for `beforeinstallprompt` event and show a custom "Add to Home Screen" banner instead of browser default.

- [ ] **Dark/light mode toggle** — All CSS vars are in `:root`. Just add a `[data-theme="light"]` override block with light palette vars and toggle the attribute on `<html>`.

- [ ] **Rupee input formatting** — Auto-format price inputs with commas (e.g. `₹1,200.00`) using `Intl.NumberFormat`.

---

## Key Code Locations

```
app.js
├── Line ~1    — CONSTANTS & DB_KEYS
├── Line ~30   — DB (data layer) — all localStorage ops here
├── Line ~130  — Utils — helpers
├── Line ~175  — showToast()
├── Line ~190  — Nav.init() — tab switching
├── Line ~215  — Inventory module
├── Line ~320  — ProductModal
├── Line ~380  — Billing module (cart, totals, finalize)
├── Line ~520  — Receipt module (thermal render, WhatsApp)
├── Line ~590  — Reports module (KPIs, chart, low-stock)
├── Line ~710  — Settings module
├── Line ~775  — Voice module ← lang='en-IN', command parser here
├── Line ~840  — Lang module ← TODO: translations go here
├── Line ~860  — PWA SW registration
├── Line ~870  — seedDemoData() — 8 demo kirana products
└── Line ~895  — initApp() + splash transition
```

---

## How to Run

Just open `index.html` in Chrome. No npm, no build step.

```bash
# Option 1: Direct open
start index.html

# Option 2: Local server (needed for SW to work)
npx -y serve .
# then open http://localhost:3000
```

> ⚠️ Service worker only registers on `localhost` or `https://`. For full PWA features, use `npx serve .`

---

## Design System Quick Ref

All colors/spacing are CSS custom properties in `style.css :root`:

| Token | Value | Use |
|-------|-------|-----|
| `--accent` | `#ff6b35` | Saffron orange — primary CTA |
| `--bg-base` | `#0f0f1a` | Page background |
| `--bg-card` | `#1e1e34` | Card backgrounds |
| `--success` | `#4caf7d` | In-stock, positive |
| `--warning` | `#ffb347` | Low stock |
| `--danger` | `#ff5252` | Out of stock, delete |

---

## Prompt to give Cursor

> "Read `CURSOR_HANDOFF.md`. The KiranaKit app is fully built — open `index.html` in browser to see it. Your job is to implement the Hindi translation system in `app.js` Lang module using a `TRANSLATIONS` object, add `data-i18n` attributes to `index.html` elements, and implement the Khata (credit customer) tracking feature. Start with Hindi translations."
