import { default as L } from "next/link";
import type { ComponentProps } from "react";

export default function Link(props: ComponentProps<typeof L>) {
  return <L prefetch={false} {...props} />;
}
