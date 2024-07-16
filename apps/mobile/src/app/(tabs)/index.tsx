import theme from "@peated/design";
import { Text, View } from "react-native";

export default function ActivityScreen() {
  return (
    <View
      style={{
        display: "flex",
        flexGrow: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.colors.black,
      }}
    >
      <Text style={{ color: theme.colors.white }}>Activity</Text>
    </View>
  );
}
