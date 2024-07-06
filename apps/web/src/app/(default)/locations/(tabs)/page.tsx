import CountryMapIcon from "@peated/web/components/countryMapIcon";
import { getTrpcClient } from "@peated/web/lib/trpc.server";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Major Whisky Regions",
};

export default async function Page() {
  const trpcClient = await getTrpcClient();
  const countryList = await trpcClient.countryList.fetch({
    onlyMajor: true,
  });

  return (
    <ul
      role="list"
      className="mt-4 grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-3 lg:gap-x-8"
    >
      {countryList.results.map((country) => {
        return (
          <li
            key={country.slug}
            className="hover:border-highlight group relative border border-transparent text-white"
          >
            <Link
              href={`/locations/${country.slug}`}
              className="absolute inset-0"
            />
            <div className="flex flex-col items-center justify-center">
              <div className="mb-4 flex w-full items-center justify-center bg-slate-900 p-4 lg:p-8">
                <CountryMapIcon
                  slug={country.slug}
                  className="group-hover:text-highlight max-h-32 text-white"
                />
              </div>
              <h3 className="group-hover:text-highlight text-lg font-bold">
                {country.name}
              </h3>
              {!!country.summary && (
                <p className="prose prose-invert p-3">{country.summary}</p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
