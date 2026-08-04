export type AdminWorkstream = {
  href: string;
  id: "audits" | "queue";
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
      "Review new or changed retailer listings and approve the exact Bottle assignment.",
    whenToUse:
      "Use this when a listing is wrong or unmatched, but the catalog bottle itself may still be correct.",
  },
  {
    id: "audits",
    href: "/admin/audits",
    pageTitle: "Audits",
    sidebarLabel: "Audits",
    summary:
      "Review catalog changes and findings proposed by Bottle and incoming-listing audits.",
    whenToUse:
      "Use this when an audit found catalog work that still needs approval, rejection, retry, or closure.",
  },
];
