import { type RouterOutputs } from "@peated/mobile/lib/trpc";
import { formatColor, formatServingStyle } from "@peated/server/lib/format";
import { COLOR_SCALE } from "@peated/server/src/constants";
import { type ListRenderItemInfo } from "@shopify/flash-list";
import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import {
  ChatBubbleLeftRightIcon,
  HandThumbUpIcon,
} from "react-native-heroicons/solid";
import BottleCard from "./BottleCard";
import Button from "./Button";
import DefinitionList from "./DefinitionList";
import { Text } from "./StyledText";
import TimeSince from "./TimeSince";

export default function TastingListCard({
  item: { item },
}: {
  item: ListRenderItemInfo<RouterOutputs["tastingList"]["results"][number]>;
}) {
  const user: { id: number } | null = null;
  const [hasToasted, setHasToasted] = useState(item.hasToasted);
  const isTaster = user?.id === item.createdBy.id;
  const totalToasts = item.toasts + (hasToasted && !item.hasToasted ? 1 : 0);

  const canToast = !hasToasted && !isTaster && user;

  return (
    <View className="bg-slate-950 ring-1 ring-inset ring-slate-800">
      <View className="border-x border-slate-800 bg-slate-900 bg-gradient-to-r from-slate-950 to-slate-900">
        <View className="flex flex-row items-center space-x-4 p-3">
          <View className="flex-auto space-y-1">
            <Link
              asChild
              href={{
                pathname: "/users/[username]",
                params: { id: item.createdBy.username },
              }}
            >
              <Pressable>
                <Text className="font-semibold">{item.createdBy.username}</Text>
              </Pressable>
            </Link>
          </View>
          <View>
            <TimeSince variant="muted" date={item.createdAt} />
          </View>
        </View>
        <BottleCard bottle={item.bottle} />
      </View>
      <View>
        {/* {!!item.imageUrl && (
          <div className="flex max-h-[250px] min-w-full items-center justify-center overflow-hidden bg-slate-950 sm:mr-4">
            <ImageWithSkeleton
              src={item.imageUrl}
              className="h-full cursor-pointer"
              alt=""
              onClick={() => setImageOpen(true)}
            />
            <ImageModal
              image={item.imageUrl}
              open={imageOpen}
              setOpen={setImageOpen}
            />
          </div>
        )} */}
        {!!item.notes && (
          <View className="p-3">
            <Text variant="muted">{item.notes}</Text>
          </View>
        )}
        {(item.servingStyle ||
          item.color ||
          item.rating ||
          item.tags.length > 0) && (
          <DefinitionList className="grid-cols grid grid-cols-2 gap-y-4 p-3">
            {item.rating && (
              <View>
                <DefinitionList.Term text="Rating" />
                <DefinitionList.Details>
                  <Text>{item.rating}</Text>
                </DefinitionList.Details>
              </View>
            )}
            {item.tags.length > 0 && (
              <View>
                <DefinitionList.Term text="Notes" />
                <DefinitionList.Details
                  text={item.tags.join(", ")}
                ></DefinitionList.Details>
              </View>
            )}
            {item.servingStyle && (
              <View>
                <DefinitionList.Term text="Style" />
                <DefinitionList.Details
                  text={formatServingStyle(item.servingStyle)}
                />
              </View>
            )}
            {item.color && (
              <View>
                <DefinitionList.Term text="Color" />
                <DefinitionList.Details>
                  <View
                    className="h-4 w-4"
                    style={{ backgroundColor: COLOR_SCALE[item.color][2] }}
                  />
                  <Text variant="muted">{formatColor(item.color)}</Text>
                </DefinitionList.Details>
              </View>
            )}
          </DefinitionList>
        )}

        <View className="flex flex-row items-center space-x-3 p-3">
          <Button
            icon={HandThumbUpIcon}
            active={hasToasted}
            disabled={!canToast}
          >
            {totalToasts}
          </Button>

          <Button icon={ChatBubbleLeftRightIcon}>
            {item.comments.toLocaleString()}
          </Button>
        </View>
      </View>
    </View>
  );
}
