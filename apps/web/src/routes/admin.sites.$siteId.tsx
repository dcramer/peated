import { type ExternalSiteType } from "@peated/server/types";
import StorePriceTable from "@peated/web/components/admin/storePriceTable";
import EmptyActivity from "@peated/web/components/emptyActivity";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/sites/$siteId")({
  component: Page,
});

function Page() {
  const { siteId } = Route.useParams() as { siteId: ExternalSiteType };
  const queryParams = useApiQueryParams({
    numericFields: ["cursor", "limit"],
    overrides: {
      site: siteId,
    },
  });

  const orpc = useORPC();
  const { data: priceList } = useSuspenseQuery(
    orpc.prices.list.queryOptions({
      input: {
        ...queryParams,
        site: siteId,
      },
    }),
  );

  return (
    <div>
      {priceList.results.length > 0 ? (
        <StorePriceTable priceList={priceList.results} rel={priceList.rel} />
      ) : (
        <EmptyActivity>
          Looks like there's nothing in the database yet. Weird.
        </EmptyActivity>
      )}
    </div>
  );
}
