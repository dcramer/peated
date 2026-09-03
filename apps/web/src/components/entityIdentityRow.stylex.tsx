import type { EntityKind } from "@peated/server/types";

import { MemberStatus } from "./memberStatus.stylex";
import {
  TextIdentityRow,
  type TextIdentityRowProps,
} from "./textIdentityRow.stylex";

/** Display facts shared by entity rows and selection controls. */
export type EntityIdentity = {
  name: string;
  isFollowing?: boolean;
  kind?: EntityKind;
  location?: string;
};

export type EntityIdentityRowProps = Omit<
  TextIdentityRowProps,
  "metadata" | "status"
> &
  EntityIdentity;

/** A linked brand or producer identity, independent of the page that lists it. */
export type EntityListItem = EntityIdentity & { href: string };

const kindLabels = {
  brand: "Brand",
  bottler: "Bottler",
  distillery: "Distillery",
  company: "Company",
} satisfies Record<EntityKind, string>;

/**
 * Brand and producer identity in catalogs, sidebars, search, and selection.
 * Shows the name, known kind and location, and following status. IDs, descriptions,
 * and statistics do not belong in identity metadata. Put contextual counts or
 * actions in end, or adjacent table cells. Use cell inside a table or picker.
 */
export function EntityIdentityRow({
  isFollowing = false,
  kind,
  location,
  ...props
}: EntityIdentityRowProps) {
  return (
    <TextIdentityRow
      {...props}
      metadata={[kind ? kindLabels[kind] : null, location]
        .filter(Boolean)
        .join(" · ")}
      status={isFollowing ? <MemberStatus kind="following" /> : undefined}
    />
  );
}
