import type { BottleResult } from "./bottleResult";
import BottleResultRow from "./bottleResult";
import type { EntityResult } from "./entityResult";
import EntityResultRow from "./entityResult";
import type { UserResult } from "./userResult";
import UserResultRow from "./userResult";

export type Result = BottleResult | UserResult | EntityResult;

export default function ResultRow({
  result,
  directToTasting = false,
}: {
  result: Result;
  directToTasting: boolean;
}) {
  switch (result.type) {
    case "bottle":
      return (
        <BottleResultRow result={result} directToTasting={directToTasting} />
      );
    case "entity":
      return <EntityResultRow result={result} />;
    case "user":
      return <UserResultRow result={result} />;
    default:
      return null;
  }
}
