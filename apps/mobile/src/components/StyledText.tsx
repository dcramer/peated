import { type ComponentProps } from "react";
import { Text } from "react-native";

export function MonoText(props: ComponentProps<typeof Text>) {
  return <Text {...props} style={[props.style, { fontFamily: "SpaceMono" }]} />;
}
