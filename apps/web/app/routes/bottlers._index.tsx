import type { V2_MetaFunction } from "@remix-run/node";

import EntityList from "~/components/entityList";

export const meta: V2_MetaFunction = () => {
  return [
    {
      title: "Bottlers",
    },
  ];
};

export default function Bottlers() {
  return <EntityList type="bottler" />;
}
