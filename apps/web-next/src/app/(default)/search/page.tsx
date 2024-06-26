import { SearchPanel } from "@peated/web/components/search";
import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "Search",
};

export default function Page() {
  return <SearchPanel />;
}
