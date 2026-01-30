import { ConfluenceConfig } from "../config.js";

export interface ConfluenceRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  queryParams?: Record<string, string | number | boolean | undefined>;
  apiVersion?: "v1" | "v2";
}

export interface ConfluenceErrorResponse {
  message?: string;
  errors?: Array<{ message: string }>;
  statusCode?: number;
}

export class ConfluenceApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: ConfluenceErrorResponse
  ) {
    super(message);
    this.name = "ConfluenceApiError";
  }
}

export class ConfluenceClient {
  private config: ConfluenceConfig;
  private cloudId: string | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(config: ConfluenceConfig) {
    this.config = config;

    // If cloudId is provided in config, use it directly
    if (config.cloudId) {
      this.cloudId = config.cloudId;
    }
  }

  /**
   * Initialize the client by fetching the cloudId if needed (for scoped tokens)
   */
  private async ensureInitialized(): Promise<void> {
    // Classic tokens don't need initialization
    if (this.config.tokenType === "classic") {
      return;
    }

    // Already have cloudId
    if (this.cloudId) {
      return;
    }

    // Prevent multiple parallel initializations
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.fetchCloudId();
    return this.initPromise;
  }

  /**
   * Fetch the cloudId from the tenant_info endpoint
   * This works for both scoped tokens and classic tokens
   */
  private async fetchCloudId(): Promise<void> {
    // Get cloudId from the tenant_info endpoint
    // URL: https://<site>.atlassian.net/_edge/tenant_info
    const tenantInfoUrl = `${this.config.host}/_edge/tenant_info`;

    const response = await fetch(tenantInfoUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new ConfluenceApiError(
        `Failed to fetch tenant info from ${tenantInfoUrl}: ${text}`,
        response.status
      );
    }

    const tenantInfo: { cloudId: string } = await response.json();

    if (!tenantInfo.cloudId) {
      throw new ConfluenceApiError(
        "No cloudId found in tenant info response",
        500
      );
    }

    this.cloudId = tenantInfo.cloudId;
  }

  /**
   * Build the appropriate URL based on token type
   * Confluence REST API v2 uses /wiki/api/v2 prefix
   */
  private buildUrl(
    path: string,
    queryParams?: Record<string, string | number | boolean | undefined>,
    apiVersion: "v1" | "v2" = "v2"
  ): string {
    let baseUrl: string;

    // Determine the API path prefix based on version
    const apiPath = apiVersion === "v1" ? "/wiki/rest/api" : "/wiki/api/v2";

    if (this.config.tokenType === "scoped") {
      // Scoped tokens use api.atlassian.com with cloudId
      baseUrl = `https://api.atlassian.com/ex/confluence/${this.cloudId}${apiPath}`;
    } else {
      // Classic tokens use the direct site URL
      baseUrl = `${this.config.host}${apiPath}`;
    }

    const url = new URL(`${baseUrl}${path}`);

    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url.toString();
  }

  /**
   * Get the appropriate authorization header
   * Both classic and scoped tokens use Basic authentication (email:token)
   */
  private getAuthHeader(): string {
    // Both classic and scoped tokens use Basic authentication
    const credentials = Buffer.from(
      `${this.config.email}:${this.config.apiToken}`
    ).toString("base64");
    return `Basic ${credentials}`;
  }

  private async request<T>(
    path: string,
    options: ConfluenceRequestOptions = {}
  ): Promise<T> {
    // Ensure we're initialized (fetches cloudId if needed)
    await this.ensureInitialized();

    const { method = "GET", body, queryParams, apiVersion = "v2" } = options;
    const url = this.buildUrl(path, queryParams, apiVersion);

    const headers: Record<string, string> = {
      Authorization: this.getAuthHeader(),
      Accept: "application/json",
    };

    if (body) {
      headers["Content-Type"] = "application/json";
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    if (body) {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);

    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      throw new ConfluenceApiError(
        `Rate limited. Retry after ${retryAfter || "unknown"} seconds`,
        429
      );
    }

    // Handle no content responses
    if (response.status === 204) {
      return {} as T;
    }

    // Get response text first to handle both JSON and non-JSON responses
    const responseText = await response.text();

    // Try to parse as JSON
    let data: T | ConfluenceErrorResponse | undefined;
    let parseError: Error | undefined;

    if (responseText) {
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        parseError = e as Error;
        // If it's not JSON, treat the text as the response/error message
      }
    }

    if (!response.ok) {
      // Handle error response
      let errorMessage: string;

      if (data && typeof data === "object") {
        const errorData = data as ConfluenceErrorResponse;
        errorMessage =
          errorData.message ||
          errorData.errors?.map((e) => e.message).join(", ") ||
          `HTTP ${response.status}`;
        throw new ConfluenceApiError(errorMessage, response.status, errorData);
      } else {
        // Plain text error response
        errorMessage = responseText || `HTTP ${response.status}`;
        throw new ConfluenceApiError(errorMessage, response.status, {
          message: errorMessage,
        });
      }
    }

    // For successful responses
    if (parseError && responseText) {
      // Non-JSON successful response (like file downloads)
      return responseText as unknown as T;
    }

    return (data ?? {}) as T;
  }

  // Standard REST API v2 methods
  async get<T>(
    path: string,
    queryParams?: Record<string, string | number | boolean | undefined>
  ): Promise<T> {
    return this.request<T>(path, { method: "GET", queryParams });
  }

  // REST API v1 methods (for endpoints not available in v2, like CQL search)
  async getV1<T>(
    path: string,
    queryParams?: Record<string, string | number | boolean | undefined>
  ): Promise<T> {
    return this.request<T>(path, { method: "GET", queryParams, apiVersion: "v1" });
  }

  async post<T>(
    path: string,
    body?: unknown,
    queryParams?: Record<string, string | number | boolean | undefined>
  ): Promise<T> {
    return this.request<T>(path, { method: "POST", body, queryParams });
  }

  async put<T>(
    path: string,
    body?: unknown,
    queryParams?: Record<string, string | number | boolean | undefined>
  ): Promise<T> {
    return this.request<T>(path, { method: "PUT", body, queryParams });
  }

  async delete<T>(
    path: string,
    queryParams?: Record<string, string | number | boolean | undefined>
  ): Promise<T> {
    return this.request<T>(path, { method: "DELETE", queryParams });
  }
}
