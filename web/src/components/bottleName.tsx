import { Bottle } from "../types";

export default ({ bottle }: { bottle: Bottle }) => {
  return (
    <>
      {bottle.name}
      {bottle.series && (
        <em className="text-peated-darker font-light ml-1">{bottle.series}</em>
      )}
    </>
  );
};
