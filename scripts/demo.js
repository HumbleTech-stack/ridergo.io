'use strict';
// One-command demo: creates demo data (if missing) and starts RiderGo with demo riders kept online.
// Works on Windows, macOS and Linux: node --no-warnings scripts/demo.js
process.env.DEMO = '1';
require('../server/seed').seedDemo();
require('../server/index');
