"use client";

import { type Comment } from "@peated/server/types";
import { Suspense, useState } from "react";
import useAuth from "../hooks/useAuth";
import EmbeddedLogin from "./embeddedLogin";
import TastingCommentForm from "./tastingCommentForm";
import TastingCommentList from "./tastingCommentList";

export default function TastingComments({ tastingId }: { tastingId: number }) {
  const { user } = useAuth();

  const [newComments, setNewComments] = useState<Comment[]>([]);

  return (
    <>
      {user ? (
        <TastingCommentForm
          tastingId={tastingId}
          user={user}
          onComment={(comment) => {
            setNewComments((comments) => [...comments, comment]);
          }}
        />
      ) : (
        <EmbeddedLogin />
      )}

      <ul className="my-4 space-y-4 px-3 sm:px-2">
        <Suspense>
          <TastingCommentList
            user={user}
            tastingId={tastingId}
            newValues={newComments}
          />
        </Suspense>
      </ul>
    </>
  );
}
