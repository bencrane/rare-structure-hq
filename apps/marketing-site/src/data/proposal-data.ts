export const PROPOSAL_DEAL = {
  ref: "RS-2026-0847",
  date: "May 20, 2026",
  partner: {
    firm: "Cardinal Bluff Capital",
    contact: "James Whitfield",
    title: "Managing Director, Direct Lending",
  },
  entity: {
    name: "Redacted Entity",
    type: "Prime Contractor — Heavy Civil",
    state: "California",
    naics: "237310 — Highway, Street & Bridge Construction",
  },
  catalyst: {
    type: "Federal Contract Award",
    source: "USAspending",
    value: "$4.2M",
    agency: "Dept. of Transportation",
    period: "2025–2028",
    status: "Active — Year 1 Performance",
  },
  leverage: {
    uccFilings: 2,
    uccTypes: ["Equipment (Caterpillar Financial)", "Line of Credit (Pacific Western Bank)"],
    sbaHistory: "SBA 7(a) — $850K term loan, current",
  },
  thesis: {
    fit: "Strong",
    signal:
      "Active federal revenue mandate + layered commercial debt = refinance catalyst. Entity is credit-literate with existing lender relationships. Mobilization capital demand is immediate.",
  },
  pipeline: {
    sources: ["USAspending", "CA UCC-1", "SBA 7(a)", "CA Secretary of State", "SAM.gov"],
    bridgeMethod: "legal_name_state_exact_ca v1.0.0",
    matchTier: "Platinum (1:1)",
  },
  terms: {
    facility: "Senior Secured Revolving Credit Facility",
    amount: "$12.5M",
    rate: "SOFR + 425 bps",
    term: "36 months",
    collateral: "Equipment, receivables, contract proceeds",
    covenants: "1.25x FCCR, 3.0x leverage cap",
    closingFee: "1.50%",
    minimumDraw: "$2.5M",
  },
  engagement: {
    fee: "$45,000",
    feeNumeric: 45000,
    description: "Origination engagement retainer",
    paymentTerms: "Due upon execution",
  },
};
