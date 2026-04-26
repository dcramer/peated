export type AdminWorkstream = {
  href: string;
  id:
    | "age-repairs"
    | "brand-repairs"
    | "canon-repairs"
    | "entity-audits"
    | "queue"
    | "release-repairs";
  pageTitle: string;
  sidebarLabel: string;
  summary: string;
  whenToUse: string;
};

export const ADMIN_WORKSTREAMS: AdminWorkstream[] = [
  {
    id: "queue",
    href: "/admin/queue",
    pageTitle: "Incoming Listings",
    sidebarLabel: "Incoming Listings",
    summary:
      "Review new or changed retailer listings and approve the bottle or bottling assignment.",
    whenToUse:
      "Use this when a listing is wrong or unmatched, but the catalog bottle itself may still be correct.",
  },
  {
    id: "entity-audits",
    href: "/admin/entity-audits",
    pageTitle: "Entity Audits",
    sidebarLabel: "Entity Audits",
    summary:
      "Run agent-backed audits on suspicious producer rows to verify generic names, bad metadata, or bottles that belong under a stronger existing brand.",
    whenToUse:
      "Use this when the entity row itself looks suspect and you want the system to gather local and web evidence before deciding whether to repair bottles, fix metadata, or leave it alone.",
  },
  {
    id: "brand-repairs",
    href: "/admin/brand-repairs",
    pageTitle: "Brand / Entity Repairs",
    sidebarLabel: "Brand / Entity",
    summary:
      "Move bottles onto the correct brand entity when the bottle identity is right but the stored producer assignment is wrong.",
    whenToUse:
      "Use this when the current bottle title or aliases clearly point at an existing brand entity, and the old producer may still belong as a distillery link.",
  },
  {
    id: "canon-repairs",
    href: "/admin/canon-repairs",
    pageTitle: "Bottle Name Repairs",
    sidebarLabel: "Bottle Name Repairs",
    summary:
      "Merge same-brand wording variants into the cleaner existing bottle record.",
    whenToUse:
      "Use this when two bottle records represent the same bottle and one name should win.",
  },
  {
    id: "release-repairs",
    href: "/admin/release-repairs",
    pageTitle: "Bottle / Release Repairs",
    sidebarLabel: "Bottle / Release Repairs",
    summary:
      "Split legacy bottles into a reusable parent bottle plus child releases.",
    whenToUse:
      "Use this when the current bottle record still contains batch, edition, or year-level release identity.",
  },
  {
    id: "age-repairs",
    href: "/admin/age-repairs",
    pageTitle: "Parent Age Repairs",
    sidebarLabel: "Parent Age Repairs",
    summary:
      "Move a release-specific age off the parent bottle and onto the right child release.",
    whenToUse:
      "Use this when the bottle-level age is dirty because child releases already carry conflicting ages.",
  },
];
