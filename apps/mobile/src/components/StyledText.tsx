import { type ComponentProps } from "react";
import { Text as NativeText } from "react-native";

export function MonoText(props: ComponentProps<typeof NativeText>) {
  return (
    <NativeText {...props} style={[props.style, { fontFamily: "SpaceMono" }]} />
  );
}

const variantStyles = {
  default: "text-white",
  muted: "text-light",
  highlight: "text-highlight",
};

export function Text({
  variant = "default",
  className,
  ...props
}: ComponentProps<typeof NativeText> & {
  variant?: keyof typeof variantStyles;
  className?: string;
}) {
  return (
    <NativeText
      className={`${variantStyles[variant]} ${className}`}
      {...props}
    />
  );
}
