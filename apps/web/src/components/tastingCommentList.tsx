"use client";

import type { Comment, User } from "@peated/server/types";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import CommentEntry from "./commentEntry";

export default function TastingCommentList({
  user,
  tastingId,
  newValues = [],
}: {
  user?: User | null;
  tastingId: number;
  newValues?: Comment[];
}) {
  const orpc = useORPC();
  const { data } = useSuspenseQuery(
    orpc.comments.list.queryOptions({
      input: { tasting: tastingId },
    })
  );

  const commentDeleteMutation = useMutation(
    orpc.comments.delete.mutationOptions()
  );

  const [deleted, setDeleted] = useState<number[]>([]);

  const commentIds: Set<number> = new Set();

  return (
    <AnimatePresence>
      {[...data.results, ...newValues].map((c) => {
        if (commentIds.has(c.id)) return null;
        commentIds.add(c.id);
        if (deleted.includes(c.id)) return null;
        const isAuthor = user?.id === c.createdBy.id;
        return (
          <CommentEntry
            asChild
            key={c.id}
            className="relative flex items-start space-x-2 text-white"
            createdAt={c.createdAt}
            createdBy={c.createdBy}
            text={c.comment}
            canDelete={user?.admin || isAuthor}
            onDelete={() => {
              commentDeleteMutation.mutate({ comment: c.id });
              setDeleted((a) => [...a, c.id]);
            }}
          >
            <motion.li layout />
          </CommentEntry>
        );
      })}
    </AnimatePresence>
  );
}
