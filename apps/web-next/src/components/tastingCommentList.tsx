"use client";

import type { Comment, User } from "@peated/server/types";
import { trpc } from "@peated/web/lib/trpc";
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
  const [data] = trpc.commentList.useSuspenseQuery({
    tasting: tastingId,
  });

  const commentDeleteMutation = trpc.commentDelete.useMutation({
    onSuccess: (_data, input) => {
      setDeleted((a) => [...a, input]);
    },
  });

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
            as={motion.li}
            layout
            key={c.id}
            className="relative flex items-start space-x-2 text-white"
            createdAt={c.createdAt}
            createdBy={c.createdBy}
            text={c.comment}
            canDelete={user?.admin || isAuthor}
            onDelete={() => commentDeleteMutation.mutate(c.id)}
          />
        );
      })}
    </AnimatePresence>
  );
}
