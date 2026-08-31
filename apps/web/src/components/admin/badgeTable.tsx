import type { Badge, PagingRel } from "@peated/server/types";
import { BadgeImage } from "..";
import { AdminTable } from "./adminTable.stylex";

export default function BadgeTable({
  badgeList,
  rel,
}: {
  badgeList: Badge[];
  rel?: PagingRel;
}) {
  return (
    <AdminTable
      columns={[
        {
          name: "badge",
          value: (badge) => (
            <span
              style={{ display: "inline-flex", alignItems: "center", gap: 12 }}
            >
              <BadgeImage badge={badge} size={40} />
              <span>{badge.name}</span>
            </span>
          ),
        },
        {
          align: "right",
          name: "checks",
          value: (badge) => badge.checks?.length.toLocaleString("en-US") ?? "0",
        },
      ]}
      items={badgeList}
      rel={rel}
      url={(badge) => `/admin/badges/${badge.id}`}
    />
  );
}
