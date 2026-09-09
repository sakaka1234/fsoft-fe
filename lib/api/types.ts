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
  /** True while waiting for admin approval after requesting PUBLIC. */
  pendingPublic: boolean;
  /** Admin's reason, set when a pending-public request was declined. */
  rejectionReason: string | null;
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

   The chat, quiz and search types use snake_case, unlike the rest of this
   file. That is not a transcription slip: verified live against GET
   /api/ai/search, which answers {"results":[{"card_id":..,"deck_id":..,
   "match_type":".."}],"latency_ms":5,"candidate_count":1}. Renaming these to
   camelCase for consistency will break every AI call silently.

   BUT THE EXTRACTION TYPES FURTHER DOWN ARE camelCase. Same /api/ai prefix,
   opposite convention, and getting it wrong does not error: the extraction
   controller ignores unknown properties, so deck_id is accepted, dropped, and
   deckId arrives null. Verified by type mismatch, which is the only probe that
   names the real field: deckId:"abc" answers 400 naming
   TextExtractionRequest["deckId"], while deck_id:"abc" answers 200.

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

export type QuizGenerateRequest = {
  deckId?: number;
  allowedDeckIds?: number[];
  questionCount?: number;
  types?: string[];
  cardIds?: number[];
  useAiContext?: boolean;
  isSrsOnly?: boolean;
};

export type QuizQuestionResponse = {
  index: number;
  cardId: number;
  word?: string;
  meaning?: string;
  questionText: string;
  questionType: string;
  choices: string[];
  correctIndex: number;
  correctAnswer?: string;
  explanation?: string;
  audioUrl?: string;
  engine?: string;
  matching?: AiMatchingPair[];
};

export type QuizGenerateResponse = {
  questions: QuizQuestionResponse[];
  totalQuestions: number;
  engine?: string;
};

export type AiQuizRequest = {
  deck_id?: number;
  allowed_deck_ids?: number[];
  question_count?: number;
  types?: string[];
  card_ids?: number[];
  use_ai_context?: boolean;
  is_srs_only?: boolean;
};

export type AiQuizResponse = {
  questions: AiQuizQuestion[];
  stats: AiQuizStats;
};

export type QuizSubmitRequest = {
  scope: "DECK" | "ALL" | "CUSTOM";
  totalQuestions: number;
  correctAnswers: number;
  score: number;
  accuracyRate: number;
  timeSpentSeconds: number;
};

export type QuizResultResponse = {
  id: number;
  scope: string;
  totalQuestions: number;
  correctAnswers: number;
  score: number;
  accuracyRate: number;
  timeSpentSeconds: number;
  xpEarned?: number;
  isPerfectScore?: boolean;
  createdAt: string;
};

