import type { V2_MetaFunction } from "@remix-run/node";
import { SearchPanel } from "~/components/search";

export const meta: V2_MetaFunction = () => {
  return [
    {
      title: "Search",
    },
  ];
};

export default function Search() {
  return <SearchPanel />;
}
