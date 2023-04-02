import type { Bottle, Checkin, User } from "./types";

export async function getUser(userId: string): Promise<User> {
  return {
    id: userId,
    displayName: "Cramer",
  };
}

export async function getBottle(bottleId: string): Promise<Bottle> {
  return {
    id: bottleId,
    brand: {
      id: "1",
      name: "Hibiki",
    },
    name: "12",
    producer: {
      id: "1",
      name: "Hibiki",
      country: "Japan",
    },
  };
}

export async function searchBottles(query: string): Promise<Bottle[]> {
  return [await getBottle("1")];
}

export async function listCheckins(): Promise<Checkin[]> {
  return [
    {
      id: "1",
      bottle: await getBottle("1"),
      tags: [],
      friends: [],
      location: null,
      tastingNotes: null,
      rating: 5,
      user: await getUser("1"),
    },
    {
      id: "2",
      bottle: await getBottle("2"),
      tags: [],
      friends: [],
      location: null,
      tastingNotes: null,
      rating: 3.5,
      user: await getUser("1"),
    },
    {
      id: "3",
      bottle: await getBottle("1"),
      tags: [],
      friends: [],
      location: null,
      tastingNotes: null,
      rating: 5,
      user: await getUser("1"),
    },
    {
      id: "4",
      bottle: await getBottle("2"),
      tags: [],
      friends: [],
      location: null,
      tastingNotes: null,
      rating: 3.5,
      user: await getUser("1"),
    },
  ];
}
