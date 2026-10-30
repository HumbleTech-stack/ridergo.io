# RiderGo — Riders for riders

A multi-tenant ride-hailing, delivery and food marketplace, built for **motorbike riders first** (also cars), in the
red mobile UI from the design brief, with the RiderGo kente emblem as the rider identity everywhere.

* **Customers** (free) book motorbike, car or tricycle rides, order food/groceries/essentials, and track everything live.
* **Providers** (paid, monthly) sign up as a **Motorbike rider**, **Car driver**, **Tricycle driver** or **Food vendor**. Each provider is a **tenant**
  with a private workspace and pays a monthly subscription through **Paystack**.
* **Platform admin** manages tenants, plans/prices, safety reports, SOS alerts, legacy payout records and promo codes.

No build step and **zero npm dependencies** — it uses Node 22's built-in `node:sqlite`. You do not need to run `npm install` or use npm on the server.

## Run it

```bash
node --version                   # needs 22.13 or newer
node --no-warnings scripts/demo.js  # seeds demo data and starts on http://localhost:3000
```

Demo logins (password `demo123`): `alex@demo.com` (customer) · `kwame@demo.com`, `ama@demo.com` (motor riders) ·
`yaw@demo.com` (car driver) · `mama@demo.com` (vendor with her own rider `kojo@demo.com`).
Admin: `admin@ridergo.app` / `admin123` (set `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env`).

## Live server

Deploy this project to a host that supports Node.js 22.13 or newer. From the project root, copy `.env.example` to `.env`,
set a strong `JWT_SECRET` and `ADMIN_PASSWORD`, set `APP_URL` to the public HTTPS URL, then start the server directly:

```bash
cp .env.example .env
node --no-warnings server/index.js
```

The server listens on `PORT` (default `3000`). Configure the hosting provider or reverse proxy to route public HTTPS traffic
to that port, and configure its process supervisor to run `node --no-warnings server/index.js` and restart the process if it
exits. The process must be able to write to `data/` (SQLite database) and `uploads/`. Keep `.env` private and do not use
demo credentials or demo mode for a live deployment. No `npm install`, build step, or `node_modules` directory is required.

The `npm` scripts in `package.json` are optional local shortcuts only. To run tests without npm, use
`node --no-warnings test/e2e.js` (end-to-end checks for signup, subscriptions, rides, dispatch, and earnings).

## Provider profiles

Rider, car-driver, and tricycle-driver sign-up requires a PNG, JPG or WebP profile photo (maximum 3 MB). Existing provider accounts
without a photo can sign in, but must upload one from **Account → Profile** before using provider features. Vendors can
optionally add a personal photo from their account profile; their shop logo and cover image remain editable separately
under **Shop profile**. Vendors must also provide a photo when adding a team rider.

## Deploy publicly with Render

This repository includes a Render Blueprint in `render.yaml`. It runs the server directly with Node (no npm install or build
step) and mounts a persistent disk for the SQLite database and uploaded images. The Blueprint uses Render's Starter plan
because persistent disks are required; do not remove the disk or store production data in the temporary filesystem.

