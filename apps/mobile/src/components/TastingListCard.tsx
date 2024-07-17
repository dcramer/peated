import theme from "@peated/design";
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
        <View style={styles.author}>
          <Link
            asChild
            href={{
              pathname: "/users/[username]",
              params: { id: item.createdBy.username },
            }}
          >
            <Pressable>
              <Text style={styles.username}>{item.createdBy.username}</Text>
            </Pressable>
          </Link>
        </View>
        <View style={styles.metadata}>
          <Text style={styles.date}>{item.createdAt}</Text>
        </View>
      </View>
    </View>
  );
}

// <li className="overflow-hidden bg-slate-950 ring-1 ring-inset ring-slate-800">
// <div className="border-x border-slate-800 bg-gradient-to-r from-slate-950 to-slate-900">
//   <div className="flex items-center space-x-4 p-3 sm:px-5 sm:py-4">
//     <UserAvatar size={32} user={tasting.createdBy} />
//     <div className="flex-auto space-y-1 font-semibold">
//       <Link
//         href={`/users/${tasting.createdBy.username}`}
//         className="truncate hover:underline"
//       >
//         {tasting.createdBy.username}
//       </Link>
//     </div>
//     <div className="flex flex-col items-end gap-y-2">
//       <Link href={`/tastings/${tasting.id}`} className="hover:underline">
//         <TimeSince
//           className="block text-sm font-light"
//           date={tasting.createdAt}
//         />
//       </Link>
//     </div>
//   </div>

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.slate[950],
    borderWidth: 1,
    borderColor: theme.colors.slate[800],
  },
  header: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  author: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: "auto",
  },
  username: {
    fontWeight: "bold",
    color: theme.colors.white,
  },
  metadata: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
  },
  date: {
    color: theme.colors.light,
    fontSize: 12,
  },
});
