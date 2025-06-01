"use client";

import type { Comment, User } from "@peated/server/types";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import Button from "./button";
import Fieldset from "./fieldset";
import FormField from "./formField";
import TextArea from "./textArea";
import UserAvatar from "./userAvatar";

export default function TastingCommentForm({
  tastingId,
  user,
  onComment,
}: {
  tastingId: number;
  user: User;
  onComment: (comment: Comment) => void;
}) {
  const orpc = useORPC();
  const commentCreateMutation = useMutation(
    orpc.comments.create.mutationOptions()
  );

  const [formData, setFormData] = useState({
    comment: "",
  });
  const [saving, setSaving] = useState(false);
  return (
    <div className="flex items-start space-x-2 px-3 sm:px-2">
      <div className="h-8 w-8 flex-shrink-0">
        <UserAvatar size={32} user={user} />
      </div>
      <div className="min-w-0 flex-auto">
        <form
          className="relative"
          onSubmit={async (e) => {
            e.preventDefault();

            if (saving) return;
            setSaving(true);

            const newComment = await commentCreateMutation.mutateAsync({
              ...formData,
              tasting: tastingId,
              createdAt: new Date().toISOString(),
            });

            onComment({
              ...newComment,
              createdBy: user,
            });
            setFormData({ comment: "" });
            setSaving(false);
          }}
        >
          <Fieldset>
            <FormField className="border border-slate-800">
              <label htmlFor="comment" className="sr-only">
                Add your comment
              </label>
              <TextArea
                rows={3}
                name="comment"
                id="comment"
                required
                placeholder="How envious are you?"
                value={formData.comment}
                onChange={(e) =>
                  setFormData((formData) => ({
                    ...formData,
                    comment: e.target.value,
                  }))
                }
              />

              {/* Spacer element to match the height of the toolbar */}
              <div className="py-2" aria-hidden="true">
                {/* Matches height of button in toolbar (1px border + 36px content height) */}
                <div className="py-px">
                  <div className="h-9" />
                </div>
              </div>
            </FormField>
          </Fieldset>

          <div className="absolute inset-x-0 bottom-0 z-10 flex justify-between px-4 py-3">
            <div className="flex-shrink-0">
              <Button type="submit" color="primary" disabled={saving}>
                Post Comment
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
