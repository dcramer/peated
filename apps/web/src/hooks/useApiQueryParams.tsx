import { useSearchParams } from "next/navigation";

type QueryParamValue = boolean | null | number | string | undefined;

interface QueryParams {
  [key: string]: QueryParamValue;
}

export default function useApiQueryParams({
  defaults = {},
  numericFields = ["cursor", "limit"],
  overrides = {},
}: {
  defaults?: QueryParams;
  numericFields?: string[];
  overrides?: QueryParams;
}) {
  const searchParams = useSearchParams();

  const nFields = new Set(numericFields);

  return {
    ...defaults,
    ...Object.fromEntries(
      [...searchParams.entries()]
        .map(([k, v]) =>
          nFields.has(k)
            ? [k, v === "" ? null : parseInt(v, 10)]
            : [k, v === "" ? null : v],
        )
        .filter(([k, v]) => !!v),
    ),
    ...overrides,
  };
}
