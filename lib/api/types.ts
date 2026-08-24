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
  /**
   * Optional in the contract, required in practice. Re-verified after the
   * latest deploy: a brand new email with no phone still answers 400
   * "Email or Phone already exists", because the duplicate check turns a null
   * phone into `phone IS NULL` and matches any existing row without one.
   * register-form.tsx makes the field mandatory to route around it.
   */
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
   * Was unreliable and now answers correctly, but decks and cards number their
   * pages differently (decks from 1, cards from 0), so `last` is the only
   * safe cross-entity end-of-list check. Do not compare pageNo to totalPages
   * without knowing which entity you are holding.
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
  /**
   * Now maintained when cards are written, but not backfilled: decks created
   * before the fix still report 0 while holding cards. Fine for a list badge,
   * not something to assert on.
   */
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
 *
 * Re-verified against the live API after the latest backend deploy: sending
 * `official` still returns 500, `isOfficial` still returns 201.
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

export type PublicDeckQuery = {
  page?: number;
  size?: number;
  keyword?: string;
  tagId?: number;
  sourceLang?: string;
  targetLang?: string;
};

export type ForgotPasswordRequest = {
  email: string;
};

export type ResetPasswordRequest = {
  email: string;
  otp: string;
  newPassword: string;
};

/**
 * Declared by the OpenAPI document but never sent: the endpoint reads the
 * visibility from the query string instead. Kept as documentation of the gap.
 * See setDeckVisibility in lib/api/decks.ts.
 */
export type DeckVisibilityRequest = {
  visibility: DeckVisibility;
};

export type SharePermission = "VIEW" | "EDIT";

/**
 * Recipients are named by email now. The earlier revision of this API took a
 * profile UUID with no way to resolve one, which is why sharing had no UI; that
 * blocker is gone.
 */
export type ShareDeckRequest = {
  email: string;
  permission: SharePermission;
};

export type DeckShareResponse = {
  profileId: string;
  email: string;
  fullName: string | null;
  avatar: string | null;
  permission: SharePermission;
};

/**
 * What /profiles/me returns. Note there is no email on it: the account's email
 * lives on the session user, not the profile, so screens that show both read
 * from two places.
 */
export type ProfileResponse = {
  id: string;
  fullName: string | null;
  about: string | null;
  avatar: string | null;
  personalWebsite: string | null;
  github: string | null;
  linkedin: string | null;
  facebook: string | null;
  youtube: string | null;
};

/** Every field is optional, and omitted ones are left alone. Verified live. */
export type ProfileUpdateRequest = {
  fullName?: string;
  about?: string;
  personalWebsite?: string;
  github?: string;
  linkedin?: string;
  facebook?: string;
  youtube?: string;
};

export type UserStreakResponse = {
  id: number;
  currentStreak: number;
  longestStreak: number;
  /** ISO date, null until the account has its first active day. */
  lastActiveDate: string | null;
  updatedAt: string;
};

export type UserActivityResponse = {
  id: number;
  /** ISO date, one row per active day. */
  activityDate: string;
  cardsReviewedCount: number;
  quizzesCompletedCount: number;
};

/* ---------------------------------------------------------------------------
   SRS / FSRS Types
   ------------------------------------------------------------------------- */

/**
 * LAPSED, not RELEARNING. The OpenAPI document types
 * ReviewCardResponse.status as NEW|LEARNING|REVIEW|LAPSED, and a live queue
 * answered NEW and LEARNING. RELEARNING would never match.
 */
export type SrsStatus = "NEW" | "LEARNING" | "REVIEW" | "LAPSED";

export type ReviewCardResponse = {
  card: CardResponse;
  status: SrsStatus;
  easinessFactor: number;
  stability: number | null;
  difficulty: number | null;
  repetitions: number;
  interval: number;
  nextReviewDate?: string;
  lastReviewedAt?: string | null;
};

/**
 * 1 Again, 2 Hard, 3 Good, 4 Easy, the SM-2 ordering. Established by grading
 * four identical NEW cards one level each: 1 reset repetitions to 0, cut
 * easiness from 2.5 to 1.96 and rescheduled for the same day, while 2, 3 and 4
 * moved to the next day at easiness 2.18, 2.36 and 2.50. Outside 1 to 4 the
 * server answers 400 with a field error on rating.
 */
export type SrsRating = 1 | 2 | 3 | 4;

export type SrsReviewRequest = {
  cardId: number;
  rating: SrsRating;
};

/* ---------------------------------------------------------------------------
   AI and SRS.

   Everything below the AI line uses snake_case, unlike the rest of this file.
   That is not a transcription slip: verified live against GET /api/ai/search,
   which answers {"results":[{"card_id":..,"deck_id":..,"match_type":".."}],
   "latency_ms":5,"candidate_count":1}. Renaming these to camelCase for
   consistency will break every AI call silently.

   The AI routes also carry an /api prefix that no other route in this API has
   (/decks, /cards, /srs sit at the root). Verified: dropping it answers 500
   "No static resource ai/search".
   ------------------------------------------------------------------------- */

export type ChatRole = "user" | "assistant" | "system";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type ChatOptions = {
  top_k?: number;
  max_output_tokens?: number;
};

export type AiChatRequest = {
  query: string;
  /** Restricts retrieval to one deck. */
  scope_deck_id?: number;
  allowed_deck_ids?: number[];
  /** The API keeps no conversation state, so the client resends the thread. */
  history?: ChatMessage[];
  options?: ChatOptions;
};

export type AiCitation = {
  card_id: number;
  word: string;
  deck_id: number;
  score: number;
  rank: number;
  used_in_answer: boolean;
};

export type AiUsage = {
  provider: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  latency_ms: number;
};

export type AiChatResponse = {
  answer: string;
  intent: string;
  answer_source: string;
  /** What the retriever actually searched for, useful when an answer is off. */
  rewritten_query: string;
  citations: AiCitation[];
  usage: AiUsage;
};

export type AiMatchingPair = {
  card_id: number;
  word: string;
  correct_option_index: number;
};

export type AiQuizQuestion = {
  index: number;
  /** No enum in the OpenAPI document, so callers must branch defensively. */
  type: string;
  card_id: number;
  prompt: string;
  options: string[];
  correct_index: number;
  explanation: string;
  generated_by: string;
  audio_url: string | null;
  matching: AiMatchingPair[] | null;
};

export type AiQuizStats = {
  deterministic_count: number;
  llm_count: number;
  prompt_tokens: number;
  completion_tokens: number;
  latency_ms: number;
};

export type AiQuizRequest = {
  deck_id?: number;
  allowed_deck_ids?: number[];
  question_count?: number;
  types?: string[];
  card_ids?: number[];
  use_ai_context?: boolean;
};

export type AiQuizResponse = {
  questions: AiQuizQuestion[];
  stats: AiQuizStats;
};

export type AiSearchResultItem = {
  card_id: number;
  word: string;
  meaning: string;
  deck_id: number;
  deck_title: string;
  score: number;
  /** Seen live: "EXACT". Others undocumented. */
  match_type: string;
};

export type AiSearchResponse = {
  results: AiSearchResultItem[];
  latency_ms: number;
  candidate_count: number;
};
