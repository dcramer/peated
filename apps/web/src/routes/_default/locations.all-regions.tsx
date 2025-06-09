import CountryMapIcon from "@peated/web/components/countryMapIcon";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_default/locations/all-regions")({
  component: Page,
});

function Page() {
  const orpc = useORPC();
  const { data: countryList } = useSuspenseQuery(
    orpc.countries.list.queryOptions({
      input: {
        onlyMajor: true,
        sort: "-bottles",
      },
    })
  );

  return (
    <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-3 lg:gap-x-8">
      {countryList.results.map((country) => {
        return (
          <li
            key={country.slug}
            className="group relative border border-transparent text-white hover:border-highlight"
          >
            <Link
              to="/locations/$countrySlug"
              params={{ countrySlug: country.slug }}
              className="absolute inset-0"
            />
            <div className="flex flex-col items-center justify-center">
              <div className="mb-4 flex w-full items-center justify-center bg-slate-900 p-4 lg:p-8">
                <CountryMapIcon
                  slug={country.slug}
                  className="max-h-32 text-white group-hover:text-highlight"
                />
              </div>
              <h3 className="font-bold text-lg group-hover:text-highlight">
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
