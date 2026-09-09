import type { Outputs } from "@peated/server/orpc/router";
import { AdminTable } from "@peated/web/components/admin/adminTable.stylex";
import { TextLink } from "@peated/web/components/textLink.stylex";
import TimeSince from "@peated/web/components/timeSince";
import * as stylex from "@stylexjs/stylex";
import { styles } from "./catalogListingTable.stylex";

type Listing =
  Outputs["externalSites"]["catalogListings"]["list"]["results"][number];

export function catalogListingFacts(listing: Listing) {
  const facts = listing.sourceBottleIdentity;
  return [
    listing.volume === null ? null : `${listing.volume} ml`,
    facts?.abv !== null && facts?.abv !== undefined
      ? `${facts.abv}% ABV`
      : null,
    facts?.stated_age !== null && facts?.stated_age !== undefined
      ? `${facts.stated_age} years`
      : null,
    facts?.edition ?? null,
    facts?.release_year !== null && facts?.release_year !== undefined
      ? `Released ${facts.release_year}`
      : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
}

function MobileListingDetails({ listing }: { listing: Listing }) {
  return (
    <dl {...stylex.props(styles.mobileDetails)}>
      <div>
        <dt {...stylex.props(styles.mobileLabel)}>Bottle details</dt>
        <dd {...stylex.props(styles.mobileValue)}>
          {catalogListingFacts(listing) || "No bottle details"}
        </dd>
      </div>
      <div>
        <dt {...stylex.props(styles.mobileLabel)}>Product ID</dt>
        <dd {...stylex.props(styles.mobileValue)}>
          {listing.externalProductId ?? "Page URL"}
        </dd>
      </div>
      <div {...stylex.props(styles.mobileDates)}>
        <div>
          <dt {...stylex.props(styles.mobileLabel)}>First seen</dt>
          <dd {...stylex.props(styles.mobileValue)}>
            <TimeSince date={listing.firstSeenAt} />
          </dd>
        </div>
        <div>
          <dt {...stylex.props(styles.mobileLabel)}>Last seen</dt>
          <dd {...stylex.props(styles.mobileValue)}>
            <TimeSince date={listing.lastSeenAt} />
          </dd>
        </div>
      </div>
    </dl>
  );
}

export default function CatalogListingTable({
  listings,
  rel,
}: {
  listings: Listing[];
  rel: Outputs["externalSites"]["catalogListings"]["list"]["rel"];
}) {
  return (
    <AdminTable
      withSearch
      columns={[
        {
          name: "product",
          value: (listing) => (
            <div>
              <TextLink href={listing.url}>{listing.name}</TextLink>
              <MobileListingDetails listing={listing} />
            </div>
          ),
        },
        {
          name: "bottle details",
          value: (listing) =>
            catalogListingFacts(listing) || "No bottle details",
        },
        {
          name: "product ID",
          title: "Product ID",
          value: (listing) => listing.externalProductId ?? "Page URL",
        },
        {
          align: "right",
          name: "first seen",
          value: (listing) => <TimeSince date={listing.firstSeenAt} />,
        },
        {
          align: "right",
          name: "last seen",
          value: (listing) => <TimeSince date={listing.lastSeenAt} />,
        },
      ]}
      items={listings}
      primaryKey={(listing) => listing.url}
      rel={rel}
    />
  );
}
