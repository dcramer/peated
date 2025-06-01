import { useSearch } from "@tanstack/react-router";

export default function useApiQueryParams({
  defaults = {},
  numericFields = ["cursor", "limit"],
  overrides = {},
}: {
  defaults?: Record<string, any>;
  numericFields?: string[];
  overrides?: Record<string, any>;
}) {
  const searchParams = useSearch({ strict: false });

  const nFields = new Set(numericFields);

  return {
    ...defaults,
    ...Object.fromEntries(
      Object.entries(searchParams as Record<string, any>)
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
