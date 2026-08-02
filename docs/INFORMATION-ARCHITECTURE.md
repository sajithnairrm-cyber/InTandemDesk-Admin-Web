# Information architecture — review and proposal

Status: **proposal for discussion.** Nothing here is built.

A review of the current eleven tabs against how an architecture / PMC practice
in India actually operates, and a proposed structure.

---

## 1. The central observation

**The application tracks money going out. It does not track money coming in.**

Budget, Payments, Vendors and Ledger — four of eleven tabs — are all about
paying contractors and suppliers. There is nothing anywhere about the firm's
own fees: no stage-wise fee schedule, no client invoice, no receivable, no
record of what InTandem Build is owed or has been paid.

For a consultancy, that is half the business missing. You can currently answer
"how much have we released to the plumber" but not "how much has the client
paid us this quarter".

**The second gap: there is no drawing control.** For a practice whose Design &
PMC engineer produces *Architectural Design, Drawing Management and Design
Revisions* — Ramya's listed duties — there is no drawings register, no revision
history, no issue record. That is the core artefact of an architecture office
and it does not exist in the software.

Both gaps have the same cause: the app was generated from a weekly cost
workbook, so it inherited the workbook's worldview.

## 2. Current tabs, assessed

| Tab | Verdict |
|---|---|
| **Dashboard** | Keep. Good. Needs receivables and a pending-approvals count. |
| **Projects** | Keep, but reconcile — see §5. |
| **Schedule** | Keep. 235 tasks with area/vendor/status is solid. |
| **Budget** | Keep. Promote `extraWorks` to first-class variations. |
| **Payments** | Repurpose as the approval queue. |
| **Vendors** | Keep. Rename *Vendors & Contractors*. Missing retention and contract value. |
| **Ledger** | Keep. The strongest part of the app. |
| **Staff** | Keep. Covered by the roles work. |
| **Reports** | Keep, but it should generate the weekly PMC report, not just export CSV. |
| **News** | ⚠️ **Drop.** A Google News RSS feed is not a work tool. It also routes every request through three third-party proxies. Lowest-value tab by a distance. |
| **Settings** | Keep. Admin-only. |

## 3. Proposed structure

★ = new

```
OVERVIEW
  Dashboard
  Projects

DESIGN
  Drawings          ★  register · revisions · issue log
  Approvals         ★  statutory: GHMC / HMDA / fire NOC

SITE
  Schedule
  Site Reports      ★  weekly PMC report · progress photos
  Snags             ★  defects list, handover stage

COMMERCIAL
  Budget               + variations
  Certification     ★  contractor bill certification
  Payments             approval queue + released
  Vendors              + contract value, retention
  Ledger

CLIENT
  Invoicing         ★  fee stages · invoices · receivables

FIRM
  Staff
  Reports
  Settings
```

Fifteen tabs, six new, one dropped. Grouped navigation keeps it navigable —
the sidebar already supports group headers.

## 4. The six proposed additions, in priority order

### 1. Invoicing — how the firm gets paid
**Highest business value.** Stage-wise fee schedule (COA scale or a negotiated
percentage), invoice against stage completion, GST, receivables ageing, payment
received. Answers "what are we owed" — currently unanswerable.

### 2. Drawings — the register
**Highest professional value.** Drawing number, title, discipline, revision
(Rev A/B/C), status (WIP / Issued for Approval / Approved / GFC / Superseded),
issued-to and issued-on, superseded-by. Plus a transmittal record: who received
which revision, when.

Every architecture practice runs on this. Without it, "which drawing is the
contractor building from" is answered by memory.

### 3. Certification — the PMC deliverable
Certifying contractor bills *is* the service a PMC sells. Contractor claims
₹X → measured → certified at ₹Y → deductions (retention, advance recovery,
TDS) → net payable → released. The Ledger records the payment but nothing
records the certification that authorised it.

### 4. Site Reports
Anil's listed duties are *Site Progress, Daily Reports, Quality Inspection*.
The data already carries `reportDate` and a named engineer. The weekly PMC
report is a formal deliverable to the client; it should be generated, not
retyped.

### 5. Approvals — statutory
Hyderabad projects need GHMC/HMDA sanction, and often fire NOC, environmental
clearance, electrical and water connections. A tracker: authority, applied-on,
status, expected, actual, fee paid, document. Simple table, high consequence.

### 6. Snags — defects
Room/area, description, responsible contractor, raised-on, due, closed-on,
photo. Matters at handover and through the defects liability period. Lowest
urgency; build last.

## 5. Changes to existing tabs

### Projects — reconcile the split
Two incompatible ideas coexist. `window.DATA` is one real engagement
(Ayyappa's Residence, from the workbook). `App.Store` holds separately created
projects in `localStorage`, seeded with "Thanal". The Dashboard shows the
workbook project; the Projects tab shows the localStorage ones. They are not
the same list, and nothing reconciles them.

Fix: one project collection in Firestore, with the workbook engagement as a
record in it. Follows naturally from the Firestore migration.

### Commercial gaps worth naming
Three things standard in Indian construction contracts that the data model has
no concept of:

- **Retention** — typically 5% held from each bill, half released at completion
  and half after the defects liability period. Not modelled anywhere. Vendors
  show quotation / released / balance with no retention held.
- **TDS** — deducted at source on contractor payments, remitted, and
  certificated. Not modelled.
- **Advance and its recovery** — mobilisation advance recovered pro-rata
  against bills. Not modelled.

Without these, "balance payable to vendor" is wrong for any contractor under a
formal contract. It happens to be right today because the workbook treats
payments as simple releases.

### Budget — promote variations
`extraWorks` already exists in the data — seven entries, ₹23,00,000. It is
rendered as a footnote. Extra works and variations are where projects actually
overrun; they deserve their own view with approval status per item, tied to the
request approval flow.

### Dashboard — two additions
Receivables (once Invoicing exists) and a **pending approvals** count, so an
Owner opening the app sees immediately that four requests are waiting.

## 6. Suggested sequence

| | Work | Why here |
|---|---|---|
| 1 | Roles + approvals (spec'd separately) | In progress; unblocks everything multi-user |
| 2 | Firestore migration incl. projects reconcile | Prerequisite for all shared data |
| 3 | **Invoicing** | Biggest business gap |
| 4 | **Drawings** | Biggest professional gap |
| 5 | **Certification** + retention / TDS / advance | Makes vendor balances correct |
| 6 | **Site Reports** | Automates an existing weekly deliverable |
| 7 | Approvals · Snags · Variations view | Rounding out |
| — | Drop **News** | Any time |

## 7. What not to build

Worth saying explicitly, because feature lists grow:

- **Time-sheets / staff utilisation.** Seven people who all know what they did.
- **CRM / lead pipeline.** Until there is a flow of enquiries to manage.
- **A mobile app.** The web app is responsive; make it a PWA instead.
- **Anything AI.** No current problem here needs it.
