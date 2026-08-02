/* ============================================================
   InTandem Desk — data layer

   FIRST-RUN STATE. Every collection is empty and every figure is
   zero. This is a clean installation, ready for real data entry.

   The SHAPE below is the contract. Derive.* in itd-core.js and
   every view read these keys, so a key must EXIST even when it is
   empty — deleting one crashes the app, emptying one does not.

   Populating it later — from Firestore, an import, or parse.py —
   means filling these same arrays. No view needs to change.

   ── Field reference, for whatever writes here next ───────────

   budget[]      sino · section · description · nature · vendor ·
                 type · status · quoteNoGst · quoteGst · released ·
                 balance · comments
   schedule[]    sino · area · areaName · description · nature ·
                 vendor · archStatus · clientStatus · start · end ·
                 status · statusRaw
   areas[]       code · name
   vendors[]     sino · account · vendor · quotation · released ·
                 balance
   extraWorks[]  sino · category · amount · items
   ledger[]      sino · date · vendorRaw · vendor · vendorId ·
                 towards · amount · account · party · mode

   The previous contents — the Ayyappa Residence workbook as of
   17 Jul 2026, 638 ledger rows and 56 vendor accounts — are
   archived at:
     archive/itd-data.ayyappa-workbook-2026-07-17.js
   ============================================================ */

window.DATA = {
  /* Firm identity is configuration, not project data, so it stays.
     Everything describing an engagement is blank until one exists. */
  meta: {
    firm: 'InTandem Build',
    nature: 'Project Management Consultancy',
    project: '',
    client: '',
    location: '',
    engineer: '',
    reportDate: '',
    budgetSheetTotal: 0,
    balanceBudget: 0,
    balanceReleased: 0,
    balanceOutstanding: 0
  },

  budget: [],
  schedule: [],
  areas: [],
  vendors: [],
  extraWorks: [],
  extraWorksTotal: 0,
  ledger: []
};
