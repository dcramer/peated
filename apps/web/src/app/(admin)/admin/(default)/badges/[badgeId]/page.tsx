"use client";

import { use } from "react";

import { BadgeImage } from "@peated/web/components";
import { AdminButton as Button } from "@peated/web/components/admin/adminButton.stylex";
import {
  AdminBreadcrumbs,
  AdminCodeBlock,
  AdminPage,
  AdminPageHeader,
  AdminSection,
} from "@peated/web/components/admin/adminContent.stylex";
import { AdminDefinitionList as DefinitionList } from "@peated/web/components/admin/adminUtility.stylex";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export default function Page({
  params,
}: {
  params: Promise<{ badgeId: string }>;
}) {
  const { badgeId } = use(params);
  const orpc = useORPC();
  const { data: badge } = useSuspenseQuery(
    orpc.badges.details.queryOptions({
      input: { badge: Number.parseInt(badgeId, 10) },
    }),
  );

  return (
    <AdminPage>
      <AdminBreadcrumbs
        items={[
          { label: "Badges", href: "/admin/badges" },
          {
            label: badge.name,
            href: `/admin/badges/${badge.id}`,
            current: true,
          },
        ]}
      />
      <AdminPageHeader
        title={badge.name}
        actions={
          <Button href={`/admin/badges/${badge.id}/edit`}>Edit badge</Button>
        }
      />
      <AdminSection title="Basics">
        <DefinitionList>
          <DefinitionList.Term>Max level</DefinitionList.Term>
          <DefinitionList.Details>{badge.maxLevel}</DefinitionList.Details>
          <DefinitionList.Term>Image</DefinitionList.Term>
          <DefinitionList.Details>
            <BadgeImage badge={badge} />
          </DefinitionList.Details>
        </DefinitionList>
      </AdminSection>
      <AdminSection title="Implementation">
        <DefinitionList>
          <DefinitionList.Term>Tracker</DefinitionList.Term>
          <DefinitionList.Details>{badge.tracker}</DefinitionList.Details>
          <DefinitionList.Term>Formula</DefinitionList.Term>
          <DefinitionList.Details>{badge.formula}</DefinitionList.Details>
        </DefinitionList>
        <AdminCodeBlock>
          {JSON.stringify(badge.checks, undefined, 2)}
        </AdminCodeBlock>
      </AdminSection>
    </AdminPage>
  );
}
