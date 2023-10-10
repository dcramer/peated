import type { MetaFunction } from "@remix-run/node";
import { SearchPanel } from "~/components/search";

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
