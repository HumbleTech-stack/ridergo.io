'use strict';
const fs = require('fs');
const path = require('path');

// Minimal .env loader (no dependencies)
const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}
const env = (k, d) => (process.env[k] !== undefined && process.env[k] !== '' ? process.env[k] : d);

const config = {
  port: +env('PORT', 3000),
  appUrl: env('APP_URL', 'http://localhost:' + env('PORT', 3000)).replace(/\/$/, ''),
  jwtSecret: env('JWT_SECRET', 'dev-only-secret-change-me'),
  currency: env('CURRENCY', 'GHS'),
  countryCodes: env('COUNTRY_CODES', 'gh'),
  defaultCenter: { lat: +env('DEFAULT_LAT', 5.6037), lng: +env('DEFAULT_LNG', -0.187) },
  paystack: {
    secret: env('PAYSTACK_SECRET_KEY', ''),
    publicKey: env('PAYSTACK_PUBLIC_KEY', ''),
    get live() { return /^sk_(test|live)_/.test(this.secret); },
  },
  commissionPct: +env('COMMISSION_PCT', 5),
  trialDays: +env('TRIAL_DAYS', 0),
  osrmUrl: env('OSRM_URL', 'https://router.project-osrm.org').replace(/\/$/, ''),
  dbFile: env('DB_FILE', path.join(__dirname, '..', 'data', 'ridergo.db')),
  uploadsDir: env('UPLOADS_DIR', path.join(__dirname, '..', 'uploads')),
  publicDir: path.join(__dirname, '..', 'public'),
  // dispatch: search radii (km) tried in order, seconds each ring waits for an accept
  dispatch: {
    radii: [3, 7, 15],
    ringSeconds: +env('DISPATCH_RING_SECONDS', 25),
    locFreshMs: 3 * 60 * 1000,
  },
};

if (process.env.NODE_ENV === 'production') {
  const missing = ['JWT_SECRET', 'APP_URL', 'ADMIN_EMAIL', 'ADMIN_PASSWORD']
    .filter((key) => !process.env[key]?.trim());
  if (missing.length) {
    throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
  }
  if (config.jwtSecret.startsWith('dev-only') || config.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be a unique secret of at least 32 characters in production');
  }
  if (process.env.ADMIN_PASSWORD.length < 12 || process.env.ADMIN_PASSWORD === 'admin123') {
    throw new Error('ADMIN_PASSWORD must be at least 12 characters and not use the demo password in production');
  }
  if (new URL(config.appUrl).protocol !== 'https:') {
    throw new Error('APP_URL must use HTTPS in production');
  }
  if (process.env.DEMO === '1') {
    throw new Error('Demo mode must not be enabled in production');
  }
}

module.exports = config;
