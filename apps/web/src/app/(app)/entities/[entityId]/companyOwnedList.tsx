import type { Outputs } from "@peated/server/orpc/router";
import { getEntityIdentityProps } from "@peated/web/lib/entityIdentity";

import {
  EntityIdentityRow,
  ItemListItem,
  LoadingList,
  RailList,
  SectionError,
  TextLink,
} from "@peated/web/components";
import { PageSection } from "@peated/web/components/pages/pageLayout.stylex";
import { getEntityUrl } from "@peated/web/lib/urls";

import { type Entity } from "./entityPageData";

type ListItem = Outputs["entities"]["portfolio"]["previews"]["brands"][number];

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
  bottlers: {
    errorHeading: "Could not load bottlers",
    heading: "Bottlers",
    loadingLabel: "Loading bottlers",
  },
  groupCompanies: {
    errorHeading: "Could not load companies in this group",
    heading: "Companies in this group",
    loadingLabel: "Loading companies in this group",
  },
  portfolio: {
    errorHeading: "Could not load whisky portfolio",
    heading: "Whisky portfolio",
    loadingLabel: "Loading whisky portfolio",
  },
} as const;

type CompanySection = keyof typeof sectionCopy;

export function CompanyOwnedList({
  company,
  error,
  href,
  items,
  pending,
  retry,
  section,
  total,
}: {
  company: Entity;
  error: boolean;
  href?: string;
  items?: ListItem[];
  pending: boolean;
  retry: () => void;
  section: CompanySection;
  total?: number;
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
    <PageSection
      heading={heading}
      intro={
        href && total && total > shownItems.length ? (
          <TextLink href={href}>View all {total.toLocaleString()}</TextLink>
        ) : undefined
      }
    >
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
