import type { Bottle, Checkin, User } from "../types";

const API_SERVER: string = process.env.API_SERVER || "http://localhost:4000";

type ApiRequestOptions = {
  method: "GET" | "POST" | "DELETE" | "PUT";
  json?: any;
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
    if (options.json) headers["Content-Type"] = "application/json";
    if (this.accessToken)
      headers["Authorization"] = `Bearer ${this.accessToken}`;

    const req = await fetch(`${this.server}${path}`, {
      method: options.method,
      body: options.json ? JSON.stringify(options.json) : undefined,
      headers,
    });
    return await req.json();
  }

  get(path: string) {
    return this.request(path, {
      method: "GET",
    });
  }

  post(path: string, data: any | undefined) {
    return this.request(path, {
      method: "POST",
      json: data,
    });
  }

  put(path: string, data: any | undefined) {
    return this.request(path, {
      method: "PUT",
      json: data,
    });
  }

  delete(path: string, data: any | undefined) {
    return this.request(path, {
      method: "DELETE",
      json: data,
    });
  }
}

const defaultClient = new ApiClient({ server: API_SERVER });

export default defaultClient;

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
