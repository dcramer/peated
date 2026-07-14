import type { PendingImageRouteState } from "@peated/web/lib/addBottle";
import type { AddBottleRouteIntent, BottleResult } from "./bottleResult";
import BottleResultRow from "./bottleResult";
import type { BottlingResult } from "./bottlingResult";
import BottlingResultRow from "./bottlingResult";
import type { EntityResult } from "./entityResult";
import EntityResultRow from "./entityResult";
import type { UserResult } from "./userResult";
import UserResultRow from "./userResult";

export type Result = BottleResult | BottlingResult | UserResult | EntityResult;

export default function ResultRow({
  result,
  directToTasting = false,
  addBottleIntent,
  pendingImage,
}: {
  result: Result;
  directToTasting: boolean;
  addBottleIntent?: AddBottleRouteIntent;
  pendingImage?: PendingImageRouteState | null;
}) {
  switch (result.type) {
    case "bottle":
      return (
        <BottleResultRow
          result={result}
          directToTasting={directToTasting}
          addBottleIntent={addBottleIntent}
          pendingImage={pendingImage}
        />
      );
    case "bottling":
      return (
        <BottlingResultRow
          result={result}
          directToTasting={directToTasting}
          addBottleIntent={addBottleIntent}
          pendingImage={pendingImage}
        />
      );
    case "entity":
      return <EntityResultRow result={result} />;
    case "user":
      return <UserResultRow result={result} />;
    default:
      return null;
  }
}
