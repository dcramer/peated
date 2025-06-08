import { Slot } from "./slot";

type Props = {
  asChild?: boolean;
} & React.ComponentPropsWithoutRef<"h1">;

export default function SimpleHeader({ asChild = false, ...props }: Props) {
  const Component = asChild ? Slot : "h1";

  return (
    <div className="mb-4 flex space-x-8 border-slate-700 border-b">
      <Component
        className="flex justify-center whitespace-nowrap border-highlight border-b-4 px-3 py-4 font-medium text-highlight text-sm"
        {...props}
      />
    </div>
  );
}
