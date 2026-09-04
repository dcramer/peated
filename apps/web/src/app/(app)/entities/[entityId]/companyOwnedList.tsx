import type { Outputs } from "@peated/server/orpc/router";
import { getEntityIdentityProps } from "@peated/web/lib/entityIdentity";

import {
  EntityIdentityRow,
  ItemListItem,
  LoadingList,
  RailList,
  SectionError,
} from "@peated/web/components";
import { PageSection } from "@peated/web/components/pages/pageLayout.stylex";
import { getEntityUrl } from "@peated/web/lib/urls";

import { type Entity } from "./entityPageData";

type ListItem = Outputs["entities"]["list"]["results"][number];

const sectionCopy = {
  brands: {
    errorHeading: "Could not load brands",
    heading: "Brands",
    loadingLabel: "Loading brands",
  },
  distilleries: {
    errorHeading: "Could not load distilleries",
    heading: "Distilleries",
    loadingLabel: "Loading distilleries",
  },
  operates: {
    errorHeading: "Could not load bottlers and companies",
    heading: "Operates",
    loadingLabel: "Loading bottlers and companies",
  },
} as const;

type CompanySection = keyof typeof sectionCopy;

export function CompanyOwnedList({
  company,
  error,
  items,
  pending,
  retry,
  section,
}: {
  company: Entity;
  error: boolean;
  items?: ListItem[];
  pending: boolean;
  retry: () => void;
  section: CompanySection;
}) {
  if (company.kind !== "company") return null;

  const { errorHeading, heading, loadingLabel } = sectionCopy[section];

  if (pending) {
    return (
      <PageSection heading={heading}>
        <LoadingList label={loadingLabel} rows={2} />
      </PageSection>
    );
  }

  if (error) {
    return (
      <PageSection heading={heading}>
        <SectionError heading={errorHeading} onRetry={retry}>
          Try again.
        </SectionError>
      </PageSection>
    );
  }

  const shownItems = items?.slice(0, 4) ?? [];
  if (!shownItems.length) return null;

  return (
    <PageSection heading={heading}>
      <RailList ariaLabel={`${company.name} ${heading.toLowerCase()}`}>
        {shownItems.map((item) => (
          <ItemListItem key={item.id}>
            <EntityIdentityRow
              {...getEntityIdentityProps(item)}
              variant="sidebar"
              href={getEntityUrl(item)}
            />
          </ItemListItem>
        ))}
      </RailList>
    </PageSection>
  );
}
