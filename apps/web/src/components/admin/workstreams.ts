export type AdminWorkstream = {
  href: string;
  id: "age-repairs" | "canon-repairs" | "queue" | "release-repairs";
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
