/* ============================================================
   InTandem Desk — demo data

   Realistic sample data for testing every module. Three projects,
   a full PMC workbook, staff, tasks, payments and activity.

   HOW IT WORKS
   ------------
   Loaded BEFORE itd-core.js, because Derive.* computes its rollups
   once at start-up from window.DATA — replacing DATA afterwards
   would leave every total stale.

   Toggling calls location.reload(), which is why the switch is a
   flag in localStorage rather than a runtime call.

   NOT COMMITTED INTO itd-data.js ON PURPOSE. The shipped data layer
   stays empty — a first-run install must look like a first-run
   install. Demo data is opt-in, clearly labelled in the interface,
   and removable in one click.

   The generator is deterministic (fixed seed), so the same figures
   appear every time. A bug reproduced against demo data reproduces
   for anyone.
   ============================================================ */

(function () {
  'use strict';

  var KEY = 'itd.demo.on';
  var read = function (k, f) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : f; } catch (e) { return f; } };
  var write = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  /* Deterministic PRNG — same data every load. */
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function build() {
    var r = rng(20260803);
    var pick = function (a) { return a[Math.floor(r() * a.length)]; };
    var between = function (lo, hi) { return Math.round(lo + r() * (hi - lo)); };
    var round = function (n, to) { return Math.round(n / to) * to; };
    var iso = function (d) { return d.toISOString().slice(0, 10); };
    var day = function (offset) { var d = new Date(2026, 0, 8); d.setDate(d.getDate() + offset); return iso(d); };

    /* ── Staff ──────────────────────────────────────────────── */
    var staff = [
      { id: 'vamsidhar', name: 'Vamsidhar', role: 'Construction Manager & Accounts', dept: 'Projects & Accounts', h: 210, phone: '+91 98480 11221', email: 'vamsidhar@intandembuild.in', availability: 'Available', perf: 92, match: ['vamsidhar'], resp: ['Project Supervision', 'Accounts', 'Budget Monitoring', 'Client Billing'] },
      { id: 'ramya', name: 'Ramya', role: 'Design & PMC Engineer', dept: 'Design & PMC', h: 285, phone: '+91 98480 22332', email: 'ramya@intandembuild.in', availability: 'On site', perf: 88, match: ['ramya'], resp: ['Architectural Design', 'Client Coordination', 'Drawing Management', 'PMC Monitoring'] },
      { id: 'anil', name: 'Anil Rajkumar', role: 'Site Engineer & PMC Coordinator', dept: 'Site & PMC', h: 158, phone: '+91 98480 33443', email: 'anil@intandembuild.in', availability: 'On site', perf: 90, match: ['anil'], resp: ['Site Ledger Verification', 'Site Progress', 'Daily Reports', 'Quality Inspection'] },
      { id: 'vinay', name: 'Vinay', role: 'Material & Inventory Coordinator', dept: 'Procurement', h: 28, phone: '+91 98480 44554', email: 'vinay@intandembuild.in', availability: 'Available', perf: 84, match: ['vinay'], resp: ['Material Purchase', 'Inventory Updates', 'Vendor Coordination', 'Payment Requests'] },
      { id: 'pavan', name: 'Pavan', role: 'Material & Inventory Coordinator', dept: 'Procurement', h: 8, phone: '+91 98480 55665', email: 'pavan@intandembuild.in', availability: 'Busy', perf: 82, match: ['pavan'], resp: ['Material Purchase', 'Inventory Tracking', 'Labour Scheduling'] },
      { id: 'swamy', name: 'Swamy', role: 'Office Administrator', dept: 'Administration', h: 250, phone: '+91 98480 66776', email: 'swamy@intandembuild.in', availability: 'Available', perf: 86, match: ['swamy'], resp: ['Office Administration', 'Documentation', 'Office Purchases'] }
    ];

    /* ── Areas ──────────────────────────────────────────────── */
    var areaNames = ['Foyer & Living', 'Dining & Kitchen', 'Master Bedroom', 'Bedroom 2', 'Bedroom 3',
                     'Pooja Room', 'Staircase & Lobby', 'Terrace & Utility', 'Elevation & Facade',
                     'Compound & Landscape', 'Services & MEP'];
    var roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    var areas = areaNames.map(function (n, i) { return { code: roman[i], name: n }; });

    /* ── Vendors ────────────────────────────────────────────── */
    var vendorSeed = [
      ['Civil contractor', 'Sri Venkateswara Constructions', 4200000],
      ['Carpentry & joinery', 'Kranthi Wood Works', 2850000],
      ['Electrical', 'Sri Laxmi Electricals & Hardware', 1180000],
      ['Plumbing & sanitary', 'Juveriya Plumbing Works', 940000],
      ['Painting', 'Balaji Painters', 720000],
      ['Flooring & tiles', 'Nakshatra Marbles & Granites', 1650000],
      ['False ceiling', 'Sai Gypsum Interiors', 480000],
      ['Aluminium & glazing', 'Deccan Aluminium Systems', 1320000],
      ['Modular kitchen', 'Hafele Kitchen Studio', 1450000],
      ['Furniture', 'Woodline Furnishings', 890000],
      ['Steel & fabrication', 'Vishnu Steel Fabricators', 610000],
      ['Waterproofing', 'Dr. Fixit Applicators', 285000],
      ['Air conditioning', 'Cool Zone HVAC', 760000],
      ['Landscape', 'Green Leaf Landscapes', 340000],
      ['Lighting & fixtures', 'Lumino Lights', 395000],
      ['Labour & daily wages', 'Kurva Kistanna (Labour)', 1240000]
    ];
    var vendors = vendorSeed.map(function (v, i) {
      var quotation = v[2];
      var pct = i < 4 ? 0.62 + r() * 0.36 : (i > 12 ? r() * 0.45 : 0.3 + r() * 0.6);
      var released = round(quotation * pct, 500);
      if (i === 5 || i === 11) released = quotation;           // a couple fully settled
      return { sino: i + 1, account: v[0], vendor: v[1], quotation: quotation, released: released, balance: quotation - released };
    });

    /* ── Budget lines ───────────────────────────────────────── */
    var sections = ['MAIN', 'NATURAL STONE', 'JOINERY', 'SERVICES', 'FINISHES'];
    var natures = ['Supply & Install', 'Supply only', 'Labour only', 'Turnkey'];
    var types = ['Civil', 'Interior', 'MEP', 'External'];
    var bStatus = ['Finalised', 'In progress', 'Quote awaited', 'Approved'];
    var budgetItems = ['RCC framework', 'Brickwork & plastering', 'Italian marble flooring', 'Vitrified tiles',
      'Granite counters', 'Teak main door', 'Internal flush doors', 'Modular wardrobes', 'Kitchen cabinetry',
      'False ceiling — living', 'False ceiling — bedrooms', 'Concealed wiring', 'DB & switchgear',
      'CP & sanitary fittings', 'Overhead tank & pumps', 'Exterior texture paint', 'Interior emulsion',
      'UPVC windows', 'Toughened glass partitions', 'MS railing — staircase', 'Terrace waterproofing',
      'Split AC units', 'Landscape softscape', 'Compound wall', 'Decorative lighting',
      'Pooja room woodwork', 'Study unit', 'TV console & panelling'];
    var budget = budgetItems.map(function (desc, i) {
      var v = vendors[i % vendors.length];
      var noGst = round(between(85000, 1450000), 500);
      var gst = Math.round(noGst * 1.18);
      var rel = round(gst * (r() * 0.9), 500);
      return {
        sino: i + 1, section: pick(sections), description: desc, nature: pick(natures),
        vendor: v.vendor, type: pick(types), status: pick(bStatus),
        quoteNoGst: noGst, quoteGst: gst, released: rel, balance: gst - rel,
        comments: r() > 0.75 ? 'Revised quote received' : ''
      };
    });

    /* ── Schedule ───────────────────────────────────────────── */
    var statuses = ['Completed', 'Work in progress', 'Final work', 'Installation',
                    'Material to order', 'Work to start', 'Vendor confirmation', 'Factory'];
    var works = ['Marking & layout', 'Excavation', 'Footing & plinth', 'Column casting', 'Slab casting',
      'Brickwork', 'Internal plastering', 'External plastering', 'Electrical conduiting', 'Plumbing rough-in',
      'Flooring — base', 'Flooring — finish', 'Skirting', 'Door frames', 'Shutters & hardware',
      'Wardrobe carcass', 'Wardrobe shutters', 'Ceiling framework', 'Ceiling boarding', 'Ceiling putty',
      'Primer coat', 'Putty & sanding', 'Final paint', 'Switch plates & fixtures', 'CP fittings',
      'Glass & mirrors', 'Railing fabrication', 'Railing installation', 'Waterproof coating',
      'AC piping', 'AC indoor units', 'Kitchen counter', 'Kitchen shutters', 'Furniture delivery',
      'Landscape prep', 'Planting', 'Compound plaster', 'Gate installation', 'Deep cleaning', 'Snag rectification'];
    var schedule = works.map(function (w, i) {
      var a = areas[i % areas.length];
      var st = i < 14 ? 'Completed' : pick(statuses);
      var s = between(0, 150);
      return {
        sino: i + 1, area: a.code, areaName: a.name, description: w,
        nature: pick(natures), vendor: vendors[i % vendors.length].vendor,
        archStatus: pick(['Approved', 'Pending', 'Issued']),
        clientStatus: pick(['Approved', 'Awaiting', 'Reviewed']),
        start: day(s), end: day(s + between(4, 30)), status: st, statusRaw: st
      };
    });

    /* ── Ledger ─────────────────────────────────────────────── */
    var modes = ['Bank', 'Gpay', 'Cash', 'Cheque', 'NEFT'];
    var towards = ['Part payment', 'Advance', 'Material supply', 'Labour charges', 'Final settlement',
      'Site expenses', 'Transport', 'Running bill', 'Retention release', 'Miscellaneous'];
    var ledger = [];
    for (var i = 0; i < 96; i++) {
      var v2 = vendors[Math.floor(r() * vendors.length)];
      ledger.push({
        sino: i + 1, date: day(between(0, 175)),
        vendorRaw: v2.vendor, vendor: v2.vendor, vendorId: v2.sino,
        towards: pick(towards), amount: round(between(4500, 320000), 100),
        account: v2.account, party: v2.vendor, mode: pick(modes)
      });
    }
    ledger.sort(function (a, b) { return a.date.localeCompare(b.date); });
    ledger.forEach(function (t, n) { t.sino = n + 1; });

    /* ── Extra works ────────────────────────────────────────── */
    var extraWorks = [
      { sino: 1, category: 'Additional wardrobes', amount: 385000, items: ['Bedroom 2 loft', 'Bedroom 3 loft'] },
      { sino: 2, category: 'Terrace pergola', amount: 240000, items: ['MS structure', 'Polycarbonate roofing'] },
      { sino: 3, category: 'Upgraded sanitary', amount: 175000, items: ['Jaquar premium range'] },
      { sino: 4, category: 'Facade cladding', amount: 520000, items: ['HPL panels', 'Aluminium framing'] },
      { sino: 5, category: 'Home automation', amount: 310000, items: ['Lighting control', 'Curtain motors'] }
    ];
    var extraWorksTotal = extraWorks.reduce(function (s, e) { return s + e.amount; }, 0);

    var quoteTotal = vendors.reduce(function (s, v) { return s + v.quotation; }, 0);
    var relTotal = vendors.reduce(function (s, v) { return s + v.released; }, 0);

    var DATA = {
      meta: {
        firm: 'InTandem Build',
        nature: 'Project Management Consultancy',
        project: "Mr. & Mrs. Ayyappa's Residence",
        client: 'Mr. Ayyappa',
        location: 'Habsiguda, Hyderabad',
        engineer: 'Anil Rajkumar',
        reportDate: day(176),
        budgetSheetTotal: budget.reduce(function (s, b) { return s + b.quoteGst; }, 0),
        balanceBudget: quoteTotal + extraWorksTotal,
        balanceReleased: relTotal,
        balanceOutstanding: quoteTotal + extraWorksTotal - relTotal
      },
      budget: budget, schedule: schedule, areas: areas, vendors: vendors,
      extraWorks: extraWorks, extraWorksTotal: extraWorksTotal, ledger: ledger
    };

    /* ── Projects (Store) ───────────────────────────────────── */
    var projects = [
      { id: 'demo-ayyappa', name: "Mr. & Mrs. Ayyappa's Residence", client: 'Mr. Ayyappa',
        phone: '+91 98495 10101', email: 'ayyappa@example.com', address: 'Habsiguda, Hyderabad',
        location: 'Habsiguda, Hyderabad', type: 'Independent Residence', category: 'Residential',
        priority: 'High', start: day(0), due: day(240), budget: 38727739, spent: relTotal,
        status: 'In Progress', completion: 72, staff: ['anil', 'ramya', 'vamsidhar', 'vinay'],
        description: 'Ground + 1 independent residence with full interiors. PMC engagement covering budget control, vendor management and weekly site reporting.',
        notes: 'Client prefers Italian marble in living. Handover targeted before Ugadi.',
        updated: new Date().toISOString() },

      { id: 'demo-nilayam', name: 'Sri Nilayam Apartments', client: 'Sri Nilayam Developers',
        phone: '+91 98495 20202', email: 'projects@srinilayam.example.com', address: 'Kondapur, Hyderabad',
        location: 'Kondapur, Hyderabad', type: 'Residential Apartments', category: 'Residential',
        priority: 'Medium', start: day(60), due: day(420), budget: 61500000, spent: 18450000,
        status: 'In Progress', completion: 31, staff: ['vamsidhar', 'pavan'],
        description: 'G+5 apartment block, 18 units. PMC scope: cost control, contractor billing certification and quality audit.',
        notes: 'Slab casting for 3rd floor scheduled next month. RERA documentation pending.',
        updated: new Date().toISOString() },

      { id: 'demo-aroma', name: 'Cafe Aroma — Jubilee Hills', client: 'Aroma Hospitality LLP',
        phone: '+91 98495 30303', email: 'ops@aromahospitality.example.com', address: 'Road No. 36, Jubilee Hills',
        location: 'Jubilee Hills, Hyderabad', type: 'Cafe & Restaurant', category: 'Hospitality',
        priority: 'Low', start: day(-180), due: day(-30), budget: 9800000, spent: 9620000,
        status: 'Completed', completion: 100, staff: ['ramya', 'swamy'],
        description: '2,400 sqft cafe fit-out including kitchen, seating and facade. Completed and handed over.',
        notes: 'Defects liability period runs to end of quarter. Two minor snags pending.',
        updated: new Date().toISOString() }
    ];

    /* ── Tasks (kanban) ─────────────────────────────────────── */
    var taskStatuses = ['To Do', 'In Progress', 'Review', 'Completed'];
    var prios = ['High', 'Medium', 'Low'];
    var taskSeed = {
      'demo-ayyappa': ['Certify carpentry running bill', 'Site visit — flooring inspection', 'Approve wardrobe shop drawings',
        'Reconcile electrical vendor account', 'Chase UPVC delivery date', 'Weekly client report — week 24',
        'Snag list for master bedroom', 'Release retention to painter'],
      'demo-nilayam': ['Verify 3rd floor slab quantities', 'Contractor bill 07 certification', 'RERA document checklist',
        'Site safety audit', 'Material reconciliation — steel', 'Client meeting — cost variance'],
      'demo-aroma': ['Close remaining snags', 'Collect final retention', 'Handover document set',
        'DLP inspection — month 3']
    };
    var tasks = {};
    Object.keys(taskSeed).forEach(function (pid) {
      tasks[pid] = taskSeed[pid].map(function (t, i) {
        var done = pid === 'demo-aroma' ? i < 2 : i < 3;
        var st = done ? 'Completed' : taskStatuses[i % 3];
        return {
          id: 't-' + pid + '-' + i, title: t,
          desc: 'Auto-generated demo task for testing the kanban board and task filters.',
          assignee: pick(projects.find(function (p) { return p.id === pid; }).staff),
          priority: pick(prios), status: st, due: day(between(150, 220)),
          progress: st === 'Completed' ? 100 : between(10, 80)
        };
      });
    });

    /* ── Payments (client invoices) ─────────────────────────── */
    var payments = [
      { id: 'pay-1', projectId: 'demo-ayyappa', invoiceNo: 'ITB/2026/014', client: 'Mr. Ayyappa', invoiceDate: day(120), dueDate: day(150), amount: 850000, gst: 18, method: 'Bank transfer', status: 'Paid', refNo: 'NEFT/8841', remarks: 'Stage 4 PMC fee' },
      { id: 'pay-2', projectId: 'demo-ayyappa', invoiceNo: 'ITB/2026/019', client: 'Mr. Ayyappa', invoiceDate: day(160), dueDate: day(190), amount: 650000, gst: 18, method: 'Bank transfer', status: 'Due', refNo: '', remarks: 'Stage 5 PMC fee' },
      { id: 'pay-3', projectId: 'demo-nilayam', invoiceNo: 'ITB/2026/016', client: 'Sri Nilayam Developers', invoiceDate: day(130), dueDate: day(160), amount: 1250000, gst: 18, method: 'Cheque', status: 'Paid', refNo: 'CHQ/554120', remarks: 'Mobilisation + stage 1' },
      { id: 'pay-4', projectId: 'demo-nilayam', invoiceNo: 'ITB/2026/021', client: 'Sri Nilayam Developers', invoiceDate: day(168), dueDate: day(198), amount: 980000, gst: 18, method: 'Bank transfer', status: 'Partial', refNo: 'NEFT/9012', remarks: '50% received' },
      { id: 'pay-5', projectId: 'demo-nilayam', invoiceNo: 'ITB/2026/023', client: 'Sri Nilayam Developers', invoiceDate: day(174), dueDate: day(204), amount: 760000, gst: 18, method: 'Bank transfer', status: 'Due', refNo: '', remarks: 'Stage 3 certification' },
      { id: 'pay-6', projectId: 'demo-aroma', invoiceNo: 'ITB/2025/098', client: 'Aroma Hospitality LLP', invoiceDate: day(-90), dueDate: day(-60), amount: 480000, gst: 18, method: 'UPI', status: 'Paid', refNo: 'UPI/7781', remarks: 'Final fee' },
      { id: 'pay-7', projectId: 'demo-aroma', invoiceNo: 'ITB/2025/101', client: 'Aroma Hospitality LLP', invoiceDate: day(-40), dueDate: day(-10), amount: 145000, gst: 18, method: 'Bank transfer', status: 'Due', refNo: '', remarks: 'Retention — release after DLP' }
    ];

    /* ── Activity ───────────────────────────────────────────── */
    var who = ['Vamsidhar', 'Ramya', 'Anil', 'Vinay', 'You'];
    var acts = ['Project created', 'Budget revised', 'Payment recorded', 'Task added', 'Vendor quote received',
                'Site visit logged', 'Drawing issued', 'Bill certified'];
    var activity = {};
    projects.forEach(function (p) {
      activity[p.id] = [];
      for (var k = 0; k < 6; k++) {
        var d = new Date(); d.setDate(d.getDate() - between(1, 60));
        activity[p.id].push({ msg: pick(acts), who: pick(who), at: d.toISOString() });
      }
      activity[p.id].sort(function (a, b) { return b.at.localeCompare(a.at); });
    });

    /* ── Per-project schedules ──────────────────────────────────
       Each project owns its work items outright. Nothing is shared,
       so one project can never display another's schedule. */
    var schedules = {};
    schedules['demo-ayyappa'] = schedule;                      // the workbook engagement

    schedules['demo-nilayam'] = works.slice(0, 22).map(function (w, i) {
      var a = areas[i % 6];
      var st = i < 6 ? 'Completed' : pick(statuses);
      var sd = between(60, 240);
      return { sino: i + 1, area: a.code, areaName: a.name, description: w, nature: pick(natures),
               vendor: vendors[(i + 3) % vendors.length].vendor, archStatus: pick(['Approved', 'Pending']),
               clientStatus: pick(['Approved', 'Awaiting']), start: day(sd), end: day(sd + between(6, 40)),
               status: st, statusRaw: st };
    });

    schedules['demo-aroma'] = works.slice(0, 14).map(function (w, i) {
      var a = areas[i % 4];
      return { sino: i + 1, area: a.code, areaName: a.name, description: w, nature: pick(natures),
               vendor: vendors[(i + 7) % vendors.length].vendor, archStatus: 'Approved', clientStatus: 'Approved',
               start: day(-170 + i * 8), end: day(-160 + i * 8), status: 'Completed', statusRaw: 'Completed' };
    });

    /* ── Milestones — the standard construction sequence ────────── */
    var msNames = ['Foundation', 'Structure', 'Masonry', 'Plumbing', 'Electrical', 'Interior', 'Finishing', 'Handover'];
    var milestones = {};
    projects.forEach(function (p) {
      var doneTo = p.id === 'demo-aroma' ? 8 : (p.id === 'demo-ayyappa' ? 5 : 2);
      milestones[p.id] = msNames.map(function (n, i) {
        var planned = day(between(10, 230));
        return {
          id: 'ms-' + p.id + '-' + i, name: n, planned: planned,
          actual: i < doneTo ? planned : '',
          status: i < doneTo ? 'Completed' : (i === doneTo ? 'In progress' : pick(['Pending', 'Pending', 'Delayed'])),
          engineer: pick(p.staff), notes: i < doneTo ? 'Signed off on site.' : '', attachments: []
        };
      });
    });

    /* Ayyappa carries a revised date, so the delay indicator has
       something real to show. */
    var schedmeta = {
      'demo-ayyappa': { start: day(0), planned: day(240), revised: day(268) },
      'demo-nilayam': { start: day(60), planned: day(420), revised: '' },
      'demo-aroma':   { start: day(-180), planned: day(-30), revised: '' }
    };

    return { DATA: DATA, projects: projects, tasks: tasks, payments: payments, activity: activity,
             staff: staff, schedules: schedules, milestones: milestones, schedmeta: schedmeta };
  }

  /* ── Public API ─────────────────────────────────────────── */
  window.ITDDemo = {
    get isOn() { return read(KEY, false) === true; },

    load: function () {
      var d = build();
      write('itd.projects', d.projects);
      write('itd.tasks', d.tasks);
      write('itd.payments', d.payments);
      write('itd.activity', d.activity);
      write('itd.schedules', d.schedules);
      write('itd.milestones', d.milestones);
      write('itd.schedmeta', d.schedmeta);
      write(KEY, true);
      location.reload();
    },

    clear: function () {
      ['itd.projects', 'itd.tasks', 'itd.payments', 'itd.activity',
       'itd.schedules', 'itd.milestones', 'itd.schedmeta', KEY]
        .forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
      location.reload();
    }
  };

  /* URL switch: ?demo=1 turns it on, ?demo=0 off.

     The web and mobile apps run on different ports, which browsers treat
     as separate origins — so localStorage, and therefore the demo flag,
     is NOT shared between them. Each app has to be seeded on its own.
     On a phone that is fiddly, hence the query parameter. */
  try {
    var q = new URLSearchParams(location.search).get('demo');
    if (q === '1' && !window.ITDDemo.isOn) { window.ITDDemo.load(); }
    else if (q === '0' && window.ITDDemo.isOn) { window.ITDDemo.clear(); }
  } catch (e) {}

  /* Apply at boot, before itd-core.js reads window.DATA. */
  if (window.ITDDemo.isOn && window.DATA) {
    var d = build();
    Object.keys(d.DATA).forEach(function (k) { window.DATA[k] = d.DATA[k]; });
    window.ITD_STAFF_SEED = d.staff;
  }
})();
