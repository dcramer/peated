import { type ComponentPropsWithoutRef } from "react";
import { View } from "react-native";
import { Text } from "./StyledText";

export function DefinitionTerm({
  text,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof View> & {
  text?: string;
}) {
  return (
    <View className="font-semibold leading-6" {...props}>
      {text && <Text>{text}</Text>}
      {children}
    </View>
  );
}

export function DefinitionDetails({
  text,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof View> & {
  text?: string;
}) {
  return (
    <View className="flex flex-row items-center gap-x-2 leading-6" {...props}>
      {text && <Text variant="muted">{text}</Text>}
    </View>
  );
}

export default function DefinitionList(
  props: ComponentPropsWithoutRef<typeof View>,
) {
  return (
    <View className="grid-cols mb-4 grid grid-cols-1 gap-y-4" {...props} />
  );
}

DefinitionList.Details = DefinitionDetails;

DefinitionList.Term = DefinitionTerm;
