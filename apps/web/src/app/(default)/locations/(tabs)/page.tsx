"use client";

import CountryGridSkeleton from "@peated/web/components/countryGridSkeleton";
import CountryMapIcon from "@peated/web/components/countryMapIcon";
import Link from "@peated/web/components/link";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";

function CountryGrid() {
  const orpc = useORPC();
  const { data: countryList } = useSuspenseQuery(
    orpc.countries.list.queryOptions({
      input: {
        onlyMajor: true,
        sort: "-bottles",
      },
    }),
  );

  return (
    <ul
      role="list"
      className="mt-4 grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-3 lg:gap-x-8"
    >
      {(countryList as any).results.map((country: any) => {
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
              <div className="mb-4 flex h-40 w-full items-center justify-center bg-slate-900 p-4 lg:h-48 lg:p-8">
                <CountryMapIcon
                  slug={country.slug}
                  className="group-hover:text-highlight h-full max-h-32 w-auto text-white"
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

export default function Page() {
  return (
    <Suspense fallback={<CountryGridSkeleton count={9} />}>
      <CountryGrid />
    </Suspense>
  );
}
