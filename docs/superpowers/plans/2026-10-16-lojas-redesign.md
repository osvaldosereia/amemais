# CDSB Lojas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Each deliverable starts with a failing test and ends with automated verification.

**Goal:** Replace duplicated store/order pages with usable per-unit workflows for owned stores, franchises and temporary stores, preserving inventory and without recording sales.

**Architecture:** Keep the vanilla JS app + Supabase existing database/RPC; isolate pure UI/card rendering in `src/store-hub.js`, per-unit details in a new `src/store-unit.js`, temporary workflow in `src/event-simple.js` and event-lot list in `src/event-lots.js`. Wire navigation and derived metrics in `src/app.js`. Do not migrate schema.

**Tech Stack:** Native ES modules, CSS, Node test runner, Supabase JS.

**Spec:** `docs/superpowers/specs/2026-10-16-cdsb-lojas-redesign-design.md`

## Global Constraints
- Preserve unique order flow, no batches within orders and no sales.
- CDSB is not a commercial store; Cristo Rei and franchises are.
- Derived stock quantities must come from existing confirmed balances.
- Preserve RBAC and server-side RPCs, no direct new stock mutation.
- Responsive at 360, 390, 768, 1024 and desktop; no 57mm claim until ready.
- Keep existing data and previous logs; no destructive migrations.

## Review Focus
- Unknown or inactive stores, malformed names and absent metadata must not create unsafe HTML or invalid route.
- Franchise account access must never cross-associate a different franchise.
- Mixed event-order and store-order statuses must not be interpreted as the same unit status.
- A return to a unit from an order must restore that unit even if the order entry was contextual.
- Legacy event plans must not be mixed with active independent requests.

---

### Task 1: List component and indicators
**Files:** `src/store-hub.js`, `store-hub.css`, `tests/store-hub-redesign.test.mjs`
**Interfaces:** `renderStoreHub({stores,events,orders,context})` with `context.storeBalances`, `context.eventBalances`, filter state `context.filter`. `renderStoreUnitCard` pure.
- [ ] Write a failing test: cards have single "Abrir unidade", no embedded pedido rows, correct unit and count, filters and escaping.
- [ ] Observe failure on original module.
- [ ] Implement compact cards/filters and accessible menu with responsive CSS.
- [ ] Run tests and commit.

### Task 2: Unit pages and navigation
**Files:** `src/store-unit.js` (new), `src/app.js`, `tests/store-unit.test.mjs`
**Interfaces:** `renderStoreUnit({store,orders,balances,returns,movements,context})`; `state.activeStore`, `state.activeStoreTab`, `state.storeHubFilter`.
- [ ] Write failing tests for unit tabs, no fake franchise physical stock, and safe actions.
- [ ] Implement type-specific overview/tabs and actions using existing handlers.
- [ ] Wire entry, contextual order opening, restoration and admin tools; test view-switch.
- [ ] Validate app JS parsing/CI and commit.

### Task 3: Temporary unit flow
**Files:** `src/event-simple.js`, `src/event-lots.js`, `src/app.js`, `tests/temporary-unit-redesign.test.mjs`
**Interfaces:** event detail model reuses existing eventCompactDetail with a presentation mode; no new sale fields.
- [ ] Write failing tests: no false zero legacy plan, correct separated labels, compact cover, tabular event detail, no sales classification.
- [ ] Replace legacy plan section with actual independent order list and compact information hierarchy.
- [ ] Ensure closure requires reconciliation via existing RPС, not new bookkeeping; test and commit.

### Task 4: Mobile and regression coverage
**Files:** `store-hub.css`, `temporary-stores-simple.css`, `index.html`, `src/secure-entry.js`; test files.
- [ ] Write failing integration assertions on module assets/context links and no horizontal overflow CSS definitions.
- [ ] Finalize touch-friendly layout and asset cache busts.
- [ ] Run `node --test tests/*.test.mjs` and `node --check src/app.js` through GitHub Actions; investigate all failures.
- [ ] Document any remaining gaps; commit.

### Task 5: Release
- [ ] Review diff for permissions and unintended stock mutations.
- [ ] Create PR into main, wait for CI green, merge only if all regressions pass.
- [ ] Confirm main contains assets and rollout status, report any untested browser details.
