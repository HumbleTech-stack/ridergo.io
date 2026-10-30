// Subscription (Paystack), payment return handling, and earnings insights.
import { S, GET, POST, html, raw, $, $$, icon, money, actions, onSubmit, toast, celebrate, confirmSheet, loadMe, when, homeFor } from '../core.js';
import { layout, topbar, statusBadge } from '../shell.js';
import { planFeatures, daysLeft, fmtDate, empty } from '../components.js';

const nav = (id) => (['rider', 'driver', 'vendor'].includes(S.me.user.role) ? id : null);
const wide = () => S.me.user.role === 'vendor';

export async function billing({ query }) {
  let b;
  const el = layout(html`<div class="page">${topbar('Subscription')}<div id="bl"><div class="skeleton"></div><div class="skeleton"></div></div></div>`, { nav: nav('billing'), wide: wide() });
  try { b = await GET('/billing'); } catch (e) { $('#bl', el).innerHTML = html`<div class="alert red">${e.message}</div>`.s; return; }
  const t = b.tenant; let selected = t.plan.id;
  const serviceType = t.service_type || t.type;
  const label = { rider: 'Motorbike rider', driver: 'Car driver', tricycle: 'Tricycle driver', vendor: 'Food vendor' }[serviceType];

  const draw = () => {
    const sel = b.plans.find((p) => p.id === selected) || b.plans[0];
    const renewing = t.active && selected === t.plan.id;
    $('#bl', el).innerHTML = html`
      ${query.welcome ? html`<div class="alert green mb">${icon('check', 20)}<span><b>Welcome to RiderGo, ${S.me.user.name.split(' ')[0]}!</b><br>Your ${label.toLowerCase()} workspace is ready. Choose a plan and pay once to go live — every month after that renews on the same day.</span></div>` : ''}
      <div class="card sub-card ${t.active ? 'on' : ''}">
        <div class="row between"><div><small class="muted">${t.name}</small><h2>${t.plan.name} plan</h2></div>${statusBadge(t.status)}</div>
        ${t.active ? html`<p class="mt-s">${icon('check', 18)} Active until <b>${fmtDate(t.period_end)}</b> · ${daysLeft(t.period_end)} days left</p><p class="small muted">${t.recurring && t.auto_renew ? 'Renews automatically with Paystack.' : t.auto_renew ? 'Pay again before it ends to keep working.' : 'Auto-renewal is off — you keep access until the end date.'}</p>`
          : t.status === 'suspended' ? html`<p class="mt-s red-t">Your account was suspended. Contact RiderGo support.</p>`
          : html`<p class="mt-s">${t.status === 'past_due' ? 'Your subscription has expired.' : 'Your subscription is not active yet.'} You ${serviceType === 'vendor' ? "won't appear to customers" : "can't go online"} until you subscribe.</p>`}
      </div>
      ${!b.owner ? html`<div class="alert mt">Your account is part of <b>${t.name}</b>. The business owner manages billing.</div>` : html`
        <h3 class="mt">${t.active ? 'Change or renew plan' : 'Choose your plan'}</h3>
        <div class="plans mt-s" role="radiogroup" aria-label="Plans">${b.plans.map((p) => html`<button class="plan ${selected === p.id ? 'on' : ''}" data-act="plan" data-id="${p.id}" role="radio" aria-checked="${selected === p.id}">
          <b>${p.name}</b><div class="price">${money(p.amount)} <small>/ month</small></div>
          <ul>${planFeatures(p.features).map((f) => html`<li>${f}</li>`)}</ul>${serviceType === 'vendor' ? html`<small class="muted">Includes ${p.seats} rider seat${p.seats > 1 ? 's' : ''}</small>` : ''}</button>`)}</div>
        ${b.mock ? html`<div class="alert mt">${icon('alert', 18)}<span><b>Test mode.</b> No Paystack key is configured, so checkout is simulated and no real money moves. Add <code>PAYSTACK_SECRET_KEY</code> to <code>.env</code> to go live.</span></div>` : ''}
        <button class="btn block mt" data-act="pay">${icon('card', 20)} ${renewing ? 'Renew now' : 'Pay'} ${money(sel.amount)} with Paystack</button>
        <p class="xs muted center mt-s">${icon('lock', 13)} Secure checkout by Paystack · Card, Mobile Money or bank. Cancel auto-renewal any time.</p>
        ${t.active && t.auto_renew ? html`<button class="btn link block" data-act="cancel">Turn off auto-renewal</button>` : ''}
        <section class="section"><h3>Payment history</h3>${b.payments.length ? html`<div class="card flat scroll-x mt-s"><table class="table"><thead><tr><th>Date</th><th>Amount</th><th>Status</th><th>Reference</th></tr></thead><tbody>${b.payments.map((p) => html`<tr><td>${when(p.created_at)}</td><td>${money(p.amount)}</td><td><span class="badge ${p.status === 'success' ? 'green' : p.status === 'pending' ? 'amber' : 'gray'}">${p.status}</span></td><td class="xs muted">${p.reference}</td></tr>`)}</tbody></table></div>` : html`<p class="muted small">No payments yet.</p>`}</section>`}`.s;
  };
  actions(el, {
    plan: (b2) => { selected = +b2.dataset.id; draw(); },
    pay: async () => { const c = await POST('/billing/checkout', { plan_id: selected }); location.href = c.authorization_url; },
    cancel: async () => { if (await confirmSheet('Turn off auto-renewal?', 'You keep access until the end of the month you already paid for.', 'Turn off', true)) { const r = await POST('/billing/cancel'); toast(r.message, 'ok', 5000); billing({ query: {} }); } },
  });
  draw();
}

