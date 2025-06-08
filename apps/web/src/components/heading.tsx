import { Slot } from "./slot";

type Props = {
  asChild?: boolean;
} & React.ComponentPropsWithoutRef<"h1">;

export default function Heading({ asChild = false, ...props }: Props) {
  const Component = asChild ? Slot : "h1";

  return (
    <Component className="mb-4 font-bold text-highlight text-lg" {...props} />
  );
}
