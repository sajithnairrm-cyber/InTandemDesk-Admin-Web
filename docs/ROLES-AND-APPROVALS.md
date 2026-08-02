# Roles and approvals — specification

Status: **draft for review.** Nothing here is built yet.

Decisions taken 2026-08-01:

- Approval applies to **payment requests** and **material purchases**.
- **Three tiers: Admin / Owner / Staff.**
- Approvals go into Firestore **before** the workbook data does.

| Tier | People |
|---|---|
| **Admin** | Sajith |
| **Owner** | Ramya · Vamsidhar |
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

## 2. The three tiers

| Tier | Can do | Cannot do |
|---|---|---|
| **Admin** | Everything. Grants and revokes access, edits settings, deploys. | — |
| **Owner** | Sees all firm money. Approves payments and material purchases. | Grant or revoke anyone's access. Change settings. |
| **Staff** | Raises requests. Works own tasks. | See firm-wide money. Approve anything. |

The separation that matters: **Owner controls money, Admin controls access.**
Ramya and Vamsidhar can approve a ₹5 lakh payment but cannot add a login.
Only Sajith decides who gets in at all.

### Who is where

| Person | Job title (directory) | Department | Tier |
|---|---|---|---|
| Sajith | — | — | **Admin** |
| Ramya | Design & PMC Engineer | Design & PMC | **Owner** |
| Vamsidhar | Construction Manager & Accounts Coordinator | Projects & Accounts | **Owner** |
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

| Area | Admin | Owner | Staff |
|---|---|---|---|
| Dashboard — firm rollups | ✅ | ✅ | project figures only |
| Bank / office cash balances | ✅ view + edit | ✅ view + edit | ❌ |
| Ledger | ✅ | ✅ | ⚠️ open — §8 |
| Budget | ✅ view + edit | ✅ view + edit | ⚠️ open — §8 |
| Vendors | ✅ | ✅ | view |
| Schedule / tasks | ✅ | ✅ | own tasks |
| **Raise** a request | ✅ | ✅ | ✅ |
| **Approve** a request | ✅ | ✅ | ❌ |
| See others' requests | all | all | own only |
| **Manage staff logins** | ✅ | ❌ | ❌ |
| **Settings / configuration** | ✅ | ❌ | ❌ |
| Reports / CSV export | ✅ | ✅ | ⚠️ open — §8 |

Only the last two rows separate Admin from Owner. Everything else is identical.

## 4. Schema change: key staff documents by email

The current `staff` collection uses Firestore auto-IDs. That has to change, and
this is the single most important technical decision in this document.

**Document ID becomes the lowercased email.**

```
staff/{lowercase-email}          e.g.  staff/ramya@example.com
```

Why this is necessary, not cosmetic:

1. **Security rules can look up a person's tier.** Rules can only `get()` a
   document at a *known* path. With auto-IDs there is no way to find "the staff
   document for the signed-in user" from inside a rule. With the email as the
   ID, `get(/databases/$(db)/documents/staff/$(request.auth.token.email))`
   resolves directly. Without this, an Owner tier cannot be enforced server-side
   at all — it could only be faked in the UI, which is not security.
2. **Duplicates become impossible.** Today two documents can carry the same
   email, with undefined behaviour at sign-in. Email-as-ID makes that a
   structural impossibility.
3. **The staff app gets simpler** — a direct document read instead of a query.

Cost: changing someone's email means delete-and-recreate. Acceptable, and rare.

### Revised `staff` document

```
staff/{lowercase-email}
  name          string
  email         string     // same as the document ID
  phone         string
  department    string     // "Design & PMC"
  jobTitle      string     // "Design & PMC Engineer"  ← was `role`
  accessLevel   "Admin" | "Owner" | "Staff"            ← NEW, permission-bearing
  status        "Active" | "Inactive" | "Blocked"
  photo         string
  createdAt     timestamp
```

⚠️ **`role` is renamed to `jobTitle`.** The existing `role` field holds a job
description ("Design & PMC Engineer") and is displayed on staff cards. Leaving
a permission field next to it under a near-identical name is how access-control
bugs get written. `accessLevel` is the only field that grants anything.

**Sajith gets a staff document too**, with `accessLevel: "Admin"`. That keeps
the UI uniform — every signed-in person has a document describing them. The
`isAdmin()` email list in the rules remains the *authoritative* check for
admin-only writes; the field only drives what the interface shows.

## 5. Security rules (design)

```
function isSignedIn() { return request.auth != null; }

// Authoritative admin check — an email list, not data. A compromised
// Firestore write can never manufacture an admin.
function isAdmin() {
  return isSignedIn()
    && request.auth.token.email_verified == true
    && request.auth.token.email in ['sajithnair.rm@gmail.com'];
}

function me() {
  return get(/databases/$(database)/documents/staff/$(request.auth.token.email)).data;
}
function isActive() {
  return isSignedIn()
    && exists(/databases/$(database)/documents/staff/$(request.auth.token.email))
    && me().status == 'Active';
}
function isOwner() {
  return isAdmin() || (isActive() && me().accessLevel in ['Owner', 'Admin']);
}

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
  the directory too. Replace it with: read own `staff` document → `accessLevel`.
- The **Staff login access** panel becomes Admin-only — hidden for Owners.
- **Settings** becomes Admin-only.
- The gate's rejection copy needs a third case: signed in, active, but Staff →
  "use the staff app", not "not an administrator".
- Existing staff documents must be **migrated to email-keyed IDs** with
  `role` → `jobTitle` and a new `accessLevel`. The collection is currently
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
| **1** | `staff` schema change + `accessLevel` + rules | Collection is empty — do it now, free |
| **2** | Admin console gate admits Owners; login panel Admin-only | Re-test all three tiers |
| **3** | `requests` collection + rules | Testable by seeding documents by hand |
| **4** | Owner approval queue in the console | Usable before the staff app exists |
| **5** | Staff app + the two request forms | Staff app returns to scope |
| **6** | Approved requests flow to ledger and reports | Closes Staff → Ledger → Reports |
| **7** | Workbook data (`window.DATA`) into Firestore | Pattern set by phase 3 |

Phase 1 is the cheapest it will ever be — the `staff` collection has no
documents yet.
