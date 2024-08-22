export type ApiRequestOptions = {
  method?: "GET" | "POST" | "DELETE" | "PUT";
  data?: { [name: string]: any } | undefined;
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

export class ApiUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ApiUnauthorized extends ApiError {
  constructor(message: string, response: Response, data: any) {
    super(message, response, data);
    this.name = this.constructor.name;
  }
}

const withoutUndefined = (obj: object) => {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  );
};

export class ApiClient {
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

  setServer(server: string) {
    this.server = server;
  }

  async request(path: string, options: ApiRequestOptions) {
    const headers: { [name: string]: string } = {};
    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    const isMultipart = !!Object.keys(options.data || {}).find(
      (k) => options.data && options.data[k] instanceof Blob,
    );

    let body: FormData | string | undefined;
    if (isMultipart) {
      body = new FormData();
      for (const key in options.data) {
        body.append(key, options.data[key]);
      }
    } else if (options.data) {
      body = options.data ? JSON.stringify(options.data) : undefined;
      headers["Content-Type"] = "application/json";
    }

    let resp;
    try {
      resp = await fetch(
        `${this.server}${path}?${new URLSearchParams(
          withoutUndefined(options.query || {}),
        )}`,
        {
          body,
          headers,
          ...options,
        },
      );
    } catch (err) {
      throw new ApiUnavailable("Unable to reach API service.");
    }
    if (!resp?.ok) {
      if (resp.status === 401) {
        throw new ApiUnauthorized("Unauthorized", resp, await resp.json());
      }
      throw new ApiError("Request failed", resp, await resp.json());
    }
    if (resp.headers.get("Content-Type") !== "application/json") {
      const body = await resp.text();
      if (body) return JSON.parse(body);
    }
    return null;
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
