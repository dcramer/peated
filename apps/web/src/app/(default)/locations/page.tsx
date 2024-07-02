import PageHeader from "@peated/web/components/pageHeader";
import PaginationButtons from "@peated/web/components/paginationButtons";
import { getTrpcClient } from "@peated/web/lib/trpc.server";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Locations",
};

export default async function Page() {
  const trpcClient = await getTrpcClient();
  const countryList = await trpcClient.countryList.fetch({
    hasBottles: true,
    sort: "-bottles",
  });

  return (
    <>
      <PageHeader title="Locations" />

      <table className="min-w-full table-auto">
        <colgroup>
          <col />
          <col className="hidden w-16 sm:table-column" />
        </colgroup>
        <thead className="text-light hidden border-b border-slate-800 text-sm font-semibold sm:table-header-group">
          <tr>
            <th scope="col" className="px-3 py-2.5 text-left">
              Country
            </th>
            <th scope="col" className="px-3 py-2.5 text-center sm:table-cell">
              Bottles
            </th>
          </tr>
        </thead>
        <tbody>
          {countryList.results.map((country) => {
            return (
              <tr key={country.slug}>
                <td className="border-b border-slate-800 p-3 text-sm">
                  <Link href={`/locations/${country.slug}`}>
                    {country.name}
                  </Link>
                </td>
                <td className="text-light hidden border-b border-slate-800 p-3 text-center text-sm sm:table-cell">
                  {country.totalBottles.toLocaleString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <PaginationButtons rel={countryList.rel} />
    </>
  );
}
