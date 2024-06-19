import Layout from "@peated/web/components/layout";
import { type MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { type SitemapFunction } from "remix-sitemap";
import PageHeader from "../components/pageHeader";

const DEFAULT_SORT = "-tastings";

export const sitemap: SitemapFunction = () => ({
  exclude: true,
});

export const meta: MetaFunction = () => {
  return [
    {
      title: "Locations",
    },
  ];
};

export default function Locations() {
  return (
    <Layout>
      <PageHeader title="Locations" />

      <ul className="max-w-md list-inside list-disc space-y-1">
        <li>
          <Link
            className="hover:text-highlight underline"
            to="/locations/scotland"
          >
            Scotland
          </Link>
        </li>
        <li>
          <Link
            className="hover:text-highlight underline"
            to="/locations/ireland"
          >
            Ireland
          </Link>
        </li>
        <li>
          <Link
            className="hover:text-highlight underline"
            to="/locations/united-states"
          >
            United States
          </Link>
        </li>
        <li>
          <Link
            className="hover:text-highlight underline"
            to="/locations/japan"
          >
            Japan
          </Link>
        </li>
      </ul>
    </Layout>
  );
}
