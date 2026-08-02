# Roles and approvals — specification

Status: **draft for review.** Nothing here is built yet.

Decisions taken 2026-08-01:

- Approval applies to **payment requests** and **material purchases**.
- **Two tiers: Admin/Owner and Staff.** Admin and Owner are the same
  thing — one label, "Admin/Owner". An earlier draft split them; that is
  superseded.
- Approvals go into Firestore **before** the workbook data does.

| Tier | People |
|---|---|
| **Admin/Owner** | Sajith · Ramya · Vamsidhar |
| **Staff** | Anil · Vinay · Pavan · Swamy |

---

## 1. Why this forces a backend

Today every user-created record — projects, tasks, payments, activity — lives
in `localStorage` under the `itd.` prefix. That is **per browser**. A request
raised by Vinay on his phone exists only on Vinay's phone.

An approval workflow is shared state by definition: one person writes, another
reads and decides. There is no version of this that works in `localStorage`.

So `requests` becomes the first real Firestore collection beyond `staff`, and
the pattern established here is the one the workbook data follows later.

## 2. The two tiers

| Tier | Can do | Cannot do |
|---|---|---|
| **Admin/Owner** | Everything. All financial data, approvals, member management, settings. | — |
| **Staff** | Raises requests. Works own tasks. | See firm-wide money. Approve anything. Manage members or settings. |

Admin and Owner are **one tier under one label**. There is no partial
Admin/Owner: anyone in it sees the bank balances and can add or remove
another member.

**How each tier is decided — and why this matters:**

| Tier | Defined by | To change it |
|---|---|---|
| Admin/Owner | Email listed in `isAdmin()` in `firestore.rules` | Edit the list, then `firebase deploy --only firestore:rules` |
| Staff | A document in `staff` with `status: "Active"` | The member panel in the app |

The `role` field on a staff document records **intent**. Real Admin/Owner
power comes from the rules email list, which nobody can edit from inside the
app — that is what makes self-promotion impossible.

Collapsing three tiers into two also removes a blocker the earlier draft
carried: a Firestore rule cannot look up the caller's own role while documents
use auto-IDs, so an intermediate Owner tier could only ever be enforced in the
UI. With two tiers both are enforced server-side today, and §4 (re-keying
documents by email) is no longer required for access control — it remains
worth doing later to prevent duplicate-email records.

### Who is where

| Person | Job title (directory) | Department | Tier |
|---|---|---|---|
| Sajith | — | — | **Admin/Owner** |
| Ramya | Design & PMC Engineer | Design & PMC | **Admin/Owner** |
| Vamsidhar | Construction Manager & Accounts Coordinator | Projects & Accounts | **Admin/Owner** |
| Anil Rajkumar | Site Engineer & PMC Coordinator | Site & PMC | Staff |
| Vinay | Material & Inventory Coordinator | Procurement | Staff |
| Pavan | Material & Inventory Coordinator | Procurement | Staff |
| Swamy | Office Administrator | Administration | Staff |

The four Staff are exactly the people whose listed duties are *Material
Purchase*, *Payment Requests* and *Office Purchases* — the request raisers.
The model fits because the firm was already shaped this way.

⚠️ **Anil remains Staff** despite *Site Ledger Verification* being his first
listed duty. The assumption is that his check happens offline, before a request
is raised. Revisit if that proves wrong.

## 3. Permission matrix

| Area | Admin/Owner | Staff |
|---|---|---|
| Dashboard — firm rollups | ✅ | project figures only |
| Bank / office cash balances | ✅ view + edit | ❌ |
| Ledger | ✅ | ⚠️ open — §8 |
| Budget | ✅ view + edit | ⚠️ open — §8 |
| Vendors | ✅ | view |
| Schedule / tasks | ✅ | own tasks |
| **Raise** a request | ✅ | ✅ |
| **Approve** a request | ✅ | ❌ |
| See others' requests | all | own only |
| **Manage staff logins** | ✅ | ❌ |
| **Settings / configuration** | ✅ | ❌ |
| Reports / CSV export | ✅ | ⚠️ open — §8 |

