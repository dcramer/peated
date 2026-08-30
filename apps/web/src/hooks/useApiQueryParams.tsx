import { useSearchParams } from "next/navigation";

import {
  getApiQueryParams,
  type ApiQueryParams,
} from "@peated/web/lib/apiQueryParams";

export default function useApiQueryParams({
  defaults = {},
  numericFields = ["cursor", "limit"],
  overrides = {},
}: {
  defaults?: ApiQueryParams;
  numericFields?: readonly string[];
  overrides?: ApiQueryParams;
}) {
  const searchParams = useSearchParams();

  return getApiQueryParams(searchParams, {
    defaults,
    numericFields,
    overrides,
  });
}