export type QuizAnalyticsResponse = {
  totalQuizzesTaken: number;
  averageAccuracyRate: number;
  totalScoreEarned: number;
  totalTimeSpentSeconds: number;
  bestAccuracy: number;
  recentResults: QuizResultResponse[];
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

/* ---------------------------------------------------------------------------
   AI extraction.

   camelCase, unlike chat/quiz/search above. See the note at the top of the AI
   section: this is verified, not assumed.

   The spec marks every request field optional. That is wrong. Omitting
   `category` throws an unguarded NPE server side (HTTP 500, "Something went
   wrong: null") in under half a second, before any model call, and omitting
   `text` answers 500 'Cannot invoke "String.length()" because "text" is null'.
   Neither is a 400, so a caller cannot tell a validation mistake from a server
   fault. Guard both client side.
   ------------------------------------------------------------------------- */

/**
 * One card the extractor proposes. Same shape the card create endpoint takes,
 * which is the point: the reader reviews these and then saves them.
 *
 * Every field except word and meaning is spec-only. The live endpoint answered
 * 200 with an empty array on all 11 probes (plain prose, word lists, a single
 * word, several categories, with and without a real deck), so nothing below
 * has been seen populated. Treat a non-empty response as the first real
 * sighting and check it against this type before trusting it.
 */
export type CardCreationRequest = {
  word: string;
  meaning: string;
  phonetic?: string;
  partOfSpeech?: string;
  definitionEn?: string;
  exampleSentence?: string;
  exampleMeaning?: string;
  imageUrl?: string;
  audioUrl?: string;
  note?: string;
  position?: number;
};

export type TextExtractionRequest = {
  /** Required in practice. Empty string is accepted but burns a model call. */
  text: string;
  /** Required in practice, despite the spec. Omitting it is a server NPE. */
  category: string;
  /**
   * Accepted and then ignored. A nonexistent id, someone else's deck and no
   * id at all all answer 200 identically, so this does not scope or attach
   * anything today. Sent anyway, because the field is real and the behaviour
   * may be finished later.
   */
  deckId?: number;
};

export type UrlExtractionRequest = {
  url: string;
  category: string;
  deckId?: number;
};

/* ---------------------------------------------------------------------------
   Dictionary.

   GET /api/dictionary/lookup is a verbatim passthrough of the Free Dictionary
   API (Wiktionary data), so this is that project's shape, not one this backend
   designed. It can therefore drift without a backend deploy.

   Two things a caller has to know:

   - A MISS IS AN HTTP 500, not a 404 and not an empty array. An unknown word
     answers 500 with body {"status":431,"message":"Lỗi tra từ điển"} and no
     data key. Upstream downtime looks identical. isWordNotFound() in
     lib/api/dictionary.ts exists so this does not get reported to the reader
     as an outage every time they typo.
   - The payload carries a CC BY-SA licence block and sourceUrls. If entries
     are rendered, that attribution should be rendered with them.
   ------------------------------------------------------------------------- */

export type DictionaryLicense = {
  name: string;
  url: string;
};

export type DictionaryPhonetic = {
  /** Present on every sample, but frequently the empty string. */
  audio: string;
  /** The IPA. Missing on 4 of 44 sampled entries, so fall back across the list. */
  text?: string;
  sourceUrl?: string;
  license?: DictionaryLicense;
};

export type DictionaryDefinition = {
  definition: string;
  synonyms: string[];
  antonyms: string[];
  example?: string;
};

export type DictionaryMeaning = {
  partOfSpeech: string;
  definitions: DictionaryDefinition[];
  synonyms: string[];
  antonyms: string[];
};

/**
 * One etymology. A word can return several: "bank" answers four, "run" one,
 * so callers must handle N entries rather than reading data[0] and stopping.
 */
export type DictionaryEntry = {
  word: string;
  /** Top level IPA, absent on 4 of 19 sampled entries. Prefer phonetics[]. */
  phonetic?: string;
  phonetics: DictionaryPhonetic[];
  meanings: DictionaryMeaning[];
  license: DictionaryLicense;
  sourceUrls: string[];
};

/* ---------------------------------------------------------------------------
   Admin.

   Routes live at /admin/... with NO /api prefix, the opposite of the AI group.
   Verified: /api/admin/dashboard/stats answers "No static resource".

   THIS API DOES NOT RETURN 403. A caller without the role gets HTTP 500 with
   message "Something went wrong: Access Denied", and a route that does not
   exist gets HTTP 500 with message "No static resource ...". The status code
   cannot tell those apart; only the message can. isAccessDenied() in
   lib/api/admin.ts is the supported way to check.

   Validation runs before authorization, which is how the field names below
   were confirmed without ever holding an admin token.
   ------------------------------------------------------------------------- */

/**
 * Roles come back as plain strings here, unlike UserResponse.roles, which is
 * RoleResponse[] ({ name: string }). Both shapes are real and they describe
 * the same thing; do not feed one to code expecting the other.
 *
 * Verified live with an admin token: /admin/users really does answer
 * roles:["USER"] and roles:["ADMIN"], plain strings, while /auth/login answers
 * roles:[{"name":"ADMIN"}] for the same account. Both shapes are live at once.
 * The spec is right and the API is inconsistent with itself, so this is a real
 * hazard rather than a documentation slip.
 */
export type AdminUserResponse = {
  id: string;
  email: string;
  phone?: string;
  fullName?: string;
  avatar?: string;
  roles: string[];
  createTime?: string;
  updateTime?: string;
  banned?: boolean;
  bannedAt?: string | null;
  bannedUntil?: string | null;
  banReason?: string | null;
};

export type AdminBanUserRequest = {
  reason: string;
  banDurationDays?: number;
};

export type AdminUpdateUserRolesRequest = {
  /** camelCase confirmed: role_names is accepted and silently ignored. */
  roleNames: string[];
};

export type AdminDashboardStats = {
  totalUsers: number;
  totalDecks: number;
  totalCards: number;
  totalGameRecords: number;
  totalOfficialDecks: number;
  totalPublicDecks: number;
};

export type AdminGameRecord = {
  id: string;
  gameType: string;
  score: number;
  totalCards: number;
  correctCount: number;
  timeInSeconds: number;
  accuracyRate: number;
  /** A Long, not a UUID. Confirmed by the type-conversion 400. */
  deckId: number;
  deckTitle?: string;
  userEmail?: string;
  userFullName?: string;
  createdAt?: string;
};

/**
 * The read/write asymmetry on this flag is real and has bitten this project
 * before. Decks READ back as `official` (GET /decks/public never returns
 * isOfficial), but both admin write DTOs demand `isOfficial`. Confirmed live:
 * PATCH with {"official":true} answers 400 "isOfficial flag is required".
 */
export type AdminUpdateDeckOfficialRequest = {
  isOfficial: boolean;
};

/* ---------------------------------------------------------------------------
   AI generation, extraction results, roleplay.

   All camelCase, like the extraction group and unlike chat/quiz/search.

   Everything below came from live 200s with a real account. Where the hand
   written docs/ai-testing-guide.md disagrees with what the server does, the
   server won, and the disagreement is noted, because someone will read that
   guide and trust it.
   ------------------------------------------------------------------------- */

/**
 * What the extractors actually return.
 *
 * NOT CardCreationRequest, which is what the spec claims. Confirmed by
 * key-diff across /extract/text, /extract/url and /extract/file: all three
 * return this same eleven key shape.
 *
 * imageUrl and audioUrl are poison. The model fabricates them, and live
 * responses carried values like https://example.com/images/engineer.jpg that
 * do not resolve. Never render them; drop them, or replace them with a real
 * upload before saving.
 */
export type ExtractedCard = {
  word: string;
  phonetic: string;
  partOfSpeech: string;
  meaning: string;
  definitionEn: string;
  exampleSentence: string;
  exampleMeaning: string;
  imageUrl: string;
  audioUrl: string;
  note: string;
  position: number;
};

/**
 * Magic sort: hand it loose words, get a suggested deck for each.
 *
 * The spec and the guide disagree here and both are wrong about something. The
 * guide says cardIds and deckIds of numbers; the server takes words as strings
 * plus an optional map of deck id to deck name. Proven by wrong-type probe.
 */
export type MagicSortRequest = {
  words: string[];
  /** Deck id as a string key, mapped to the deck's name. Optional. */
  decks?: Record<string, string>;
};

export type MagicSortResult = {
  word: string;
  targetDeckId: number | null;
  suggestedDeckName: string | null;
};

/**
 * One click deck generator.
 *
 * cardCount is REQUIRED despite both the spec and the guide calling it
 * optional with a default of 15. It is a Java primitive int, so omitting it
 * answers 400 every time. The effective ceiling is 30: cardCount 31 already
 * fails, so clamp before sending.
 *
 * THIS ENDPOINT PERSISTS NOTHING. Its message reads "Tạo bộ thẻ thành công"
 * and its body status is 201, but no deck id and no card ids come back, and no
 * deck exists afterwards. It is a preview generator; saving is a separate
 * POST /decks followed by one card create per row.
 */
export type AiAutoDeckRequest = {
  topic: string;
  cardCount: number;
  sourceLanguage?: string;
  targetLanguage?: string;
};

export type AiAutoDeckResponse = {
  title: string;
  description: string;
  /** Echoed back only when sent. Null when omitted, so send them. */
  sourceLanguage: string | null;
  targetLanguage: string | null;
  cards: ExtractedCard[];
};

/**
 * Story generator: weave a set of words into a short text.
 *
 * Takes either literal words or cardIds, which it resolves to those cards'
 * words server side.
 *
 * contextType is a free-form string on the wire, no enum constraint in the
 * schema. The spec lists BUSINESS_EMAIL, DAILY_STORY and NEWS_ARTICLE; the
 * guide lists BUSINESS_EMAIL, DAILY_NEWS and CASUAL_CHAT, so the union is
 * what the client offers.
 */
export type StoryContextType =
  | "BUSINESS_EMAIL"
  | "DAILY_STORY"
  | "DAILY_NEWS"
  | "NEWS_ARTICLE"
  | "CASUAL_CHAT";

export type AiStoryRequest = {
  words?: string[];
  cardIds?: number[];
  contextType?: StoryContextType;
};

export type AiStoryResponse = {
  title: string;
  /** Carries literal newlines. Render with whitespace preserved. */
  storyText: string;
  translationText: string;
  targetWords: string[];
};

export type SituationalSentence = {
  english: string;
  vietnamese: string;
};

/**
 * Situational learning.
 *
 * cefrLevel is REQUIRED, and the guide's field table omits it entirely.
 *
 * The guide also documents a completely different response
 * (scenarioDescription, dialogue, vocabulary, quizOptions). Those fields do
 * not exist. In particular there is NO quiz here, so do not build one.
 *
 * A 200 whose every array is empty means the generation failed. The envelope
 * still says success, so emptiness is the only signal there is.
 */
export type SituationalLearningRequest = {
  context: string;
  cefrLevel: string;
  location?: string;
  currentTime?: string;
};

export type SituationalLearningResponse = {
  mainActions: SituationalSentence[];
  interactions: SituationalSentence[];
  emotions: SituationalSentence[];
  shortCaptions: SituationalSentence[];
  vocabularies: ExtractedCard[];
};

/**
 * Roleplay tutor, the only stateful AI surface here.
 *
 * conversationId is truncated to 36 characters server side, silently, so two
 * ids sharing a 36 character prefix collide into one conversation. This client
 * truncates first, so the id it holds is the id the server holds.
 *
 * History is NOT user scoped: any authenticated caller who knows an id can
 * read it. Never put anything private behind a guessable conversation id.
 */
export type AiRoleplayRequest = {
  userMessage: string;
  scenario?: string;
  targetWords?: string[];
  conversationId?: string;
};

export type AiRoleplayResponse = {
  tutorReply: string;
  /** Zero to one hundred. */
  score: number;
  wordsUsed: string[];
  /** Vietnamese coaching notes. */
  suggestions: string[];
};

export type AiRoleplayTurn = {
  role: "USER" | "ASSISTANT";
  content: string;
  /**
   * A zoneless LocalDateTime such as "2026-08-28T12:04:08.874292". Passing it
   * straight to new Date() reads it as browser local time and drifts.
   */
  createdAt: string;
};

export type AiRoleplayHistoryResponse = AiRoleplayTurn;

export type AiRoleplaySessionResponse = {
  id: string;
  title: string;
  scenario?: string;
  targetWords?: string[];
  createdAt: string;
  updatedAt: string;
};

export type CreateAiRoleplaySessionRequest = {
  title?: string;
  scenario?: string;
  targetWords?: string[];
};


/* ---------------------------------------------------------------------------
   Notifications
   ------------------------------------------------------------------------- */

export type NotificationType =
  | "SYSTEM"
  | "DECK_SHARED"
  | "STREAK_REMINDER"
  | "QUIZ_REMINDER";

/**
 * `read` is ALWAYS false in every response from every endpoint in this group,
 * even immediately after marking a row read, and even though the change does
 * persist. A per row read indicator therefore cannot be built truthfully yet.
 * The unread count endpoint is accurate; trust that instead.
 */
export type NotificationResponse = {
  id: number;
  title: string;
  content: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
};

export type NotificationCreateRequest = {
  recipientId: string;
  title: string;
  content: string;
  type: NotificationType;
};

/* ---------------------------------------------------------------------------
   Stars, mastery, cram
   ------------------------------------------------------------------------- */

/** The `is` prefix survives here, unlike DeckResponse.official. Verified live. */
export type CardStarToggleResponse = {
  cardId: number;
  isStarred: boolean;
};

/**
 * newCardsCount is null unless deckId is supplied. Every sibling field answers
 * 0 in that case, so this one field really is null rather than zero.
 */
export type SrsMasteryResponse = {
  totalLearnedCards: number;
  newCardsCount: number | null;
  masteredCards: number;
  learningCards: number;
  reviewCards: number;
  lapsedCards: number;
};

export type CramCard = {
  card: CardResponse;
  srsStatus: string;
};

export type CramCardsResponse = {
  deckId: number;
  deckTitle: string;
  totalCards: number;
  cards: CramCard[];
};

/* ---------------------------------------------------------------------------
   Tags
   ------------------------------------------------------------------------- */

export type TagRequest = {
  name: string;
};

/* ---------------------------------------------------------------------------
   Community Posts (Admin moderation)
   ------------------------------------------------------------------------- */

export type PostModerationStatus = "PENDING" | "APPROVED" | "REJECTED";

export type CommunityPostResponse = {
  id: number;
  profileId: string;
  profileName: string;
  profileAvatar: string | null;
  title: string;
  content: string;
  status: PostModerationStatus;
  rejectionReason: string | null;
  approvedAt: string | null;
  likeCount: number;
  commentCount: number;
  likedByCurrentUser: boolean;
  deckId: number | null;
  deckTitle: string | null;
  deckDescription: string | null;
  deckCoverImageUrl: string | null;
  deckTotalCards: number | null;
  /** Live server sends null, not [], when the post has no tag. */
  tags: TagResponse[] | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PostModerateRequest = {
  /** APPROVED or REJECTED (sending PENDING has no effect in practice) */
  status: PostModerationStatus;
  /** Required when status is REJECTED, ignored when APPROVED */
  reason?: string;
};

/* ---------------------------------------------------------------------------
   Community Posts (member side)
   ------------------------------------------------------------------------- */

export type CommunityPostListBy = "latest" | "popular" | "search" | "my-posts";

export type CommunityPostWriteRequest = {
  title: string;
  content: string;
  deckId?: number | null;
  tagIds?: number[];
};

export type CommentResponse = {
  id: number;
  communityPostId: number;
  profileId: string;
  profileName: string;
  profileAvatar: string | null;
  parentCommentId: number | null;
  content: string;
  replyCount: number;
  /** Live server sends null, not [], when there are no replies. */
  replies: CommentResponse[] | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CommentCreateRequest = {
  content: string;
  parentCommentId?: number | null;
};

/** Returned by POST /community-posts/{id}/like, a toggle. */
export type PostLikeToggleResponse = {
  postId: number;
  liked: boolean;
  likeCount: number;
};

/* ---------------------------------------------------------------------------
   Vocab Lookup (fsoft-ai trial integration)
   ------------------------------------------------------------------------- */

export type VocabLookupRequest = {
  word: string;
  context?: string;
  allowed_deck_ids?: number[];
};

export type CardSuggestionResponse = {
  query: string;
  termSuggestions: string[];
  definitionSuggestions: string[];
  autoFillCard?: {
    word?: string;
    meaning?: string;
    phonetic?: string;
    partOfSpeech?: string;
    definitionEn?: string;
    exampleSentence?: string;
    exampleMeaning?: string;
  } | null;
};


export type VocabCandidate = {
  word: string;
  phonetic?: string | null;
  part_of_speech?: string | null;
  meaning: string;
  definition_en?: string | null;
  example_sentence: string;
  example_meaning?: string | null;
  already_in_deck: boolean;
  existing_card_id?: number | null;
};

export type VocabLookupStats = {
  source: "YOUR_DECK" | "CACHE" | "AI" | string;
  word_chars: number;
  context_chars: number;
  llm_calls: number;
  cache_size: number;
  prompt_tokens: number;
  completion_tokens: number;
  latency_ms: number;
};

export type VocabLookupResponse = {
  source: string;
  found: boolean;
  suggestion?: string | null;
  card?: VocabCandidate | null;
  stats?: VocabLookupStats | null;
};

/* ---------------------------------------------------------------------------
   Admin AI assistant (admin/ai/*)
   ------------------------------------------------------------------------- */

export type AdminAiChatRequest = {
  message: string;
  /** Thread id from the first reply; omit on the first message. */
  conversationId?: string;
};

/**
 * A dangerous action the bot drafted but did NOT run. The admin must confirm
 * it through /admin/ai/chat/confirm, or cancel it. It expires after 5 minutes.
 */
export type AdminAiPendingAction = {
  actionId: string;
  tool: string;
  summary: string;
  expiresAt: string;
};

export type AdminAiChatResponse = {
  conversationId: string;
  reply: string;
  pendingAction: AdminAiPendingAction | null;
  /**
   * Execution result after /confirm runs (live-verified 2026-09-08: the
   * confirm answer carries the underlying service result here).
   */
  result: string;
};

export type AdminAiChatHistoryMessage = {
  role: "user" | "assistant" | "system" | string;
  content: string;
};

export type AdminAiAuditLogStatus = "EXECUTED" | "CANCELLED" | "FAILED";

export type AdminAiAuditLog = {
  id: number;
  action: string;
  /** Free-form string; usually JSON of the parameters the action ran with. */
  params: string;
  status: AdminAiAuditLogStatus | string;
  resultSummary: string;
  referenceId: string;
  createdAt: string;
};
