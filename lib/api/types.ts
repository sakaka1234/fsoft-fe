/**
 * Shapes taken from docs/api-docs.json (OpenAPI 3.1, Community Response
 * Platform API). Kept hand written rather than generated so the few fields the
 * frontend actually uses stay readable.
 */

/** Every endpoint wraps its payload in this envelope. */
export type ApiResponse<T> = {
  /** Business status from the body. Not always the HTTP status: register
   *  answers HTTP 200 with status 201, and a failed login answers HTTP 401
   *  with status 207. HTTP is the one to branch on. */
  status: number;
  message: string;
  data?: T;
};

export type RoleResponse = {
  name: string;
};

export type UserResponse = {
  id: string;
  fullName: string | null;
  email: string;
  avatar: string | null;
  phone: string | null;
  roles: RoleResponse[];
};

export type TokenResponse = {
  accessToken: string;
  refreshToken: string;
  /** Server format is "2026-08-12 21:59:21", not ISO 8601. Do not feed it to
   *  `new Date()` without normalizing first. */
  accessExpiresAt: string;
  refreshExpiresAt: string;
  accessIssuedAt: string;
  refreshIssuedAt: string;
  /** Seconds. */
  accessExpirationTime: number;
  refreshExpirationTime: number;
};

export type AuthenticatedResponse = {
  user: UserResponse;
  token: TokenResponse;
};

/** Validation failures come back as { field: message }. */
export type ValidationErrorData = {
  path?: string;
  errors?: Record<string, string>;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = {
  fullName: string;
  email: string;
  /** Verified optional against the live API: omitting it returns 201. */
  phone?: string;
  /** Yes, capital W. The register endpoint spells it differently from login. */
  passWord: string;
};

/* ---------------------------------------------------------------------------
   Decks, cards, tags
   ------------------------------------------------------------------------- */

/** Spring Pageable response wrapper. */
export type PageResponse<T> = {
  content: T[];
  pageNo: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
  /**
   * Verified unreliable: a single full page came back with `last: false`.
   * Derive the real answer from `pageNo + 1 >= totalPages` instead.
   */
  last: boolean;
};

export type TagResponse = {
  id: number;
  name: string;
};

export type DeckVisibility = "PUBLIC" | "PRIVATE" | "SHARED";

export type DeckResponse = {
  id: number;
  profileId: string;
  parentDeckId: number | null;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  sourceLanguage: string;
  targetLanguage: string;
  visibility: DeckVisibility;
  /** Verified stale: stays 0 after cards are added. Count cards separately. */
  totalCards: number;
  forkCount: number;
  createdAt: string;
  updatedAt: string;
  tags: TagResponse[];
  official: boolean;
};

/**
 * The write side spells the flag `isOfficial` even though the read side and the
 * OpenAPI document both call it `official`. It is a primitive boolean on the
 * server, so leaving it out is not "use the default", it is a 500:
 * "Cannot map `null` into type `boolean`". Always send it.
 */
export type DeckWriteRequest = {
  title: string;
  description?: string;
  parentDeckId?: number | null;
  sourceLanguage: string;
  targetLanguage: string;
  visibility: DeckVisibility;
  tagIds?: number[];
  isOfficial: boolean;
};

export type CardResponse = {
  id: number;
  deckId: number;
  word: string;
  phonetic: string | null;
  partOfSpeech: string | null;
  meaning: string;
  definitionEn: string | null;
  exampleSentence: string | null;
  exampleMeaning: string | null;
  imageUrl: string | null;
  audioUrl: string | null;
  note: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type CardWriteRequest = {
  word: string;
  meaning: string;
  phonetic?: string;
  partOfSpeech?: string;
  definitionEn?: string;
  exampleSentence?: string;
  exampleMeaning?: string;
  note?: string;
  position?: number;
};

export type CardPositionRequest = {
  cardId: number;
  newPosition: number;
};
