/* ============================================================
   InTandem Desk — roles and permissions

   Two roles: Owner and Staff. Stored on the Firestore `staff`
   document as `role`.

     { name, email, phone, role: "Owner" | "Staff", … }

   ⚠️ NAMING: the earlier build used `role` for a job title
   ("Design & PMC Engineer"). That is now `jobTitle`. `role` is
   the permission field and nothing else — one field, one meaning.
   Old documents without a `role` are treated as Staff, which is
   the safe default: it grants nothing.

   ⚠️ THIS FILE IS NOT SECURITY. Everything here decides what the
   interface offers. A browser console can bypass all of it. The
   real boundary is firestore.rules, which must be deployed for
   these restrictions to mean anything.
   ============================================================ */

(function (App) {
  'use strict';

  const OWNER = 'Owner';
  const STAFF = 'Staff';
  const ALL = [OWNER, STAFF];

  /** Normalise anything to a valid role. Unknown → Staff (grants least). */
  function norm(r) {
    const v = String(r || '').trim().toLowerCase();
    if (v === 'owner') return OWNER;
    return STAFF;
  }

  /** Role badge. Reuses the existing .pill component so it matches
      every other status chip in the app. */
  function badge(role, opts) {
    const r = norm(role);
    const o = opts || {};
    const cls = r === OWNER ? 'role-owner' : 'role-staff';
    const icon = r === OWNER ? 'fa-crown' : 'fa-user';
    return `<span class="pill ${cls}"${o.title ? ` title="${App.esc(o.title)}"` : ''}>` +
      `${o.icon === false ? '' : `<i class="fa-solid ${icon}" style="font-size:8px"></i>`}${r}</span>`;
  }

  /** <option> list for a role <select>. */
  function options(selected) {
    const s = norm(selected);
    return ALL.map(r => `<option value="${r}" ${r === s ? 'selected' : ''}>${r}</option>`).join('');
  }

  /* ── Who am I ───────────────────────────────────────────────
     An account listed in isAdmin() in firestore.rules is always an
     Owner — that list is the root of trust and cannot be edited from
     inside the app. Otherwise the role comes from the person's own
     staff document. */
  let selfRecord = null;

  function setSelf(rec) { selfRecord = rec || null; return selfRecord; }

  function currentRole() {
    const A = window.ITDAdminAuth;
    if (A && A.state && A.state.isAdmin) return OWNER;
    return selfRecord ? norm(selfRecord.role) : STAFF;
  }

  function currentEmail() {
    const A = window.ITDAdminAuth;
    return ((A && A.state && A.state.user && A.state.user.email) || '').toLowerCase();
  }

  const isOwner = () => currentRole() === OWNER;

  /* ── Permission matrix ──────────────────────────────────────
     `target` is the staff record being acted on, where relevant. */
  const can = {
    /** See and use the staff-login management panel at all. */
    managePeople: () => isOwner(),

    /** Open Settings / change system configuration. */
    accessSettings: () => isOwner(),

    /** Create a member. Only Owners, and only Owners may create Owners. */
    createMember: () => isOwner(),
    createOwner: () => isOwner(),

    /** Edit a member. An Owner account may only be edited by an Owner. */
    editMember: (target) => {
      if (!isOwner()) return false;
      return true;
    },

    /** Delete a member. Owners cannot be deleted by non-Owners, and
        nobody may delete their own account — that is how you lock
        yourself out of your own portal. */
    deleteMember: (target) => {
      if (!isOwner()) return false;
      if (target && (target.email || '').toLowerCase() === currentEmail()) return false;
      return true;
    },

    /** Change a member's role. Nobody may change their own — it is the
        one edit that can silently remove your own access. */
    setRole: (target) => {
      if (!isOwner()) return false;
      if (target && (target.email || '').toLowerCase() === currentEmail()) return false;
      return true;
    }
  };

  /** Why an action is unavailable — for tooltips, so a disabled
      control explains itself instead of just being dead. */
  function reason(action, target) {
    if (!isOwner()) return 'Only an Owner can do this.';
    if ((action === 'delete' || action === 'setRole') &&
        target && (target.email || '').toLowerCase() === currentEmail()) {
      return action === 'delete'
        ? 'You cannot remove your own access.'
        : 'You cannot change your own role.';
    }
    return '';
  }

  /* Hide navigation the current role cannot use. Called after auth
     resolves and whenever the role changes. Hiding a link is a courtesy,
     not a control — the route itself also checks, and Firestore rules are
     what actually stop anything. */
  function applyNav() {
    const settingsLink = document.querySelector('.navlink[data-route="settings"]');
    if (settingsLink) settingsLink.hidden = !can.accessSettings();
  }

  /** Standard "you can't open this" panel, matching the empty states. */
  function denied(what) {
    return App.empty('Not available for your role', {
      icon: 'fa-lock',
      hint: `${what} is restricted to Owner accounts. You are signed in as ${currentRole()}.`
    });
  }

  App.Roles = {
    OWNER, STAFF, ALL,
    norm, badge, options,
    setSelf, currentRole, currentEmail, isOwner, can, reason,
    applyNav, denied,
    get self() { return selfRecord; }
  };

})(window.App);
