import Link from "@peated/web/components/link";
import PageHeader from "@peated/web/components/pageHeader";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Locations",
};

export default async function Page() {
  return (
    <>
      <PageHeader title="Locations" />

      <ul className="max-w-md list-inside list-disc space-y-1">
        <li>
          <Link
            className="hover:text-highlight underline"
            href="/locations/scotland"
          >
            Scotland
          </Link>
        </li>
        <li>
          <Link
            className="hover:text-highlight underline"
            href="/locations/ireland"
          >
            Ireland
          </Link>
        </li>
        <li>
          <Link
            className="hover:text-highlight underline"
            href="/locations/united-states"
          >
            United States
          </Link>
        </li>
        <li>
          <Link
            className="hover:text-highlight underline"
            href="/locations/japan"
          >
            Japan
          </Link>
        </li>
      </ul>
    </>
  );
}
