import { toTitleCase } from "@peated/server/lib/strings";
import type { PagingRel, Tag } from "@peated/server/types";
import { AdminTable } from "./adminTable.stylex";

export default function TagTable({
  tagList,
  rel,
}: {
  tagList: Tag[];
  rel?: PagingRel;
}) {
  return (
    <AdminTable
      columns={[
        { name: "tag", value: (tag) => toTitleCase(tag.name) },
        {
          align: "right",
          name: "category",
          value: (tag) => toTitleCase(tag.tagCategory),
        },
      ]}
      items={tagList}
      primaryKey={(tag) => tag.name}
      rel={rel}
      url={(tag) => `/admin/tags/${tag.name}`}
    />
  );
}
