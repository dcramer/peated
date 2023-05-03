const API_SERVER: string =
  import.meta.env.API_SERVER || "http://localhost:4000";

type ApiRequestOptions = {
  method: "GET" | "POST" | "DELETE" | "PUT";
  data?: any;
  query?: any;
};

export class ApiError extends Error {
  response: Response;

  constructor(message: string, response: Response) {
    super(message);
    this.name = this.constructor.name;
    this.response = response;
  }

  async errorMessage() {
    return (await this.response.json()).message;
  }
}

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

    const resp = await fetch(
      `${this.server}${path}?${new URLSearchParams(options.query || {})}`,
      {
        body: options.data ? JSON.stringify(options.data) : undefined,
        headers,
        ...options,
      }
    );
    if (!resp?.ok) {
      throw new ApiError("Request failed", resp);
    }
    return await resp.json();
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

// TODO(dcramer): we duplicate our token storage method here due to complexity
// in loaders and when they run
const createDefaultClient = () => {
  let accessToken: string | null = null;
  try {
    // Get from local storage by key
    const item = window.localStorage.getItem("token");
    // Parse stored json or if none return initialValue
    accessToken = item ? JSON.parse(item) : null;
  } catch (error) {
    // If error also return initialValue
    console.log(error);
  }
  return new ApiClient({ server: API_SERVER, accessToken });
};

const defaultClient = createDefaultClient();
const api = defaultClient;
export default api;
