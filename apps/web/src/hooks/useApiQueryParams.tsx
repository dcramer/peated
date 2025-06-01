import { useSearchParams } from "next/navigation";

export default function useApiQueryParams({
  defaults = {},
  numericFields = ["cursor", "limit"],
  overrides = {},
}: {
  defaults?: Record<string, any>;
  numericFields?: string[];
  overrides?: Record<string, any>;
}) {
  const searchParams = useSearchParams();

  const nFields = new Set(numericFields);

  return {
    ...defaults,
    ...Object.fromEntries(
      [...searchParams.entries()]
        .map(([k, v]) =>
          nFields.has(k)
            ? [k, v === "" ? null : Number.parseInt(v, 10)]
            : [k, v === "" ? null : v]
        )
        .filter(([k, v]) => !!v)
    ),
    ...overrides,
  };
}
