import type { MockOutputs } from "../contract";
import { mockFriends } from "./users";

export const mockFriendships: MockOutputs["friends"]["list"]["results"] = [
  {
    id: mockFriends[0]!.id,
    status: "friends",
    user: mockFriends[0]!,
    createdAt: "2026-06-15T12:00:00.000Z",
  },
  {
    id: mockFriends[1]!.id,
    status: "friends",
    user: mockFriends[1]!,
    createdAt: "2026-07-15T12:00:00.000Z",
  },
];