/** Where Paystack (or the mock checkout) sends the browser back to. We always re-verify server-side. */
export async function payReturn({ query }) {
  const ref = query.reference || query.trxref;
  const el = layout(html`<div class="page"><div class="empty"><div class="radar big"><i></i><i></i><i></i><span>${icon('card', 26)}</span></div><h3>Confirming your payment…</h3><p class="muted">This only takes a moment.</p></div></div>`);
  if (!ref) { location.hash = '#/'; return; }
  let p = null;
  for (let i = 0; i < 6; i++) {
    try { p = await GET('/payments/verify?reference=' + encodeURIComponent(ref)); } catch (e) { p = { status: 'error', error: e.message }; }
    if (p.status !== 'pending') break;
    await new Promise((r) => setTimeout(r, 1800));
  }
  if (p.status === 'success') {
    await loadMe();
    if (p.kind === 'subscription') { celebrate('Subscription active!', 'You are live on RiderGo for the next 30 days.', 'shield'); location.hash = '#' + homeFor(S.me.user.role); }
    else if (p.kind === 'order') { toast('Payment received', 'ok'); location.hash = '#/order/' + p.ref_id; }
    else if (p.kind === 'ride') { toast('Payment received', 'ok'); location.hash = '#/trip/' + p.ref_id; }
    else location.hash = '#/';
    return;
  }
  layout(html`<div class="page"><div class="empty"><span class="art">${p.status === 'pending' ? '⏳' : '😕'}</span><h3>${p.status === 'pending' ? 'Still waiting for confirmation' : 'Payment not completed'}</h3><p class="muted">${p.error || (p.status === 'pending' ? 'If you were charged, it will update shortly.' : 'You have not been charged. You can try again.')}</p>
    <a class="btn" href="#${p.kind === 'order' ? '/order/' + p.ref_id : p.kind === 'ride' ? '/trip/' + p.ref_id : '/billing'}">Continue</a></div></div>`);
}

export async function wallet() {
  const el = layout(html`<div class="page">${topbar('Earnings')}<div id="wl"><div class="skeleton"></div></div></div>`, { nav: nav('wallet'), wide: wide() });
  let w, stats;
  try {
    [w, stats] = await Promise.all([
      GET('/wallet'),
      GET(S.me.user.role === 'vendor' ? '/vendor/stats' : '/provider/earnings'),
    ]);
  } catch (e) { $('#wl', el).innerHTML = html`<div class="alert">${S.me.tenant && !S.me.tenant.is_owner ? 'Earnings from your deliveries are paid to ' + S.me.tenant.name + '.' : e.message}</div>`.s; return; }
  const draw = () => {
    $('#wl', el).innerHTML = html`<div class="dash"><div>
      <div class="card wallet-card"><small>Wallet balance</small><div class="big-fare light">${money(w.balance)}</div><small>Online payments credited after platform fees. Cash collected directly is not included in this balance.</small></div>
      <h3 class="mt">Completed work &amp; earnings</h3>
      <div class="stats earnings-stats mt-s">
        <div class="stat"><div class="n">${money(stats.total.earned)}</div><div class="l">All-time · ${stats.total.tasks} completed</div></div>
        <div class="stat"><div class="n">${money(stats.today.earned)}</div><div class="l">Today · ${stats.today.tasks} completed</div></div>
        <div class="stat"><div class="n">${money(stats.week.earned)}</div><div class="l">Last 7 days · ${stats.week.tasks} completed</div></div>
        <div class="stat"><div class="n">${money(stats.month.earned)}</div><div class="l">This month · ${stats.month.tasks} completed</div></div>
      </div>
      <h3 class="mt">History</h3>
      ${w.ledger.length ? html`<div class="card flat mt-s">${w.ledger.map((l) => html`<div class="row between gap line"><span class="grow"><b class="small">${l.note || l.kind}</b><small class="muted block">${when(l.created_at)}</small></span><b class="${l.amount < 0 ? 'red-t' : 'green-t'}">${l.amount < 0 ? '−' : '+'}${money(Math.abs(l.amount))}</b></div>`)}</div>` : empty('💰', 'No wallet activity yet', 'Online payments from completed trips and orders appear here.')}</div>
      <div class="card earnings-tip"><div class="row gap"><span class="pl-ic">${icon('chart', 20)}</span><div><b>Keep your momentum</b><p class="small muted mt-s">${S.me.user.role === 'vendor' ? 'Keep your menu and opening hours current so nearby customers can find your shop.' : 'Go online when you are ready to accept new requests and complete more trips.'}</p></div></div></div>
    </div>`.s;
  };
  draw();
}
