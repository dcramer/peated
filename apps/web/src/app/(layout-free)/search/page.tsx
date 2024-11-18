import { SearchPanel } from "@peated/web/components/search";
import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "Search",
};

export default async function Page(props: {
  searchParams: Promise<Record<string, any>>;
}) {
  const searchParams = await props.searchParams;
  const query = searchParams.q ?? "";

  return <SearchPanel initialValue={query} />;
}
