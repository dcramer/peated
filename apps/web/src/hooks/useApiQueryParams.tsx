import { useSearchParams } from "next/navigation";

import {
  getApiQueryParams,
  type ApiQueryParams,
} from "@peated/web/lib/apiQueryParams";

export default function useApiQueryParams({
  allowedValues = {},
  defaults = {},
  fields,
  numericFields = ["cursor", "limit"],
  overrides = {},
}: {
  allowedValues?: Readonly<Record<string, readonly string[]>>;
  defaults?: ApiQueryParams;
  fields?: readonly string[];
  numericFields?: readonly string[];
  overrides?: ApiQueryParams;
}) {
  const searchParams = useSearchParams();

  return getApiQueryParams(searchParams, {
    allowedValues,
    defaults,
    fields,
    numericFields,
    overrides,
  });
}
