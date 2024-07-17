import { type RouterOutputs } from "@peated/mobile/lib/trpc";
import { type ListRenderItemInfo } from "@shopify/flash-list";
import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function TastingListCard({
  item: { item },
}: {
  item: ListRenderItemInfo<RouterOutputs["tastingList"]["results"][number]>;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Link
          asChild
          href={{
            pathname: "/tastings/[id]",
            params: { id: item.id },
          }}
        >
          <Pressable>
            <Text style={styles.title}>{item.bottle.fullName}</Text>
            <Text style={styles.subtitle}>{item.bottle.category}</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
  },
  header: {
    flexGrow: 1,
  },
  title: {
    color: "white",
    fontWeight: "semibold",
  },
  subtitle: {
    color: "gray",
  },
});