1. Push this project to a GitHub repository and sign in to [Render](https://render.com/).
2. In Render, choose **New → Blueprint**, connect the repository, and select `render.yaml`.
3. Before the first successful deploy, set the Blueprint's `APP_URL` to the HTTPS URL Render assigns to the service
   (for example, `https://ridergo.onrender.com`), and set `ADMIN_EMAIL` and a unique `ADMIN_PASSWORD` of at least
   12 characters in the service's **Environment** settings. Render generates `JWT_SECRET` automatically. If Render
   creates the service before you can enter these values, set them in **Environment** and redeploy; the app intentionally
   refuses to start in production without safe values.
4. Deploy. Once it is live, open the Render URL from any internet-connected phone or computer.
5. Sign in to the Admin area using the admin email and password configured for deployment. Do not use demo accounts.

If the service URL changes, update `APP_URL` in the Render dashboard to match the new HTTPS URL and redeploy. The app starts
in payment mock mode until Paystack keys are configured. Back up the persistent disk regularly; it contains the database
and user-uploaded images. Keep the disk mounted at `/var/data` so both remain available after restarts and deployments.

## Paystack

Without keys RiderGo runs in **test mode** with a built-in fake checkout page, so everything can be tried safely.
For real payments:

1. Put `PAYSTACK_SECRET_KEY` (and `PAYSTACK_PUBLIC_KEY`) in `.env`.
2. In the Paystack dashboard set the webhook URL to `https://YOUR-DOMAIN/api/payments/webhook`.
3. Set `APP_URL` to your public URL (Paystack redirects back to `/pay/return`).
4. In **Admin → Plans**, press **Sync to Paystack** once per plan. Subscribers then renew automatically every month.

What is wired up: hosted checkout (card / Mobile Money / bank), server-side `verify` (the redirect is never trusted),
HMAC-SHA512 webhook signature check, recurring plan subscriptions with auto-renew and cancel, and refunds when a paid order
is rejected/cancelled. Currency defaults to GHS (`CURRENCY` in `.env`).

## How multi-tenancy works

* A **tenant** = one paying business: a solo rider, car driver, tricycle driver, or vendor shop. Every provider-owned row
  (menu, orders, wallet ledger, payouts, staff riders) carries a `tenant_id`.
* The tenant is always taken from the logged-in user's token, **never from the request body** — one vendor cannot read or edit another's menu or orders (covered by tests).
* A tenant can only operate while its subscription is **active**: riders/drivers can't go online and vendors disappear from search when it lapses; `past_due` is set automatically when the month ends.
* Vendor plans include **rider seats**: a vendor adds their own riders (they sign in with the details the vendor sets, and are covered by the vendor's subscription).

## What's built (from the brief)

| Area | Features |
|---|---|
| Rides | Bolt-style booking: From / Where to, pick on map or search, **motorbike, car or tricycle** clearly labelled, upfront fare measured along real roads (OSRM) so nobody can be cheated, promo codes, cash or Paystack |
| Dispatch | Request is broadcast to the **closest** matching riders first, widens the radius if nobody accepts; **first accept wins** and the request vanishes from every other rider's screen; decline supported |
| Safety | Secret 4-digit **ride PIN**; motor trips can't start until the rider confirms **helmet & protective gear**; SOS button; ratings, reports, admin can block users; live location shared only once a rider is assigned |
| Food & shops | Vendors publish menus + photos, appear on the **map**; customers search dishes/vendors, see **most-rated first**, favourites, pickup or delivery, distance-based delivery fee added automatically |
| Delivery handover | Vendor assigns **their own rider or broadcasts**; a random **delivery code** goes to the customer; rider must be told it at the door; customer sees animated "Order approved", "Rider assigned", "Your order has arrived" moments and the rider live on the map |
| Earnings | Provider dashboards show completed-job earnings for today, the last seven days, this month, and all time; online-paid work is credited to the wallet after `COMMISSION_PCT`, while cash rides are collected directly |
| Admin | MRR, tenants (suspend / reinstate / grant days), plans & prices, Paystack sync, reports, SOS, payouts, payments, promos |

## Layout

```
server/   http.js (tiny router) · db.js (schema) · routes/* · paystack.js · payments.js · dispatch.js · pricing.js · sse.js
public/   index.html · css/app.css · js/ (core, shell, map, picker, views/*) — plain ES modules, installable PWA
test/     e2e.js — boots the server on a temp DB and drives the real HTTP + SSE API
```

Maps use Leaflet + Esri World Imagery satellite tiles loaded from unpkg; if Leaflet can't load the app falls back to a
simple built-in map. Satellite imagery is credited to Esri, Maxar, Earthstar Geographics, and the GIS User Community.
Place search and routing use public OpenStreetMap services (Nominatim / OSRM) — for heavy production traffic point `OSRM_URL`
at your own server.
