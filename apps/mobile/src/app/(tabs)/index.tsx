import TastingListCard from "@peated/mobile/components/TastingListCard";
import { trpc } from "@peated/mobile/lib/trpc";
import { FlashList } from "@shopify/flash-list";
import { StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ActivityScreen() {
  const filter = "global";
  const tastingList = trpc.tastingList.useQuery({
    filter,
    limit: 10,
  });

  return (
    <SafeAreaView style={styles.container}>
      <FlashList
        data={tastingList.data?.results || []}
        estimatedItemSize={20}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={(item) => <TastingListCard item={item} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: StatusBar.currentHeight,
  },
  separator: {
    height: 2,
  },
  text: {
    color: "white",
    fontSize: 32,
  },
});