## 4. Schema change: key staff documents by email

The current `staff` collection uses Firestore auto-IDs.

⚠️ **Superseded as a requirement.** With two tiers this is no longer needed for
access control — Admin/Owner is decided by the rules email list, which needs no
document lookup. It remains worth doing to make duplicate-email records
structurally impossible. Treat the rest of this section as optional cleanup,
not a blocker.

**Document ID becomes the lowercased email.**

```
staff/{lowercase-email}          e.g.  staff/ramya@example.com
```

Why this is necessary, not cosmetic:

1. **Duplicates become impossible.** Today two documents can carry the same
   email, with undefined behaviour at sign-in. Email-as-ID makes that a
   structural impossibility.
2. **The staff app gets simpler** — a direct document read instead of a query.
3. **A future third tier becomes possible** without a migration, should one ever
   be wanted.

Cost: changing someone's email means delete-and-recreate. Acceptable, and rare.

### Revised `staff` document

```
staff/{lowercase-email}
  name          string
  email         string     // same as the document ID
  phone         string
  department    string     // "Design & PMC"
  jobTitle      string     // "Design & PMC Engineer"  ← was `role`
  role          "Owner" | "Staff"                     ← permission-bearing
  status        "Active" | "Inactive" | "Blocked"
  photo         string
  createdAt     timestamp
```

⚠️ **The old `role` job-title field is now `jobTitle`.** `role` holds the
permission — "Owner" or "Staff" — and nothing else. A job description sitting
next to a permission field under a near-identical name is how access-control
bugs get written.

`role` records **intent**. The `isAdmin()` email list in the rules remains the
*authoritative* check; the field drives what the interface shows.

## 5. Security rules (design)

```
function isSignedIn() { return request.auth != null; }

// Authoritative admin check — an email list, not data. A compromised
// Firestore write can never manufacture an admin.
function isAdmin() {
  return isSignedIn()
    && request.auth.token.email_verified == true
    && request.auth.token.email in [
         'sajithnair.rm@gmail.com',
         'ramya.chalumuri92@gmail.com'
       ];
}

function me() {
  return get(/databases/$(database)/documents/staff/$(request.auth.token.email)).data;
}
function isActive() {
  return isSignedIn()
    && exists(/databases/$(database)/documents/staff/$(request.auth.token.email))
    && me().status == 'Active';
}
// With two tiers this is simply isAdmin(). Kept as a named function so a
// future third tier is a one-line change here rather than everywhere.
function isOwner() { return isAdmin(); }

match /staff/{email} {
  // Anyone active may read the directory. Only Admin may change it.
  allow read:   if isAdmin() || isActive();
  allow write:  if isAdmin();
}

match /requests/{id} {
  allow read: if isOwner()
    || (isActive() && request.auth.token.email == resource.data.createdByEmail);

  allow create: if isActive()
    && request.resource.data.createdByEmail == request.auth.token.email
    && request.resource.data.status == 'submitted'
    && request.resource.data.decidedByEmail == null;

  // Author may edit only while still open, and may never change status.
  allow update: if isActive()
    && request.auth.token.email == resource.data.createdByEmail
    && resource.data.status in ['submitted', 'returned']
    && request.resource.data.status == 'submitted'
    && request.resource.data.createdByEmail == resource.data.createdByEmail;

  // Owners and Admin decide.
  allow update: if isOwner()
    && request.resource.data.createdByEmail == resource.data.createdByEmail;

  allow delete: if isAdmin();
}
```

Properties this buys, none bypassable from a browser:

1. **Staff cannot approve.** A non-Owner can only ever write `status:
   'submitted'`.
2. **Staff cannot see others' requests.** Reads keyed on their own verified
   token email.
3. **An approved request cannot be edited.** Once status leaves
   `submitted`/`returned`, the author's update rule stops matching.
4. **Owners cannot grant access.** `staff` writes require `isAdmin()`, which is
   an email list no data change can satisfy.
5. **A blocked person loses everything immediately.** `isActive()` gates every
   rule, and it reads `status` live.

