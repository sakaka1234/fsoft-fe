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
   *
   * Optional because not every multipart endpoint has one: /profiles/me/avatar
   * declares a single binary part and nothing else, and sending an unexpected
   * "request" part to it is asking for a 400.
   */
  request?: unknown;
  /** Binary parts by name, e.g. { coverImage: file }. Empty values are skipped. */
  files?: Record<string, File | null | undefined>;
};

/**
 * Google's OAuth error body, which is not this API's envelope.
 *
 * /oauth2/callback passes the token endpoint's failure straight through
 * instead of wrapping it. Verified live: a bad code answers HTTP 400 with
 * {"error":"invalid_grant","error_description":"Malformed auth code."}, while
 * every other endpoint answers {status, message, data}.
 */
type OAuthErrorBody = { error?: string; error_description?: string };

/**
 * Best available reason for a failed response.
 *
 * Without the OAuth branch, a Google sign in that fails shows "Request failed
 * with status 400" and throws away the only sentence that explains why, since
 * the passthrough body has no `message` field at all.
 */
function errorMessage(payload: unknown, status: number): string {
  const envelope = payload as ApiResponse<unknown> | null;
  if (envelope?.message) return envelope.message;

  const oauth = payload as OAuthErrorBody | null;
  if (oauth?.error_description) return oauth.error_description;
  if (oauth?.error) return oauth.error;

  return `Request failed with status ${status}`;
}

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
      errorMessage(payload, response.status),
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

  if (request !== undefined) {
    form.append(
      "request",
      new Blob([JSON.stringify(request)], { type: "application/json" }),
    );
  }

  for (const [name, file] of Object.entries(files ?? {})) {
    if (file) form.append(name, file);
  }

  return send<T>(path, { method, body: form, signal }, auth);
}

/**
 * Binary download, for endpoints that answer a file rather than the envelope.
 *
 * send() parses every response as JSON, so it cannot be used here: the PDF
 * export answers application/pdf with a Content-Disposition filename and no
 * envelope at all. This is the only shape in the API that does that.
 *
 * Returns the blob plus the server's filename when it supplied one, so the
 * caller does not have to invent a name.
 */
export async function apiDownload(
  path: string,
  signal?: AbortSignal,
): Promise<{ blob: Blob; filename: string | null }> {
  const token = getSession()?.token.accessToken;
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(
      "Cannot reach the server. Check your connection and try again.",
      0,
    );
  }

  if (!response.ok) {
    // A failure still comes back as the JSON envelope, so read it as one.
    const payload = (await response.json().catch(() => null)) as unknown;
    if (response.status === 401) endSession();
    throw new ApiError(errorMessage(payload, response.status), response.status);
  }

  const disposition = response.headers.get("content-disposition") ?? "";
  const match = disposition.match(/filename="?([^"';]+)"?/i);

  return { blob: await response.blob(), filename: match ? match[1] : null };
}

/*
  Two pagination conventions live in this API, and mixing them up fails
  silently rather than erroring, so they get one function each:

  - Cards still bind Spring's Pageable and are ZERO based. Verified live:
    /cards/deck/9?page=0 answers pageNo=0, page=1 answers pageNo=1 with a
    different slice.
  - Decks take flat page/size and are ONE based. Verified live: /decks/my
    answers pageNo=1 for both page=0 and page=1, because the server clamps
    anything below 1. Passing a zero based index here quietly reads page 1
    twice and never reaches the tail of the list.
*/

/** Zero based. Cards only. */
export function cardPageQuery(page: number, size: number, sort?: string) {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
  });
  if (sort) params.set("sort", sort);
  return `?${params.toString()}`;
}

/** One based. Decks only. Undefined and empty filters are dropped. */
export function deckPageQuery(
  page: number,
  size: number,
  filters: Record<string, string | number | undefined> = {},
) {
  const params = new URLSearchParams({
    page: String(Math.max(1, page)),
    size: String(size),
  });
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return `?${params.toString()}`;
}
