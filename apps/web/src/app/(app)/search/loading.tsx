import { Suspense } from "react";

import {
  SearchLoadingSelection,
  SearchPageLoading,
} from "./searchPageClient.stylex";

export default function Loading() {
  return (
    <Suspense fallback={<SearchPageLoading />}>
      <SearchLoadingSelection />
    </Suspense>
  );
}