⚠️ Rules `get()` calls are billed as reads and capped at 10 per evaluation.
The design uses at most two. Fine, but worth knowing before adding more tiers.

## 6. The two request types

### Payment request
```
type "payment" · projectId · vendor · towards · amount (₹)
mode "Cash"|"Bank"|"UPI" · neededBy · note
```

### Material purchase
```
type "material" · projectId · vendor · items[ {name, qty, unit, rate} ]
estimate (₹) · neededBy · note
```

### States

```
          ┌──────────── returned ◄─────────┐
          ▼                                │
      submitted ──────► approved           │
          │                                │
          └──────────► rejected            │
   (author edits, resubmits) ──────────────┘
```

| State | Set by | Meaning |
|---|---|---|
| `submitted` | Author, on create | Waiting. Editable by its author. |
| `approved` | Owner / Admin | Authorised. Locked. Flows to the ledger (phase 4). |
| `rejected` | Owner / Admin | Declined and closed. Locked. |
| `returned` | Owner / Admin | Sent back for changes. Author may resubmit. |

No `draft` state — an unsubmitted request is an unsaved form and doesn't need
to exist on the server.

### `requests` document

```
requests/{autoId}
  type            "payment" | "material"
  status          "submitted" | "approved" | "rejected" | "returned"
  createdByEmail  string      // lowercase — the ownership key
  createdByName   string
  createdAt / updatedAt   timestamp
  projectId · vendor · amount · …type-specific fields
  decidedByEmail  string      // null until decided
  decidedAt       timestamp
  decisionNote    string      // required to reject or return
```

## 7. Changes required to the existing apps

⚠️ **The admin console's auth gate must change.** It currently admits only
accounts in the `isAdmin()` list — Ramya and Vamsidhar would be turned away
with "Not an administrator". Owners need the console, because that is where the
money lives.

- Gate admits **Admin or Owner**. The current capability probe (reading the
  whole `staff` collection) no longer distinguishes them, since Owners can read
  the directory too. With two tiers this no longer matters — Admin/Owner is the rules email list, and the gate already proves membership of it.
- The **Staff login access** panel becomes Admin-only — hidden for Owners.
- **Settings** becomes Admin-only.
- The gate's rejection copy needs a third case: signed in, active, but Staff →
  "use the staff app", not "not an administrator".
- Existing staff documents must be **migrated to email-keyed IDs** with
  `role` → `jobTitle`, with `role` becoming the permission field. The collection is currently
  empty, so doing this now costs nothing. **Doing it later costs a migration.**

## 8. Open questions — business decisions, not code

1. **What should Staff see?** The inherited staff build shows the full
   638-row ledger, complete budget and every vendor balance. Nobody chose that;
   it was copied from the admin app. Options: full / own project only /
   summary only / none. **Blocks the staff app.**
2. **Can Staff export CSV?**
3. **Does an approved payment auto-post to the ledger,** or wait in
   "approved, awaiting payment" until someone marks it paid?
4. **Notifications** — in-app is free; email or WhatsApp needs Cloud Functions,
   which require the paid Blaze plan.
5. **Attachments** — photos or bills mean Firebase Storage, more rules, cost.
6. **Real Google addresses for Ramya and Vamsidhar.** The directory holds
   `@intandembuild.in` addresses that were never verified as live accounts.

## 9. Build order

| Phase | Deliverable | Notes |
|---|---|---|
| **1** | `staff` schema: `role` = permission, `jobTitle` = job | Collection is empty — do it now, free |
| **2** | Admin console gate admits Owners; login panel Admin-only | Re-test all three tiers |
| **3** | `requests` collection + rules | Testable by seeding documents by hand |
| **4** | Owner approval queue in the console | Usable before the staff app exists |
| **5** | Staff app + the two request forms | Staff app returns to scope |
| **6** | Approved requests flow to ledger and reports | Closes Staff → Ledger → Reports |
| **7** | Workbook data (`window.DATA`) into Firestore | Pattern set by phase 3 |

Phase 1 is the cheapest it will ever be — the `staff` collection has no
documents yet.
