import {
  TextIdentityRow,
  type TextIdentityRowProps,
} from "./textIdentityRow.stylex";

export type LocationIdentityRowProps = Omit<
  TextIdentityRowProps,
  "metadata" | "status"
> & {
  country?: string;
};

/** Country or region identity for lists and search; regions include their country when known. */
export function LocationIdentityRow({
  country,
  ...props
}: LocationIdentityRowProps) {
  return <TextIdentityRow {...props} metadata={country} />;
}
