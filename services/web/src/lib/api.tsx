const API_SERVER: string =
  import.meta.env.API_SERVER || "http://localhost:4000";

type ApiRequestOptions = {
  method: "GET" | "POST" | "DELETE" | "PUT";
  data?: { [name: string]: any } | undefined;
  files?: {
    [name: string]: Blob;
  };
  query?: any;
};

export class ApiError extends Error {
  response: Response;
  statusCode: number;
  data: any;
  remoteStack: string | undefined;

  constructor(message: string, response: Response, data: any) {
    super(data.error || message);
    this.name = this.constructor.name;
    this.response = response;
    this.statusCode = response.status;
    this.data = data;
    this.remoteStack = data.stack;
  }
}

export class ApiUnavailable extends Error {}

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
    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    const isMultipart = !!Object.keys(options.data || {}).find(
      (k) => options.data![k] instanceof Blob
    );

    let body: FormData | string | undefined;
    if (isMultipart) {
      body = new FormData();
      for (let key in options.data) {
        body.append(key, options.data[key]);
      }
    } else if (options.data) {
      body = options.data ? JSON.stringify(options.data) : undefined;
      headers["Content-Type"] = "application/json";
    }

    let resp;
    try {
      resp = await fetch(
        `${this.server}${path}?${new URLSearchParams(options.query || {})}`,
        {
          body,
          headers,
          ...options,
        }
      );
    } catch (err) {
      throw new ApiUnavailable("Unable to reach API service.");
    }
    if (!resp?.ok) {
      throw new ApiError("Request failed", resp, await resp.json());
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
