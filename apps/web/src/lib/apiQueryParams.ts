export type ApiQueryParamValue = boolean | null | number | string | undefined;

export interface ApiQueryParams {
  [key: string]: ApiQueryParamValue;
}

export type SearchParamSource =
  | Iterable<[string, string]>
  | Record<string, string | string[] | undefined>;

type ApiQueryParamOptions = {
  allowedValues?: Readonly<Record<string, readonly string[]>>;
  defaults?: ApiQueryParams;
  fields?: readonly string[];
  numericFields?: readonly string[];
  overrides?: ApiQueryParams;
};

/** Keeps server route inputs and browser URL inputs on the same conversion path. */
export function getApiQueryParams(
  searchParams: SearchParamSource,
  {
    allowedValues = {},
    defaults = {},
    fields,
    numericFields = ["cursor", "limit"],
    overrides = {},
  }: ApiQueryParamOptions = {},
) {
  const fieldSet = fields ? new Set(fields) : null;
  const numericFieldSet = new Set(numericFields);

  return {
    ...defaults,
    ...Object.fromEntries(
      getSearchParamEntries(searchParams)
        .filter(([name]) => !fieldSet || fieldSet.has(name))
        .map(([name, value]) => [
          name,
          parseSearchParamValue(name, value, numericFieldSet),
        ])
        .filter((entry) => {
          const name = String(entry[0]);
          const value = entry[1];
          return (
            value !== null &&
            value !== undefined &&
            value !== "" &&
            (!allowedValues[name] ||
              allowedValues[name].includes(String(value)))
          );
        }),
    ),
    ...overrides,
  };
}

function parseSearchParamValue(
  name: string,
  value: string,
  numericFields: ReadonlySet<string>,
) {
  if (value === "") return null;
  if (!numericFields.has(name)) return value;

  const parsedValue = Number.parseInt(value, 10);
  return Number.isNaN(parsedValue) ? null : parsedValue;
}

function getSearchParamEntries(searchParams: SearchParamSource) {
  if (Symbol.iterator in searchParams) {
    return [...searchParams];
  }

  return Object.entries(searchParams).flatMap(([name, value]) =>
    Array.isArray(value)
      ? value.map((item): [string, string] => [name, item])
      : value === undefined
        ? []
        : [[name, value]],
  );
}
