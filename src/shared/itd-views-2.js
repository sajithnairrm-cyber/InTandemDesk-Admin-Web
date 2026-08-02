/* Extracted from InTandemDesk_11_2.html by the 2026-07-31 refactor.
   Shared by the admin and staff builds — edit here, never in a built copy. */
/* ============================================================
   InTandem Desk — views (part 2)
   Vendors · Ledger · Staff · Reports · Settings
   ============================================================ */
(function (App) {
  'use strict';
  const { $, $$, D, Derive, money, percent, shortDate, monthLabel, esc } = App;
  const settleBar = App._settleBar, chart = App._chart, themeColors = App._themeColors, rgba = App._rgba;

  /* ── VENDORS ──────────────────────────────────────────── */
  const vendors = {
    state: { q: '', filter: 'all' },
    mount() {
      /* First run: no vendor accounts yet. */
      if (!D.vendors.length) {
        $('#page-vendors').innerHTML = `
          <div class="phead"><div><p class="eyebrow">Vendor accounts</p><h1>Vendors &amp; payments</h1>
            <p class="phead__sub">No vendor accounts yet</p></div></div>
          ${App.empty('No vendors available.', {
            icon: 'fa-building',
            hint: 'Vendor accounts, quotations and released amounts will appear here once project data is added.'
          })}`;
        return;
      }
      $('#page-vendors').innerHTML = `
        <div class="phead"><div><p class="eyebrow">Vendor accounts</p><h1>Vendors & payments</h1>
          <p class="phead__sub">${D.vendors.length} accounts · ${money(Derive.relTotal, true)} released of ${money(Derive.quoteTotal, true)} quoted</p></div></div>
        <div class="grid g-4 mb">
          <div class="kpi"><div class="kpi__label">Finalised quotations</div><div class="kpi__value">${money(Derive.quoteTotal, true)}</div><div class="kpi__foot">${D.vendors.length} accounts</div></div>
          <div class="kpi"><div class="kpi__label">Released</div><div class="kpi__value">${money(Derive.relTotal, true)}</div><div class="kpi__foot">${App.pctOf(Derive.relTotal, Derive.quoteTotal)}% of quotes</div></div>
          <div class="kpi"><div class="kpi__label">Fully settled</div><div class="kpi__value">${Derive.settledCount}</div><div class="kpi__foot">accounts at zero balance</div></div>
          <div class="kpi"><div class="kpi__label">Extra works</div><div class="kpi__value">${money(D.extraWorksTotal, true)}</div><div class="kpi__foot">${D.extraWorks.length} categories</div></div>
        </div>
        <div class="chipbar">
          <div class="search__field" style="max-width:280px"><i class="fa-solid fa-magnifying-glass"></i><input id="vq" placeholder="Search account or vendor…"></div>
          <button class="chip is-active" data-f="all">All <span class="chip__n">${D.vendors.length}</span></button>
          <button class="chip" data-f="outstanding">Outstanding <span class="chip__n">${Derive.outstandingCount}</span></button>
          <button class="chip" data-f="settled">Settled <span class="chip__n">${Derive.settledCount}</span></button>
        </div>
        <div id="vendorList"></div>
        <div class="card" style="margin-top:1.4rem">
          <div class="card__head"><div><h2>Extra works</h2><p class="sub">Additional scope · grand total ${money(D.extraWorksTotal, true)}</p></div></div>
          <div class="card__body">${D.extraWorks.map(e => `
            <div style="padding:.7rem 0; border-bottom:1px solid var(--line-soft)">
              <div style="display:flex; justify-content:space-between; gap:1rem">
                <b>${esc(e.category)}</b><span class="num strong">${money(e.amount)}</span>
              </div>
              ${e.items.length ? `<div class="faint" style="font-size:12px; margin-top:.3rem">${e.items.map(esc).join(' · ')}</div>` : ''}
            </div>`).join('')}
          </div>
        </div>`;
      $('#vq').addEventListener('input', e => { this.state.q = e.target.value.toLowerCase(); this.renderList(); });
      $('.chipbar', $('#page-vendors')).addEventListener('click', e => {
        const c = e.target.closest('.chip'); if (!c) return;
        $$('#page-vendors .chip').forEach(x => x.classList.toggle('is-active', x === c));
        this.state.filter = c.dataset.f; this.renderList();
      });
      $('#vendorList').addEventListener('click', e => {
        const h = e.target.closest('.vrow__head'); if (h) h.parentElement.classList.toggle('is-open');
      });
      this.renderList();
      // deep link to a specific vendor
      const p = App.param();
      if (p) setTimeout(() => { const el = $(`#vendor-${p}`); if (el) { el.classList.add('is-open'); el.scrollIntoView && el.scrollIntoView({ block: 'center' }); } }, 60);
    },
    renderList() {
      const s = this.state;
      let list = Derive.vendorsRich.filter(v =>
        (!s.q || v.account.toLowerCase().includes(s.q) || (v.vendor || '').toLowerCase().includes(s.q)) &&
        (s.filter === 'all' || (s.filter === 'settled' ? v.settled : (s.filter === 'outstanding' ? v.bal > 0 : true))));
      $('#vendorList').innerHTML = list.length ? list.map(v => this._row(v)).join('') : `<div class="card"><div class="dt__empty">No vendor accounts match.</div></div>`;
    },
    _row(v) {
      return `<div class="vrow" id="vendor-${v.sino}">
        <div class="vrow__head">
          <div class="vrow__id">
            <div class="vrow__acct">${esc(v.account)} ${v.settled ? '<span class="pill paid">settled</span>' : ''}</div>
            <div class="vrow__vendor">${esc(v.vendor || '—')}</div>
          </div>
          <div class="vrow__right">
            <div class="vrow__fig hide-sm"><div class="l">Quoted</div><div class="v">${money(v.quotation, true)}</div></div>
            <div class="vrow__fig"><div class="l">Released</div><div class="v" style="color:var(--settled)">${money(v.released, true)}</div></div>
            <div class="vrow__fig"><div class="l">Balance</div><div class="v" style="color:${v.bal > 0 ? 'var(--warn)' : 'var(--muted)'}">${money(v.bal, true)}</div></div>
            <div class="vrow__settle">${settleBar(v.released || 0, v.quotation || 0, { legend: false })}</div>
            <div class="vrow__pct">${v.pct}%</div>
            <i class="fa-solid fa-chevron-down area__toggle"></i>
          </div>
        </div>
        <div class="vrow__body">
          ${v.txns.length ? `<table class="dt" style="min-width:0"><thead><tr><th>Date</th><th>Towards</th><th class="num">Amount</th><th>Mode</th></tr></thead>
            <tbody>${v.txns.slice().sort((a, b) => a.date.localeCompare(b.date)).map(t => `
              <tr><td class="num">${shortDate(t.date)}</td><td>${esc(t.towards || '—')}</td><td class="num">${money(t.amount)}</td><td><span class="tag">${esc(t.mode)}</span></td></tr>`).join('')}
            </tbody>
            <tfoot><tr><td colspan="2">${v.txns.length} transactions</td><td class="num">${money(v.txns.reduce((s, t) => s + t.amount, 0))}</td><td></td></tr></tfoot>
          </table>` : `<div class="dt__empty" style="padding:1.2rem">No ledger transactions mapped to this account.</div>`}
        </div>
      </div>`;
    },
    refresh() { const p = App.param(); if (p) { const el = $(`#vendor-${p}`); if (el) { el.classList.add('is-open'); el.scrollIntoView && el.scrollIntoView({ block: 'center' }); } } }
  };
  App.register('vendors', vendors);

  /* ── LEDGER ───────────────────────────────────────────── */
  const ledger = {
    state: { q: '', vendor: '', mode: '', account: '' },
    mount() {
      /* First run: no transactions yet. */
      if (!D.ledger.length) {
        $('#page-ledger').innerHTML = `
          <div class="phead"><div><p class="eyebrow">Payment ledger</p><h1>Vendor payment ledger</h1>
            <p class="phead__sub">No transactions recorded</p></div></div>
          ${App.empty('No ledger entries recorded.', {
            icon: 'fa-receipt',
            hint: 'Every payment released to a vendor will be listed here, grouped by month.'
          })}`;
        return;
      }
      const modes = [...new Set(D.ledger.map(t => t.mode))].sort();
      const accounts = [...new Set(D.ledger.map(t => t.account).filter(Boolean))].sort();
      $('#page-ledger').innerHTML = `
        <div class="phead"><div><p class="eyebrow">Payment ledger</p><h1>Vendor payment ledger</h1>
          <p class="phead__sub">${D.ledger.length} transactions · ${money(Derive.ledgerTotal, true)} released · ${shortDate(D.ledger[0].date)} → ${shortDate(D.ledger[D.ledger.length - 1].date)}</p></div></div>
        <div class="card mb"><div class="card__head"><div><h2>Monthly spend</h2><p class="sub">Released per month</p></div></div><div class="card__body"><div class="chartbox sm"><canvas id="chLedger"></canvas></div></div></div>
        <div class="chipbar">
          <div class="search__field" style="max-width:260px"><i class="fa-solid fa-magnifying-glass"></i><input id="lq" placeholder="Search vendor or note…"></div>
          <select class="chip" id="lmode"><option value="">All modes</option>${modes.map(m => `<option>${esc(m)}</option>`).join('')}</select>
          <select class="chip" id="lacct" style="max-width:220px"><option value="">All accounts</option>${accounts.map(a => `<option>${esc(a)}</option>`).join('')}</select>
        </div>
        <div id="ledgerBody"></div>`;
      $('#lq').addEventListener('input', e => { this.state.q = e.target.value.toLowerCase(); this.renderBody(); });
      $('#lmode').addEventListener('change', e => { this.state.mode = e.target.value; this.renderBody(); });
      $('#lacct').addEventListener('change', e => { this.state.account = e.target.value; this.renderBody(); });
      this.charts();
      this.renderBody();
    },
    rows() {
      const s = this.state;
      return D.ledger.filter(t =>
        (!s.q || (t.vendor || '').toLowerCase().includes(s.q) || (t.towards || '').toLowerCase().includes(s.q) || (t.vendorRaw || '').toLowerCase().includes(s.q)) &&
        (!s.mode || t.mode === s.mode) && (!s.account || t.account === s.account));
    },
    renderBody() {
      const rows = this.rows();
      // group by month, newest first
      const groups = {};
      rows.forEach(t => { const k = App.monthKey(t.date); (groups[k] = groups[k] || []).push(t); });
      const keys = Object.keys(groups).sort().reverse();
      const total = rows.reduce((s, t) => s + t.amount, 0);
      $('#ledgerBody').innerHTML = `<p class="muted" style="font-size:12.5px; margin:0 0 .5rem">${rows.length} transactions · ${money(total)}</p>` +
        (keys.length ? keys.map(k => {
          const items = groups[k].slice().sort((a, b) => b.date.localeCompare(a.date));
          const mt = items.reduce((s, t) => s + t.amount, 0);
          return `<div class="monthhead"><h3>${monthLabel(k)}</h3><span class="tot">${items.length} txns · <b>${money(mt)}</b></span></div>
          <div class="tablewrap"><table class="dt">
            <thead><tr><th style="width:100px">Date</th><th>Vendor</th><th>Towards</th><th>Account</th><th class="num">Amount</th><th>Mode</th></tr></thead>
            <tbody>${items.map(t => `
              <tr>
                <td class="num">${shortDate(t.date)}</td>
                <td class="strong">${esc(t.vendor || '—')}${t.vendorRaw && t.vendorRaw !== t.vendor ? ` <span class="faint" style="font-size:10px">(${esc(t.vendorRaw)})</span>` : ''}</td>
                <td>${esc(t.towards || '—')}</td>
                <td><span class="faint" style="font-size:11px">${esc(t.account || '—')}</span></td>
                <td class="num">${money(t.amount)}</td>
                <td><span class="tag">${esc(t.mode)}</span></td>
              </tr>`).join('')}
            </tbody>
          </table></div>`;
        }).join('') : `<div class="card"><div class="dt__empty">No transactions match these filters.</div></div>`);
    },
    charts() {
      const t = themeColors();
      chart('chLedger', {
        type: 'line',
        data: { labels: Derive.monthly.map(x => x.label), datasets: [{ data: Derive.monthly.map(x => x.total), borderColor: t.accent, backgroundColor: rgba(t.accent, .12), fill: true, tension: .3, pointRadius: 2, borderWidth: 2 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => App.money(c.parsed.y, true) } } }, scales: { x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true } }, y: { grid: { color: t.line }, ticks: { callback: v => '₹' + (v / 1e5).toFixed(0) + 'L' } } } }
      });
    },
    refresh() { }
  };
  App.register('ledger', ledger);

  /* ── STAFF ────────────────────────────────────────────── */
  /* The register/profile pattern from v1, now linking each person's
     real activity from the ledger where their name appears. */
  /* Empty on a first run. The previous build shipped six sample people
     here; that has been removed. Populate from the Firestore `staff`
     collection when that lands — the shape each record needs is:

       id · name · role · dept · h (avatar hue 0-360) · phone · email
       availability · perf · match[] · resp[]

     `match` is the list of lowercase strings used to link a person to
     ledger rows where their name appears. */
  const STAFF = [];
  const staffProjects = id => App.Store.projects().filter(p => (p.staff || []).includes(id));
  const staffTasks = id => { const out = []; App.Store.projects().forEach(p => App.Store.tasks(p.id).forEach(t => { if (t.assignee === id) out.push({ ...t, project: p.name, projectId: p.id }); })); return out; };
  const availBadge = a => `<span class="badge ${a === 'Available' ? 'ok' : a === 'Busy' ? 'busy' : ''}"><i class="fa-solid fa-circle" style="font-size:6px"></i> ${esc(a || 'Available')}</span>`;
  function staffTxns(p) {
    return D.ledger.filter(t => { const hay = ((t.vendor || '') + ' ' + (t.vendorRaw || '') + ' ' + (t.towards || '')).toLowerCase(); return p.match.some(m => hay.includes(m)); });
  }
  const staff = {
    mount() {
      if (App.isAdminApp) this._bindFb();
      const p = App.param();
      if (p) { const person = STAFF.find(s => s.id === p); if (person) return this.profile(person); }
      this.list();
      $('#page-staff').addEventListener('click', e => {
        const card = e.target.closest('[data-staff]'); if (card) location.hash = '#/staff/' + card.dataset.staff;
      });
    },
    refresh() {
      const p = App.param();
      const person = p && STAFF.find(s => s.id === p);
      if (person) this.profile(person); else this.list();
    },
    list() {
      $('#page-staff').innerHTML = `
        <div class="phead"><div><p class="eyebrow">Team</p><h1>Staff</h1>
          <p class="phead__sub">${STAFF.length ? `${STAFF.length} people · activity linked from the payment ledger` : 'No employees added'}</p></div></div>
        ${App.isAdminApp ? `<div id="fbStaffPanel" class="card mb"><div class="card__body"><p class="muted" style="font-size:13px;margin:0">Loading staff login access…</p></div></div>
        <div class="navgroup" style="margin:.2rem 0 .9rem; font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:var(--faint)">Team directory</div>` : ''}
        ${STAFF.length ? '' : App.empty('No employees added.', {
          icon: 'fa-users',
          hint: App.isAdminApp
            ? 'Staff records will appear here. Use the panel above to grant a Google account access to the staff app.'
            : 'Staff records will appear here once your administrator adds them.'
        })}
        <div class="staffgrid">${STAFF.map(p => {
          const txns = staffTxns(p);
          const projs = staffProjects(p.id);
          const tasks = staffTasks(p.id);
          const openTasks = tasks.filter(t => t.status !== 'Completed').length;
          const workload = Math.min(100, projs.length * 25 + openTasks * 12);
          return `<article class="staff" data-staff="${p.id}" style="cursor:pointer">
            <div class="staff__top"><span class="avatar" style="--h:${p.h}">${p.name.slice(0, 2).toUpperCase()}</span>
              <div style="flex:1"><div class="staff__name">${esc(p.name)}</div><div class="staff__role">${esc(p.role)}</div></div>${availBadge(p.availability)}</div>
            <div class="faint" style="font-size:11.5px"><i class="fa-solid fa-sitemap"></i> ${esc(p.dept)} · <i class="fa-solid fa-phone"></i> ${esc(p.phone)}</div>
            <div class="staff__stat">
              <div><b>${projs.length}</b><span>Projects</span></div>
              <div><b>${openTasks}</b><span>Open tasks</span></div>
              <div><b>${p.perf}%</b><span>Performance</span></div>
            </div>
            <div><div class="pcard__progtop" style="margin-top:.5rem"><span>Workload</span><b>${workload}%</b></div><div class="workbar"><span style="width:${workload}%"></span></div></div>
          </article>`;
        }).join('')}</div>`;
      if (App.isAdminApp) this.renderFb();
    },
    profile(p) {
      const txns = staffTxns(p).slice().sort((a, b) => b.date.localeCompare(a.date));
      const val = txns.reduce((s, t) => s + t.amount, 0);
      const accounts = [...new Set(txns.map(t => t.account).filter(Boolean))];
      const projs = staffProjects(p.id);
      const tasks = staffTasks(p.id);
      const current = tasks.filter(t => t.status === 'In Progress' || t.status === 'Review');
      const upcoming = tasks.filter(t => t.status === 'To Do').sort((a, b) => (a.due || '').localeCompare(b.due || ''));
      const openTasks = tasks.filter(t => t.status !== 'Completed').length;
      const workload = Math.min(100, projs.length * 25 + openTasks * 12);
      const recent = txns.slice(0, 5).map(t => ({ t: (t.towards || 'Payment') + ' · ' + money(t.amount), at: t.date, icon: 'fa-receipt' }));
      $('#page-staff').innerHTML = `
        <a class="btn btn--ghost btn--sm" href="#/staff" style="margin-bottom:1rem"><i class="fa-solid fa-arrow-left"></i> All staff</a>
        <div class="card mb"><div class="card__pad" style="display:flex; gap:1.1rem; align-items:center; flex-wrap:wrap">
          <span class="avatar lg" style="--h:${p.h}">${p.name.slice(0, 2).toUpperCase()}</span>
          <div style="flex:1; min-width:200px"><h1 style="font-size:1.5rem">${esc(p.name)}</h1><p class="muted" style="margin:.2rem 0 0">${esc(p.role)}</p>
            <div style="margin-top:.5rem; display:flex; gap:.6rem; flex-wrap:wrap; align-items:center"><span class="tag">${esc(p.dept)}</span>${availBadge(p.availability)}</div></div>
          <div style="display:flex; gap:.5rem"><a class="btn btn--ghost btn--sm" href="mailto:${p.email}"><i class="fa-solid fa-envelope"></i> Email</a><a class="btn btn--accent btn--sm" href="tel:${p.phone.replace(/\s/g, '')}"><i class="fa-solid fa-phone"></i> Call</a></div>
        </div></div>
        <div class="grid g-4 mb">
          <div class="kpi"><div class="kpi__label">Assigned projects</div><div class="kpi__value">${projs.length}</div><div class="kpi__foot">active</div></div>
          <div class="kpi"><div class="kpi__label">Open tasks</div><div class="kpi__value">${openTasks}</div><div class="kpi__foot">${tasks.length} total</div></div>
          <div class="kpi"><div class="kpi__label">Performance</div><div class="kpi__value">${p.perf}%</div><div class="kpi__foot">rolling score</div></div>
          <div class="kpi"><div class="kpi__label">Workload</div><div class="kpi__value">${workload}%</div><div class="kpi__foot">capacity used</div></div>
        </div>
        <div class="grid g-xl-2">
          <div>
            <div class="card mb"><div class="card__head"><div><h2>Assigned projects</h2></div></div><div class="card__body">
              ${projs.length ? projs.map(pr => `<a class="miniproj" href="#/projects/${pr.id}" style="margin-bottom:.5rem"><span class="miniproj__ico"><i class="fa-solid ${App.catIcon[pr.category] || 'fa-building'}"></i></span><div class="miniproj__id"><div class="miniproj__name">${esc(pr.name)}</div><div class="miniproj__meta">${esc(pr.status)} · ${pr.completion || 0}%</div></div><i class="fa-solid fa-arrow-right faint"></i></a>`).join('') : '<p class="muted">Not assigned to any project yet.</p>'}
            </div></div>
            <div class="card mb"><div class="card__head"><div><h2>Current & upcoming tasks</h2><p class="sub">${current.length} active · ${upcoming.length} queued</p></div></div><div class="card__body">
              ${current.concat(upcoming).slice(0, 8).map(t => `<div class="task"><i class="fa-solid ${t.status === 'In Progress' ? 'fa-spinner task__ico' : 'fa-circle task__ico pend'}"></i><div class="task__body"><div class="task__desc">${esc(t.title)}</div><div class="faint" style="font-size:11px">${esc(t.project)} · ${esc(t.status)}${t.due ? ' · due ' + shortDate(t.due) : ''}</div></div></div>`).join('') || '<p class="muted">No open tasks assigned.</p>'}
            </div></div>
            <div class="card mb"><div class="card__head"><div><h2>Ledger activity</h2><p class="sub">${txns.length} payments linked · ${money(val)}</p></div></div>
              <div class="card__body">${txns.length ? `<div class="tablewrap" style="box-shadow:none; border:0"><table class="dt" style="min-width:0">
                <thead><tr><th>Date</th><th>Towards</th><th class="num">Amount</th><th>Mode</th></tr></thead>
                <tbody>${txns.slice(0, 30).map(t => `<tr><td class="num">${shortDate(t.date)}</td><td>${esc(t.towards || '—')}</td><td class="num">${money(t.amount)}</td><td><span class="tag">${esc(t.mode)}</span></td></tr>`).join('')}</tbody>
              </table></div>${txns.length > 30 ? `<p class="faint" style="font-size:12px; margin-top:.6rem">Showing latest 30 of ${txns.length}.</p>` : ''}` : `<p class="muted">No ledger entries match this name — office-based or verification role.</p>`}
              </div></div>
          </div>
          <div>
            <div class="card mb"><div class="card__head"><div><h2>Performance & workload</h2></div></div><div class="card__body">
              <div class="pcard__progtop"><span>Performance</span><b>${p.perf}%</b></div><div class="workbar"><span style="width:${p.perf}%"></span></div>
              <div class="pcard__progtop" style="margin-top:.8rem"><span>Workload</span><b>${workload}%</b></div><div class="workbar"><span style="width:${workload}%"></span></div>
              <div class="staff__badges">${availBadge(p.availability)}<span class="badge"><i class="fa-solid fa-diagram-project"></i> ${projs.length} projects</span><span class="badge"><i class="fa-solid fa-clipboard-check"></i> ${openTasks} open</span></div>
            </div></div>
            <div class="card mb"><div class="card__head"><div><h2>Responsibilities</h2></div></div><div class="card__body"><div class="chipbar" style="margin:0">${p.resp.map(r => `<span class="chip" style="cursor:default">${esc(r)}</span>`).join('')}</div></div></div>
            <div class="card mb"><div class="card__head"><div><h2>Recent activity</h2></div></div><div class="card__body">
              ${recent.length ? `<ol class="timeline">${recent.map(a => `<li class="tl"><span class="tl__dot"><i class="fa-solid ${a.icon}"></i></span><div class="tl__body"><div class="tl__t" style="font-size:12.5px">${esc(a.t)}</div></div><span class="tl__date">${shortDate(a.at)}</span></li>`).join('')}</ol>` : '<p class="muted">No recent activity.</p>'}
            </div></div>
            <div class="card mb"><div class="card__head"><div><h2>Contact</h2></div></div><div class="card__body"><dl class="deflist">
              <div><dt>Phone</dt><dd>${esc(p.phone)}</dd></div><div><dt>Email</dt><dd style="font-size:12px">${esc(p.email)}</dd></div><div><dt>Department</dt><dd>${esc(p.dept)}</dd></div><div><dt>Availability</dt><dd>${esc(p.availability)}</dd></div>
            </dl></div></div>
            <div class="card"><div class="card__head"><div><h2>Linked accounts</h2></div></div><div class="card__body">${accounts.length ? accounts.map(a => `<div class="tag" style="display:block; margin-bottom:.35rem">${esc(a)}</div>`).join('') : '<p class="muted">None</p>'}</div></div>
          </div>
        </div>`;
    },

    /* ── Firestore staff login-access management (admin only) ──────── */
    _fbBound: false,
    _err(e) {
      const c = (e && (e.code || e.message)) || '';
      if (/permission-denied/.test(c)) return 'Permission denied — check Firestore rules and your admin email.';
      if (/unavailable|network/.test(c)) return 'Network error — check your connection.';
      if (/popup-closed|cancelled-popup|popup-blocked/.test(c)) return 'Sign-in was cancelled or blocked.';
      if (/unauthorized-domain/.test(c)) return "This domain isn't authorized in Firebase Auth settings.";
      return c || 'Something went wrong.';
    },
    _bindFb() {
      if (this._fbBound) return; this._fbBound = true;
      const A = window.ITDAdminAuth;
      if (A && A.onState) A.onState(() => { if ($('#fbStaffPanel')) this.renderFb(); });
    },
    /* ── Firestore member management ────────────────────────────────
       Owner-only. Every control here is also guarded individually, so a
       role change mid-session cannot leave an action enabled that the
       current user may no longer perform. */
    _fbState: { q: '', role: 'all' },
    _fbRows: [],

    async renderFb() {
      const panel = $('#fbStaffPanel'); if (!panel) return;
      const A = window.ITDAdminAuth;
      const R = App.Roles;

      if (!A || !A.configured) {
        panel.innerHTML = `<div class="card__head"><div><h2>Members &amp; access</h2><p class="sub">Google accounts allowed to sign in</p></div></div>
          <div class="card__body"><p class="muted" style="font-size:13px;margin:0">Firebase isn't configured yet. Paste your project values into <code>src/shared/itd-config.js</code>, then rebuild.</p></div>`;
        return;
      }

      const st = A.state;
      const head = `<div class="card__head"><div><h2>Members &amp; access</h2><p class="sub">Google accounts allowed to sign in · stored in Firestore</p></div>${st.user ? `<button class="btn btn--ghost btn--sm" id="fbSignOut"><i class="fa-solid fa-right-from-bracket"></i> Sign out</button>` : ''}</div>`;

      if (!st.ready) { panel.innerHTML = head + `<div class="card__body"><p class="muted" style="font-size:13px;margin:0">Connecting…</p></div>`; return; }

      if (!st.user) {
        panel.innerHTML = head + `<div class="card__body"><p class="muted" style="font-size:13px">Sign in with your Owner Google account to manage members.</p>
          <button class="btn btn--accent" id="fbSignIn"><i class="fa-brands fa-google"></i>&nbsp; Sign in</button></div>`;
        const b = $('#fbSignIn'); if (b) b.onclick = async () => { try { await A.signIn(); } catch (e) { App.toast('Sign-in failed', this._err(e), 'warn'); } };
        return;
      }

      if (!st.isAdmin) {
        panel.innerHTML = head + `<div class="card__body"><p style="font-size:13.5px;margin:0 0 .4rem">Signed in as <b>${esc(st.user.email || '')}</b>.</p>
          <p class="muted" style="font-size:13px;margin:0">This account isn't authorised to manage members. Add its email to <code>isAdmin()</code> in <code>firestore.rules</code> and publish.</p></div>`;
        const o = $('#fbSignOut'); if (o) o.onclick = () => A.signOut();
        return;
      }

      panel.innerHTML = head + `<div class="card__body">
        <div class="fbbar">
          <div class="search__field fbbar__grow" style="max-width:280px"><i class="fa-solid fa-magnifying-glass"></i>
            <input id="fbQ" placeholder="Search name, email or role…" value="${esc(this._fbState.q)}"></div>
          <div class="fbbar__end">
            <label class="field" style="margin:0"><select id="fbRole" style="min-width:130px">
              <option value="all">All roles</option>${R.ALL.map(r => `<option value="${r}" ${this._fbState.role === r ? 'selected' : ''}>${r}</option>`).join('')}
            </select></label>
            ${R.can.createMember() ? `<button class="btn btn--accent btn--sm" id="fbAdd"><i class="fa-solid fa-user-plus"></i> Add member</button>` : ''}
          </div>
        </div>
        <div id="fbList"><p class="muted" style="font-size:13px">Loading…</p></div>
        <p class="faint" style="font-size:11.5px;margin:.9rem 0 0">Signed in as ${esc(st.user.email || '')} · ${R.currentRole()}</p>
      </div>`;

      $('#fbSignOut').onclick = () => A.signOut();
      const add = $('#fbAdd'); if (add) add.onclick = () => this.fbForm(null);
      $('#fbQ').oninput = e => { this._fbState.q = e.target.value; this.fbTable(); };
      $('#fbRole').onchange = e => { this._fbState.role = e.target.value; this.fbTable(); };

      try {
        this._fbRows = await window.ITDAdminAuth.listStaff();
        // Record who the signed-in user is, so permission checks work.
        const mine = this._fbRows.find(r => (r.email || '').toLowerCase() === R.currentEmail());
        R.setSelf(mine || null);
        this.fbTable();
      } catch (e) {
        $('#fbList').innerHTML = `<p class="muted" style="font-size:13px">Couldn't load members — ${esc(this._err(e))}</p>`;
      }
    },

    /** Search matches name, email, role, job title and department. */
    fbFiltered() {
      const R = App.Roles, s = this._fbState, q = s.q.trim().toLowerCase();
      return this._fbRows.filter(r => {
        if (s.role !== 'all' && R.norm(r.role) !== s.role) return false;
        if (!q) return true;
        return [r.name, r.email, R.norm(r.role), r.jobTitle, r.role, r.department, r.dept]
          .some(v => String(v || '').toLowerCase().includes(q));
      });
    },

    fbTable() {
      const host = $('#fbList'); if (!host) return;
      const R = App.Roles;
      const rows = this.fbFiltered();

      if (!rows.length) {
        host.innerHTML = this._fbRows.length
          ? `<p class="muted" style="font-size:13px;margin:0">No members match this search or filter.</p>`
          : `<p class="muted" style="font-size:13px;margin:0">No members yet. Add one to let a Google account sign in.</p>`;
        return;
      }

      host.innerHTML = `<div class="tablewrap" style="box-shadow:none;border:0"><table class="dt" style="min-width:0">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th class="hide-sm">Job title</th><th class="hide-sm">Department</th><th>Status</th><th></th></tr></thead>
        <tbody>${rows.map(r => {
          const canEdit = R.can.editMember(r);
          const canDel = R.can.deleteMember(r);
          const delWhy = R.reason('delete', r);
          return `<tr>
            <td class="strong">${esc(r.name || '—')}</td>
            <td style="font-size:12px">${esc(r.email || '—')}</td>
            <td>${R.badge(r.role)}</td>
            <td class="hide-sm">${esc(r.jobTitle || '—')}</td>
            <td class="hide-sm">${esc(r.department || r.dept || '—')}</td>
            <td><select class="chip fbStatus" data-id="${r.id}" ${canEdit ? '' : 'disabled'}>${['Active', 'Inactive', 'Blocked'].map(s => `<option ${((r.status || 'Active') === s) ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
            <td style="white-space:nowrap">
              ${canEdit ? `<button class="btn btn--ghost btn--sm fbEdit" data-id="${r.id}" title="Edit member"><i class="fa-solid fa-pen"></i></button>` : ''}
              <button class="btn btn--ghost btn--sm fbDel" data-id="${r.id}" data-name="${esc(r.name || r.email || '')}"
                ${canDel ? '' : 'disabled'} title="${esc(canDel ? 'Remove access' : delWhy)}">
                <i class="fa-solid fa-trash" style="color:${canDel ? 'var(--warn)' : 'var(--faint)'}"></i></button>
            </td>
          </tr>`;
        }).join('')}</tbody></table></div>`;

      $$('#fbList .fbStatus').forEach(sel => sel.onchange = async () => {
        try {
          await window.ITDAdminAuth.updateStaff(sel.dataset.id, { status: sel.value });
          const row = this._fbRows.find(r => r.id === sel.dataset.id); if (row) row.status = sel.value;
          App.toast('Status updated', 'Set to ' + sel.value, 'good');
        } catch (e) { App.toast('Update failed', this._err(e), 'warn'); }
      });
      $$('#fbList .fbEdit').forEach(b => b.onclick = () =>
        this.fbForm(this._fbRows.find(r => r.id === b.dataset.id) || null));
      $$('#fbList .fbDel').forEach(b => { if (!b.disabled) b.onclick = () => this.fbDelete(b.dataset.id, b.dataset.name); });
    },

    /** One form for both add and edit — same fields, same validation. */
    fbForm(existing) {
      const R = App.Roles;
      const editing = !!existing;
      const rec = existing || {};

      if (!(editing ? R.can.editMember(rec) : R.can.createMember())) {
        App.toast('Not permitted', R.reason('edit', rec), 'warn');
        return;
      }

      const F = (id, label, val, ph, type) =>
        `<label class="field"><span>${label}</span><input id="${id}" type="${type || 'text'}" value="${esc(val || '')}" placeholder="${esc(ph || '')}"><em class="field__err" id="${id}Err"></em></label>`;

      const roleLocked = editing && !R.can.setRole(rec);

      App.modal({
        title: editing ? 'Edit member' : 'Add member',
        body: `<div class="formgrid">
          ${F('fsName', 'Name *', rec.name, 'Full name')}
          ${editing
            ? `<label class="field"><span>Google email</span><input id="fsEmail" type="email" value="${esc(rec.email || '')}" disabled><em class="field__err" id="fsEmailErr"></em>
                 <em class="faint" style="font-size:11.5px;font-style:normal">The email identifies the account and cannot be changed. Remove and re-add to change it.</em></label>`
            : F('fsEmail', 'Google email *', '', 'name@gmail.com', 'email')}
          <label class="field"><span>Role *</span>
            <select id="fsRoleSel" ${roleLocked ? 'disabled' : ''}>${R.options(rec.role)}</select>
            <em class="field__err" id="fsRoleSelErr"></em>
            ${roleLocked ? `<em class="faint" style="font-size:11.5px;font-style:normal">${esc(R.reason('setRole', rec))}</em>`
              : `<em class="faint" style="font-size:11.5px;font-style:normal">Admin/Owner has full access — settings, members, all financial data. Staff does not.<br>
                 Setting someone to Owner here records the intent; their access only becomes real once their email is added to <code>isAdmin()</code> in <code>firestore.rules</code> and the rules are published.</em>`}
          </label>
          <div class="formrow">${F('fsJob', 'Job title', rec.jobTitle, 'e.g. Site Engineer')}${F('fsDept', 'Department', rec.department || rec.dept, 'e.g. Projects')}</div>
          ${F('fsPhone', 'Phone', rec.phone, '+91…', 'tel')}
          <label class="field"><span>Status</span><select id="fsStatus">${['Active', 'Inactive', 'Blocked'].map(s => `<option ${((rec.status || 'Active') === s) ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
          ${editing ? '' : `<p class="muted" style="font-size:12px;margin:.2rem 0 0">This exact Google email becomes the only account allowed to sign in as this member.</p>`}
        </div>`,
        footer: `<button class="btn btn--ghost" data-close>Cancel</button><button class="btn btn--accent" id="fsSave"><i class="fa-solid fa-check"></i> ${editing ? 'Save changes' : 'Add member'}</button>`
      });

      $('#fsSave').onclick = async () => {
        const v = id => ($('#' + id).value || '').trim();
        const setE = (id, m) => {
          const e = $('#' + id + 'Err'); if (e) e.textContent = m || '';
          const f = $('#' + id); if (f) f.classList.toggle('is-invalid', !!m);
          return !m;
        };

        let ok = true;
        ok = setE('fsName', v('fsName') ? '' : 'Name is required') && ok;

        const email = editing ? (rec.email || '').toLowerCase() : v('fsEmail').toLowerCase();
        if (!editing) {
          ok = setE('fsEmail', /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? '' : 'Enter a valid email') && ok;
          // No two members may share an email — it is the login identity.
          if (ok && this._fbRows.some(r => (r.email || '').toLowerCase() === email)) {
            ok = setE('fsEmail', 'A member with this email already exists.') && ok;
          }
        }

        const roleVal = $('#fsRoleSel').value;
        ok = setE('fsRoleSel', App.Roles.ALL.includes(roleVal) ? '' : 'Select a role') && ok;
        if (!ok) return;

        const data = {
          name: v('fsName'),
          phone: v('fsPhone'),
          jobTitle: v('fsJob'),
          department: v('fsDept'),
          status: $('#fsStatus').value
        };
        if (!roleLocked) data.role = App.Roles.norm(roleVal);

        try {
          if (editing) {
            await window.ITDAdminAuth.updateStaff(rec.id, data);
            App.toast('Member updated', rec.name || email, 'good');
          } else {
            await window.ITDAdminAuth.addStaff(Object.assign({ email }, data, { role: App.Roles.norm(roleVal) }));
            App.toast('Member added', email + ' · ' + App.Roles.norm(roleVal), 'good');
          }
          App.closeModal();
          this.renderFb();
        } catch (e) {
          App.toast(editing ? 'Could not save' : 'Could not add', this._err(e), 'warn');
        }
      };
    },

    fbDelete(id, name) {
      const rec = this._fbRows.find(r => r.id === id) || {};
      if (!App.Roles.can.deleteMember(rec)) { App.toast('Not permitted', App.Roles.reason('delete', rec), 'warn'); return; }
      App.modal({
        title: 'Remove member',
        body: `<p style="font-size:14px;line-height:1.6;margin:0">Remove access for <b>${esc(name || 'this account')}</b>${rec.role ? ` (${esc(App.Roles.norm(rec.role))})` : ''}? They lose access immediately. This does not delete their Google account.</p>`,
        footer: `<button class="btn btn--ghost" data-close>Cancel</button><button class="btn btn--accent" id="fbDelYes" style="background:var(--warn);border-color:var(--warn)"><i class="fa-solid fa-trash"></i> Remove access</button>`
      });
      $('#fbDelYes').onclick = async () => {
        try { await window.ITDAdminAuth.deleteStaff(id); App.closeModal(); App.toast('Access removed', name || '', 'warn'); this.renderFb(); }
        catch (e) { App.toast('Delete failed', this._err(e), 'warn'); }
      };
    }
  };
  App.register('staff', staff);
  App.STAFF = STAFF;
  App.staffById = id => STAFF.find(s => s.id === id);
  App.staffTxns = staffTxns;

  /* ── Command palette verbs owned by this file ────────────────────── */
  if (App.Command) {
    App.Command.register({
      id: 'member.new', label: 'Add member', keywords: 'staff owner user login access invite',
      group: 'Create', icon: 'fa-user-plus', hint: 'Grant a Google account access',
      when: () => !App.Roles || App.Roles.can.createMember(),
      run: () => { location.hash = '#/staff'; App.render(); setTimeout(() => staff.fbForm(null), 30); }
    });
    App.Command.register({
      id: 'report.export', label: 'Export data as JSON', keywords: 'download backup export data',
      group: 'App', icon: 'fa-download', hint: 'Full parsed dataset', primary: false,
      run: () => {
        const blob = new Blob([JSON.stringify(D, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'intandem-desk-data.json'; a.click();
        URL.revokeObjectURL(url); App.toast('Export ready', 'intandem-desk-data.json downloaded.', 'good');
      }
    });
  }

  /* ── REPORTS ──────────────────────────────────────────── */
  const reports = {
    mount() {
      const m = D.meta, d = Derive;
      /* First run: nothing to report on. Export buttons stay — they are
         wired to Store data, which the user can create before any
         workbook exists. */
      if (!D.ledger.length && !D.budget.length && !D.schedule.length) {
        $('#page-reports').innerHTML = `
          <div class="phead"><div><p class="eyebrow">Weekly PMC report</p><h1>Client report</h1>
            <p class="phead__sub">No project data yet</p></div></div>
          ${App.empty('No reports generated.', {
            icon: 'fa-file-lines',
            hint: 'The weekly client report is built from budget, schedule and ledger data. It will generate automatically once a project is added.'
          })}`;
        return;
      }
      const sc = Object.entries(d.statusCounts).sort((a, b) => b[1] - a[1]);
      const recentMonth = d.monthly[d.monthly.length - 1] || { label: '—', total: 0 };
      $('#page-reports').innerHTML = `
        <div class="phead"><div><p class="eyebrow">Weekly PMC report</p><h1>Client report</h1>
          <p class="phead__sub">Data as of ${shortDate(m.reportDate)}</p></div>
          <div class="phead__actions">
            <button class="btn btn--ghost" id="rExport"><i class="fa-solid fa-file-csv"></i> Export CSV</button>
            <button class="btn btn--ghost" onclick="window.print()"><i class="fa-solid fa-print"></i> Print / PDF</button>
          </div>
        </div>
        <div class="expbar">
          <span class="faint" style="font-size:12px"><i class="fa-solid fa-download"></i> Downloads:</span>
          <button class="btn btn--ghost btn--sm" data-exp="projects"><i class="fa-solid fa-diagram-project"></i> Projects</button>
          <button class="btn btn--ghost btn--sm" data-exp="payments"><i class="fa-solid fa-file-invoice-dollar"></i> Payments</button>
          <button class="btn btn--ghost btn--sm" data-exp="staff"><i class="fa-solid fa-users"></i> Staff</button>
          <button class="btn btn--ghost btn--sm" data-exp="tasks"><i class="fa-solid fa-clipboard-check"></i> Tasks</button>
          <button class="btn btn--ghost btn--sm" data-exp="financial"><i class="fa-solid fa-indian-rupee-sign"></i> Financial</button>
        </div>
        <div class="report__doc">
          <div class="report__hd">
            <div><h2 style="font-size:1.2rem">${esc(m.project)}</h2><p class="muted" style="font-size:12.5px; margin:.3rem 0 0">${esc(m.location)}<br>Client: ${esc(m.client)} · PM: ${esc(m.engineer)}</p></div>
            <div style="text-align:right"><div class="brand__mark" style="margin-left:auto">ID</div><p class="faint" style="font-size:11px; margin:.4rem 0 0">${esc(m.firm)}<br>as of ${shortDate(m.reportDate)}</p></div>
          </div>

          <div class="report__section"><h3>1 · Budget summary</h3>
            <dl class="deflist">
              <div><dt>Approved budget (balance sheet)</dt><dd>${money(m.balanceBudget)}</dd></div>
              <div><dt>Payments released</dt><dd style="color:var(--settled)">${money(m.balanceReleased)}</dd></div>
              <div><dt>Outstanding balance</dt><dd style="color:var(--warn)">${money(m.balanceOutstanding)}</dd></div>
              <div><dt>Utilisation</dt><dd>${App.pctOf(m.balanceReleased, m.balanceBudget)}%</dd></div>
              <div><dt>Extra works (additional scope)</dt><dd>${money(D.extraWorksTotal)}</dd></div>
            </dl>
            <div style="margin-top:.9rem">${settleBar(m.balanceReleased, m.balanceBudget, { lg: true })}</div>
          </div>

          <div class="report__section"><h3>2 · Payments this period</h3>
            <p class="muted" style="font-size:13px">Latest month on record — ${recentMonth.label}: <b class="strong">${money(recentMonth.total)}</b> across the ledger. Total released to date ${money(d.ledgerTotal)} over ${D.ledger.length} transactions.</p>
            <div class="tablewrap" style="margin-top:.7rem; box-shadow:none"><table class="dt"><thead><tr><th>Date</th><th>Vendor</th><th>Towards</th><th class="num">Amount</th></tr></thead>
              <tbody>${d.recent.slice(0, 8).map(t => `<tr><td class="num">${shortDate(t.date)}</td><td>${esc(t.vendor || '—')}</td><td>${esc(t.towards || '—')}</td><td class="num">${money(t.amount)}</td></tr>`).join('')}</tbody></table></div>
          </div>

          <div class="report__section"><h3>3 · Schedule status roll-up</h3>
            <dl class="deflist">${sc.map(([s, n]) => `<div><dt>${esc(s)}</dt><dd>${n} task${n > 1 ? 's' : ''}</dd></div>`).join('')}</dl>
            <p class="muted" style="font-size:12.5px; margin-top:.7rem">${d.statusCounts['Completed'] || 0} of ${D.schedule.length} tasks completed (${Math.round((d.statusCounts['Completed'] || 0) / D.schedule.length * 100)}%).</p>
          </div>

          <div class="report__section"><h3>4 · Top outstanding vendors</h3>
            <div class="tablewrap" style="box-shadow:none"><table class="dt"><thead><tr><th>Account</th><th>Vendor</th><th class="num">Balance</th></tr></thead>
              <tbody>${d.topOutstanding.map(v => `<tr><td>${esc(v.account)}</td><td>${esc(v.vendor || '—')}</td><td class="num" style="color:var(--warn)">${money(v.bal)}</td></tr>`).join('')}</tbody></table></div>
          </div>

          <p class="faint" style="font-size:11px; margin-top:2rem; padding-top:1rem; border-top:1px solid var(--line)">Generated by InTandem Desk · figures reconcile to the weekly PMC workbook dated ${shortDate(m.reportDate)}. Ledger sum ${money(d.ledgerTotal)} vs balance-sheet released ${money(m.balanceReleased)} (variance ${money(d.ledgerTotal - m.balanceReleased)}, petty site expenses not rolled into vendor accounts).</p>
        </div>`;
      const exp = (name) => {
        const csv = App._toCSV, dl = App._download, S = App.Store;
        if (name === 'projects') { const rows = [['Name', 'Client', 'Location', 'Type', 'Status', 'Budget', 'Spent', 'Completion%']].concat(S.projects().map(p => [p.name, p.client, p.location, p.type, p.status, p.budget, p.spent, p.completion])); dl('projects.csv', csv(rows)); }
        else if (name === 'payments') { const rows = [['Invoice', 'Project', 'Client', 'Date', 'Amount', 'GST%', 'Status']].concat(S.payments().map(x => { const pr = S.project(x.projectId); return [x.invoiceNo, pr ? pr.name : '', x.client, x.invoiceDate, x.amount, x.gst, x.status]; })); dl('payments.csv', csv(rows)); }
        else if (name === 'staff') { const rows = [['Name', 'Role', 'Department', 'Availability', 'Performance%', 'Projects', 'Phone', 'Email']].concat(STAFF.map(s => [s.name, s.role, s.dept, s.availability, s.perf, staffProjects(s.id).length, s.phone, s.email])); dl('staff.csv', csv(rows)); }
        else if (name === 'tasks') { const rows = [['Project', 'Task', 'Status', 'Priority', 'Assignee', 'Due', 'Progress%']]; S.projects().forEach(p => S.tasks(p.id).forEach(t => rows.push([p.name, t.title, t.status, t.priority, (App.staffById(t.assignee)?.name || ''), t.due, t.progress]))); dl('tasks.csv', csv(rows)); }
        else if (name === 'financial') { const rows = [['Metric', 'Value (INR)'], ['Approved budget', m.balanceBudget], ['Released', m.balanceReleased], ['Outstanding', m.balanceOutstanding], ['Extra works', D.extraWorksTotal], ['Ledger total', d.ledgerTotal], ['Transactions', D.ledger.length]]; dl('financial.csv', csv(rows)); }
        App.toast('Exported', name[0].toUpperCase() + name.slice(1) + ' CSV downloaded', 'good');
      };
      $('#rExport').addEventListener('click', () => exp('financial'));
      $$('#page-reports [data-exp]').forEach(b => b.addEventListener('click', () => exp(b.dataset.exp)));
    },
    refresh() { }
  };
  App.register('reports', reports);

  /* ── SETTINGS ─────────────────────────────────────────── */
  const settings = {
    mount() {
      /* Settings is Owner-only. Staff accounts cannot change system
         configuration — spec §6. The nav link is hidden too, but the
         route is checked independently in case it is reached directly. */
      const blocked = !!(App.Roles && !App.Roles.can.accessSettings());
      this._renderedBlocked = blocked;
      if (blocked) {
        $('#page-settings').innerHTML = `
          <div class="phead"><div><p class="eyebrow">Configuration</p><h1>Settings</h1></div></div>
          ${App.Roles.denied('Settings')}`;
        return;
      }
      const theme = document.documentElement.dataset.theme;
      $('#page-settings').innerHTML = `
        <div class="phead"><div><p class="eyebrow">Configuration</p><h1>Settings</h1>
          <p class="phead__sub">Preferences are saved to this browser (localStorage prefix <code class="num">itd.</code>)</p></div></div>
        <div class="grid g-2">
          <div class="card"><div class="card__head"><div><h2>Appearance</h2><p class="sub">Theme preference</p></div></div>
            <div class="card__body"><div class="chipbar" style="margin:0">
              <button class="chip ${theme === 'dark' ? 'is-active' : ''}" data-theme="dark"><i class="fa-solid fa-moon"></i> Dark</button>
              <button class="chip ${theme === 'light' ? 'is-active' : ''}" data-theme="light"><i class="fa-solid fa-sun"></i> Light</button>
            </div></div>
          </div>
          <div class="card"><div class="card__head"><div><h2>Number format</h2><p class="sub">Indian grouping, lakh/crore</p></div></div>
            <div class="card__body"><dl class="deflist">
              <div><dt>Grouping</dt><dd class="num">en-IN (12,34,567)</dd></div>
              <div><dt>Compact</dt><dd class="num">₹12.00 L · ₹1.19 Cr</dd></div>
              <div><dt>Currency</dt><dd>Indian Rupee (₹)</dd></div>
            </dl></div>
          </div>
          <div class="card"><div class="card__head"><div><h2>Data export</h2><p class="sub">Download the parsed project data</p></div></div>
            <div class="card__body">
              <p class="muted" style="font-size:13px; margin:0 0 .8rem">Exports the full parsed <b>DATA</b> object (budget, schedule, vendors, ledger, extra works) as JSON — the same data driving every screen.</p>
              <button class="btn btn--accent" id="exportBtn"><i class="fa-solid fa-download"></i> Export data.json</button>
            </div>
          </div>
          <div class="card"><div class="card__head"><div><h2>Reset</h2><p class="sub">Clear saved preferences</p></div></div>
            <div class="card__body">
              <p class="muted" style="font-size:13px; margin:0 0 .8rem">Clears theme and layout preferences from this browser. Project data is read-only and is not affected.</p>
              <button class="btn btn--ghost" id="resetBtn"><i class="fa-solid fa-arrow-rotate-left"></i> Reset preferences</button>
            </div>
          </div>
        </div>
        <div class="card" style="margin-top:1rem"><div class="card__head"><div><h2>Data provenance</h2></div></div>
          <div class="card__body"><dl class="deflist">
            <div><dt>Source workbook</dt><dd class="num" style="font-size:12px">${D.meta.project ? esc(D.meta.project) + (D.meta.reportDate ? ' · ' + shortDate(D.meta.reportDate) : '') : '<span class="faint">None loaded</span>'}</dd></div>
            <div><dt>Budget lines</dt><dd class="num">${D.budget.length}</dd></div>
            <div><dt>Schedule tasks</dt><dd class="num">${D.schedule.length}</dd></div>
            <div><dt>Vendor accounts</dt><dd class="num">${D.vendors.length}</dd></div>
            <div><dt>Ledger transactions</dt><dd class="num">${D.ledger.length}</dd></div>
          </dl></div>
        </div>
        ${App.AuthSettings ? App.AuthSettings.render() : ''}`;
      $('.chipbar', $('#page-settings')).addEventListener('click', e => {
        const c = e.target.closest('[data-theme]'); if (!c) return;
        $$('#page-settings [data-theme]').forEach(x => x.classList.toggle('is-active', x === c));
        App.store.set('theme', c.dataset.theme);
        document.documentElement.dataset.theme = c.dataset.theme;
        const b = $('#themeBtn'); if (b) $('i', b).className = c.dataset.theme === 'dark' ? 'fa-regular fa-sun' : 'fa-regular fa-moon';
        document.dispatchEvent(new CustomEvent('itd:theme', { detail: { theme: c.dataset.theme } }));
      });
      $('#exportBtn').addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(D, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'intandem-desk-data.json'; a.click();
        URL.revokeObjectURL(url); App.toast('Export ready', 'intandem-desk-data.json downloaded.', 'good');
      });
      $('#resetBtn').addEventListener('click', () => {
        Object.keys(localStorage).filter(k => k.startsWith('itd.')).forEach(k => localStorage.removeItem(k));
        App.toast('Preferences reset', 'Theme and layout cleared.', 'good');
      });
      if (App.AuthSettings) App.AuthSettings.bind($('#page-settings'));
    },
    /* Settings is otherwise static, so refresh does nothing — except when
       the caller's role has changed since it was rendered. Without this a
       promotion or demotion mid-session leaves the wrong page up until a
       full reload. */
    _renderedBlocked: null,
    refresh() {
      const blocked = !!(App.Roles && !App.Roles.can.accessSettings());
      if (blocked !== this._renderedBlocked) this.mount();
    }
  };
  App.register('settings', settings);
})(window.App);

