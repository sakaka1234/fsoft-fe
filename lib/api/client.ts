import type { ApiResponse, ValidationErrorData } from "@/lib/api/types";
import { endSession, getSession } from "@/lib/auth/session-store";

/**
 * Backend base URL. Set NEXT_PUBLIC_API_BASE_URL in .env.local to point at a
 * local backend; the fallback is the deployed instance from api-docs.json.
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "https://fsoft-project-production.up.railway.app/fsoft";

/**
 * One failure type for the whole API surface, so forms can show a banner and
 * per-field messages without each caller re-parsing the envelope.
 */
export class ApiError extends Error {
  readonly httpStatus: number;
  /** Field name to message, from a 400 validation response. */
  readonly fieldErrors: Record<string, string>;

  constructor(
    message: string,
    httpStatus: number,
    fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.httpStatus = httpStatus;
    this.fieldErrors = fieldErrors;
  }
}

type BaseOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /**
   * Attach the stored access token. Endpoints under bearerAuth need it, the
   * auth endpoints do not.
   */
  auth?: boolean;
  signal?: AbortSignal;
};

type JsonOptions = BaseOptions & { body?: unknown };

type UploadOptions = BaseOptions & {
  /**
   * The JSON half of a multipart write. Sent as a part literally named
   * "request", which is what the deck and card controllers bind to.
   */
  request: unknown;
  /** Binary parts by name, e.g. { coverImage: file }. Empty values are skipped. */
  files?: Record<string, File | null | undefined>;
};

async function send<T>(
  path: string,
  init: RequestInit,
  useAuth: boolean,
): Promise<T> {
  const token = useAuth ? getSession()?.token.accessToken : undefined;
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        ...init.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    // fetch only rejects on network or CORS failure, never on a 4xx or 5xx.
    throw new ApiError(
      "Cannot reach the server. Check your connection and try again.",
      0,
    );
  }

  const payload = (await response
    .json()
    .catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok) {
    if (response.status === 401 && useAuth) {
      /*
        The access token is dead. Clearing the session makes the app shell
        bounce to sign in on its next render. There is a /auth/refresh-token
        endpoint that could renew it instead; wiring that is a separate change,
        deliberately not smuggled in here.
      */
      endSession();
    }
    const validation = payload?.data as ValidationErrorData | undefined;
    throw new ApiError(
      payload?.message ?? `Request failed with status ${response.status}`,
      response.status,
      validation?.errors ?? {},
    );
  }

  return payload?.data as T;
}

/** JSON request and response. */
export function apiFetch<T>(
  path: string,
  { method = "GET", body, auth = false, signal }: JsonOptions = {},
): Promise<T> {
  return send<T>(
    path,
    {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      signal,
    },
    auth,
  );
}

/**
 * multipart/form-data write.
 *
 * The JSON part has to declare its own content type or the server reads it as
 * application/octet-stream and rejects the request, which is why it goes in as
 * a typed Blob rather than a plain string. The request's own Content-Type is
 * left unset on purpose: the browser has to add the multipart boundary.
 */
export function apiUpload<T>(
  path: string,
  { method = "POST", request, files, auth = true, signal }: UploadOptions,
): Promise<T> {
  const form = new FormData();
  form.append(
    "request",
    new Blob([JSON.stringify(request)], { type: "application/json" }),
  );

  for (const [name, file] of Object.entries(files ?? {})) {
    if (file) form.append(name, file);
  }

  return send<T>(path, { method, body: form, signal }, auth);
}

/** Serializes Spring's Pageable query parameters. */
export function pageQuery(page: number, size: number, sort?: string) {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
  });
  if (sort) params.set("sort", sort);
  return `?${params.toString()}`;
}
