export const profileActivityQueryKeys = {
  all: ["profile-activity"] as const,
  list: (username: string) =>
    ["profile-activity", username, "favorites-hidden"] as const,
};
