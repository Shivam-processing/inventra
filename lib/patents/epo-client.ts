const DEFAULT_OPS_BASE_URL = "https://ops.epo.org/3.2";
const CONNECTION_CHECK_PATH =
  "/rest-services/published-data/publication/epodoc/EP1000000/biblio";

type EpoOpsErrorKind =
  | "configuration"
  | "token-network"
  | "token-response"
  | "access-network"
  | "access-response";

type EpoOpsTokenResponse = {
  access_token?: unknown;
};

export type EpoOpsClientOptions = {
  consumerKey?: string;
  consumerSecret?: string;
  baseUrl?: string;
  fetchImplementation?: typeof fetch;
};

export class EpoOpsError extends Error {
  readonly kind: EpoOpsErrorKind;
  readonly status?: number;

  constructor(kind: EpoOpsErrorKind, status?: number) {
    super("EPO OPS request failed");
    this.name = "EpoOpsError";
    this.kind = kind;
    this.status = status;
  }
}

export class EpoOpsClient {
  private readonly consumerKey: string;
  private readonly consumerSecret: string;
  private readonly baseUrl: string;
  private readonly fetchImplementation: typeof fetch;

  constructor(options: EpoOpsClientOptions = {}) {
    const consumerKey =
      options.consumerKey ?? process.env.EPO_OPS_CONSUMER_KEY;
    const consumerSecret =
      options.consumerSecret ?? process.env.EPO_OPS_CONSUMER_SECRET;

    if (!consumerKey?.trim() || !consumerSecret?.trim()) {
      throw new EpoOpsError("configuration");
    }

    this.consumerKey = consumerKey;
    this.consumerSecret = consumerSecret;
    this.baseUrl = (options.baseUrl ?? DEFAULT_OPS_BASE_URL).replace(/\/$/, "");
    this.fetchImplementation = options.fetchImplementation ?? fetch;
  }

  async getAccessToken(): Promise<string> {
    let response: Response;

    try {
      response = await this.fetchImplementation(
        `${this.baseUrl}/auth/accesstoken`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            Authorization: `Basic ${Buffer.from(
              `${this.consumerKey}:${this.consumerSecret}`,
            ).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ grant_type: "client_credentials" }),
        },
      );
    } catch {
      throw new EpoOpsError("token-network");
    }

    if (!response.ok) {
      throw new EpoOpsError("token-response", response.status);
    }

    let payload: EpoOpsTokenResponse;

    try {
      payload = (await response.json()) as EpoOpsTokenResponse;
    } catch {
      throw new EpoOpsError("token-response", response.status);
    }

    if (
      typeof payload.access_token !== "string" ||
      payload.access_token.length === 0
    ) {
      throw new EpoOpsError("token-response", response.status);
    }

    return payload.access_token;
  }

  async request(path: string, init: RequestInit = {}): Promise<Response> {
    const accessToken = await this.getAccessToken();
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${accessToken}`);

    if (!headers.has("Accept")) {
      headers.set("Accept", "application/xml");
    }

    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    let response: Response;

    try {
      response = await this.fetchImplementation(
        `${this.baseUrl}${normalizedPath}`,
        {
          ...init,
          headers,
        },
      );
    } catch {
      throw new EpoOpsError("access-network");
    }

    if (!response.ok) {
      throw new EpoOpsError("access-response", response.status);
    }

    return response;
  }

  async checkConnection(): Promise<void> {
    const response = await this.request(CONNECTION_CHECK_PATH);
    await response.body?.cancel();
  }
}

export function formatEpoOpsError(error: unknown): string {
  if (!(error instanceof EpoOpsError)) {
    return "EPO OPS error: unexpected failure";
  }

  switch (error.kind) {
    case "configuration":
      return "EPO OPS configuration error: required credentials are missing";
    case "token-network":
      return "EPO OPS token error: network request failed";
    case "token-response":
      return error.status
        ? `EPO OPS token error: HTTP ${error.status}`
        : "EPO OPS token error: invalid response";
    case "access-network":
      return "EPO OPS access error: network request failed";
    case "access-response":
      return error.status
        ? `EPO OPS access error: HTTP ${error.status}`
        : "EPO OPS access error: invalid response";
  }
}
