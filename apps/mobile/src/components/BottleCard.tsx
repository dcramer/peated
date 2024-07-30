import type { Bottle } from "@peated/server/types";
import { Link } from "expo-router";
import type { ComponentPropsWithoutRef } from "react";
import { Pressable, View } from "react-native";
import { CheckBadgeIcon, StarIcon } from "react-native-heroicons/solid";
import classNames from "../lib/classNames";
import { Text } from "./StyledText";

type BottleFormData = {
  name: string;
  vintageYear?: number | null;
  releaseYear?: number | null;
  brand?:
    | {
        id: number;
        name: string;
        shortName?: string | null;
      }
    | null
    | undefined;
  distillers?:
    | {
        id: number;
        name: string;
        shortName?: string | null;
      }[]
    | null
    | undefined;
  statedAge?: number | null | undefined;
  category?: string | null | undefined;
};

function BottleCardScaffold({
  name,
  distillers,
  variant = "default",
  noGutter = false,
}: {
  name: any;
  distillers: any;
  variant?: "default" | "highlight" | "inherit";
  noGutter?: boolean;
}) {
  return (
    <View
      className={classNames(
        "flex flex-row items-center space-x-2 overflow-hidden sm:space-x-3",
        variant === "highlight"
          ? "bg-highlight"
          : variant === "inherit"
            ? ""
            : "bg-slate-950",
        noGutter ? "" : "p-3 sm:px-5 sm:py-4",
      )}
    >
      <View className="flex-1 overflow-hidden">
        <View className="flex w-full flex-row flex-row items-center space-x-1">
          {name}
        </View>
        <View className={classNames("text-sm")}>{distillers}</View>
      </View>
    </View>
  );
}

export const PreviewBottleCard = ({
  data,
}: {
  data: Partial<BottleFormData>;
}) => {
  const { brand } = data;
  return (
    <BottleCardScaffold
      name={
        <Text>{`${brand ? `${brand.shortName || brand.name} ${data.name}` : data.name}${data.releaseYear ? ` (${data.releaseYear})` : ""}`}</Text>
      }
      distillers={
        data.distillers?.length ? (
          <Text>{data.distillers.map((d) => d.name).join(" ")}</Text>
        ) : null
      }
      variant="highlight"
    />
  );
};

export default function BottleCard({
  bottle,
  noGutter,
  variant,
}: {
  bottle: Bottle;
} & Pick<
  ComponentPropsWithoutRef<typeof BottleCardScaffold>,
  "variant" | "noGutter"
>) {
  return (
    <BottleCardScaffold
      name={
        <>
          <Link
            asChild
            href={{
              pathname: "/bottles/[bottleId]",
              params: { id: bottle.id },
            }}
          >
            <Pressable>
              <Text className="font-bold">{bottle.fullName}</Text>
            </Pressable>
          </Link>
          {bottle.releaseYear && (
            <Text variant={variant === "highlight" ? "highlight" : "muted"}>
              ({bottle.releaseYear})
            </Text>
          )}
          {bottle.isFavorite && (
            <View className="w-4">
              <StarIcon size={8} />
            </View>
          )}
          {bottle.hasTasted && (
            <View className="w-4">
              <CheckBadgeIcon size={8} />
            </View>
          )}
        </>
      }
      distillers={
        bottle.distillers?.length ? (
          <Text variant="muted">
            {bottle.distillers.map((d) => d.shortName || d.name).join(", ")}
          </Text>
        ) : null
      }
      variant={variant}
      noGutter={noGutter}
    />
  );
}
