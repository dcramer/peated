"use client";

import { type Comment } from "@peated/server/types";
import { Suspense, useState } from "react";
import useAuth from "../hooks/useAuth";
import EmbeddedLogin from "./embeddedLogin";
import TastingCommentList from "./tastingCommentList";

export default function TastingComments({ tastingId }: { tastingId: number }) {
  const { user } = useAuth();
  const [newComments, setNewComments] = useState<Comment[]>([]);

  return (
    <div className="mt-4">
      {!user && <EmbeddedLogin />}

      <Suspense
        fallback={<div className="p-4 text-center">Loading comments...</div>}
      >
        <TastingCommentList
          user={user}
          tastingId={tastingId}
          newValues={newComments}
        />
      </Suspense>
    </div>
  );
}
