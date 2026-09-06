import { Avatar, RailList, RailListItem } from "@peated/web/components";

import { RailListSection } from "./railListSection.stylex";

export type ActiveCriticRailItem = {
  bottleName: string;
  href: string;
  imageUrl?: string | null;
  name: string;
  publishedAt: string;
  type: string;
};

/** Lists up to five review sites in the order chosen by the caller. */
export function ActiveCriticRailSection({
  items,
}: {
  items: readonly ActiveCriticRailItem[];
}) {
  if (!items.length) return null;

  return (
    <RailListSection
      heading="Active critics"
      intro="Sites behind the latest whisky reviews."
    >
      <RailList ariaLabel="Active critics">
        {items.slice(0, 5).map((item) => (
          <RailListItem
            end={formatPublishedAt(item.publishedAt)}
            href={item.href}
            key={item.type}
            leading={
              <Avatar
                imageUrl={item.imageUrl}
                initials={getInitials(item.name)}
                size="sm"
              />
            }
            metadata={item.bottleName}
            title={item.name}
          />
        ))}
      </RailList>
    </RailListSection>
  );
}

function getInitials(name: string) {
  const parts = name.split(/\s+/u).filter(Boolean);
  return parts.length > 1
    ? parts
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("")
    : name.slice(0, 2).toUpperCase();
}

function formatPublishedAt(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}
