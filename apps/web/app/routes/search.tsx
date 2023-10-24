import type { MetaFunction } from "@remix-run/node";
import type { SitemapFunction } from "remix-sitemap";
import { SearchPanel } from "~/components/search";

export const sitemap: SitemapFunction = () => ({
  exclude: true,
});

export const meta: MetaFunction = () => {
  return [
    {
      title: "Search",
    },
  ];
};

export default function Search() {
  return <SearchPanel />;
}
