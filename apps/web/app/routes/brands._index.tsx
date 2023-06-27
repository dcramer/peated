import type { V2_MetaFunction } from "@remix-run/node";

import EntityList from "~/components/entityList";

export const meta: V2_MetaFunction = () => {
  return [
    {
      title: "Brands",
    },
  ];
};

export default function Brands() {
  return <EntityList type="brand" />;
}
