import BadgeImage from "@peated/web/components/badgeImage";
import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Button from "@peated/web/components/button";
import DefinitionList from "@peated/web/components/definitionList";
import Heading from "@peated/web/components/heading";
// import Markdown from "@peated/web/components/markdown";
import PageHeader from "@peated/web/components/pageHeader";
import Tabs, { TabItem } from "@peated/web/components/tabs";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/badges/$badgeId")({
  component: Page,
});

function Page() {
  const { badgeId } = Route.useParams();
  const orpc = useORPC();
  const { data: badge } = useSuspenseQuery(
    orpc.badges.details.queryOptions({
      input: {
        badge: Number.parseInt(badgeId, 10),
      },
    })
  );

  return (
    <div className="w-full p-3 lg:py-0">
      <Breadcrumbs
        pages={[
          {
            name: "Admin",
            to: "/admin",
          },
          {
            name: "Badges",
            to: "/admin/badges",
          },
          {
            name: badge.name,
            to: `/admin/badges/${badge.id}`,
            current: true,
          },
        ]}
      />

      <PageHeader
        title={badge.name}
        metadata={
          <Button asChild>
            <Link
              to="/admin/badges/$badgeId/edit"
              params={{ badgeId: badge.id.toString() }}
            >
              Edit Badge
            </Link>
          </Button>
        }
      />

      <Tabs border>
        <TabItem asChild controlled>
          <Link
            to="/admin/badges/$badgeId"
            params={{ badgeId: badge.id.toString() }}
          >
            Overview
          </Link>
        </TabItem>
      </Tabs>
      {/* 
      {badge.description && (
        <>
          <Heading as="h3">Description</Heading>
          <div className="prose prose-invert -mt-1 max-w-none flex-auto">
            <Markdown content={badge.description} />
          </div>
        </>
      )} */}

      <Heading asChild>
        <h3>Basics</h3>
      </Heading>

      <DefinitionList>
        <DefinitionList.Term>Max Level</DefinitionList.Term>
        <DefinitionList.Details>{badge.maxLevel}</DefinitionList.Details>
        <DefinitionList.Term>Image</DefinitionList.Term>
        <DefinitionList.Details>
          <BadgeImage badge={badge} />
        </DefinitionList.Details>
      </DefinitionList>

      <Heading asChild>
        <h3>Implementation</h3>
      </Heading>

      <DefinitionList>
        <DefinitionList.Term>Tracker</DefinitionList.Term>
        <DefinitionList.Details>{badge.tracker}</DefinitionList.Details>
        <DefinitionList.Term>Formula</DefinitionList.Term>
        <DefinitionList.Details>{badge.formula}</DefinitionList.Details>
        <DefinitionList.Term>Checks</DefinitionList.Term>
        <DefinitionList.Details>
          <pre className="font-mono">
            {JSON.stringify(badge.checks, undefined, 2)}
          </pre>
        </DefinitionList.Details>
      </DefinitionList>
    </div>
  );
}
