import type { Bottle, Checkin, User } from "../types";

const API_SERVER: string = process.env.API_SERVER || "http://localhost:4000";

type ApiRequestOptions = {
  method: "GET" | "POST" | "DELETE" | "PUT";
  data?: any;
  query?: any;
};

class ApiClient {
  server: string;
  accessToken: string | null;

  constructor({
    server,
    accessToken = null,
  }: {
    server: string;
    accessToken?: string | null;
  }) {
    this.server = server;
    this.accessToken = accessToken;
  }

  setAccessToken(accessToken: string | null = null) {
    this.accessToken = accessToken;
  }

  async request(path: string, options: ApiRequestOptions) {
    const headers: { [name: string]: string } = {};
    if (options.data) headers["Content-Type"] = "application/json";
    if (this.accessToken)
      headers["Authorization"] = `Bearer ${this.accessToken}`;

    const req = await fetch(
      `${this.server}${path}?${new URLSearchParams(options.query || {})}`,
      {
        body: options.data ? JSON.stringify(options.data) : undefined,
        headers,
        ...options,
      }
    );
    return await req.json();
  }

  get(path: string, options: any | undefined = undefined) {
    return this.request(path, {
      method: "GET",
      ...options,
    });
  }

  post(path: string, options: any | undefined = undefined) {
    return this.request(path, {
      method: "POST",
      ...options,
    });
  }

  put(path: string, options: any | undefined = undefined) {
    return this.request(path, {
      method: "PUT",
      ...options,
    });
  }

  delete(path: string, options: any | undefined = undefined) {
    return this.request(path, {
      method: "DELETE",
      ...options,
    });
  }
}

const defaultClient = new ApiClient({ server: API_SERVER });
const api = defaultClient;
export default api;

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
      country: "Japan",
    },
    name: "Hibiki 12",
    distiller: {
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
