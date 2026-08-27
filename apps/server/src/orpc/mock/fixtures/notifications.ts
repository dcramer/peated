import type { MockOutputs } from "../contract";
import { mockBottles } from "./bottles";
import { mockFriends } from "./users";

export const mockNotifications = [
  {
    id: 9910,
    objectId: mockFriends[0]!.id,
    type: "friend_request",
    fromUser: mockFriends[0]!,
    ref: { status: "pending", userId: mockFriends[0]!.id },
    read: false,
    createdAt: "2026-08-26T10:30:00.000Z",
  },
  {
    id: 9911,
    objectId: 9601,
    type: "comment",
    fromUser: mockFriends[1]!,
    ref: { id: 9601, bottle: mockBottles[0]! },
    read: false,
    createdAt: "2026-08-25T18:35:00.000Z",
  },
  {
    id: 9912,
    objectId: 9602,
    type: "toast",
    fromUser: mockFriends[0]!,
    ref: { id: 9602, bottle: mockBottles[1]! },
    read: true,
    createdAt: "2026-08-22T20:30:00.000Z",
  },
] satisfies MockOutputs["notifications"]["list"]["results"];
