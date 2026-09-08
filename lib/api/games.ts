import { apiFetch } from "@/lib/api/client";

/* ---------------------------------------------------------------------------
   Audio Reflex Game — /games/audio-reflex
   ------------------------------------------------------------------------- */

export interface AudioOptionItem {
  optionId: number;
  text: string; // Nghĩa tiếng Việt
}

export interface AudioQuestionItem {
  cardId: number;
  word: string;
  phonetic: string | null;
  imageUrl: string | null;
  exampleSentence: string | null;
  exampleMeaning: string | null;
  correctOptionId: number;
  options: AudioOptionItem[];
}

export interface AudioReflexGameResponse {
  deckId: number;
  deckTitle: string;
  totalQuestions: number;
  questions: AudioQuestionItem[];
}

export interface AudioReflexSubmitRequest {
  deckId: number;
  score: number;
  maxCombo?: number;
  correctAnswers?: number;
  totalQuestions?: number;
  completionTime?: number;
}

export interface AudioReflexLeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  userAvatar: string | null;
  score: number;
  maxCombo: number | null;
  accuracy: number;
  playedAt: string;
}

/** Tạo bộ câu hỏi game cho một bộ thẻ */
export function startAudioReflexGame(deckId: number, questionCount = 10) {
  return apiFetch<AudioReflexGameResponse>(
    `/games/audio-reflex/play/${deckId}?questionCount=${questionCount}`,
    { auth: true },
  );
}

/** Nộp kết quả sau khi chơi xong */
export function submitAudioReflexResult(request: AudioReflexSubmitRequest) {
  return apiFetch<AudioReflexLeaderboardEntry>("/games/audio-reflex/submit", {
    method: "POST",
    body: request,
    auth: true,
  });
}

/** Lấy bảng xếp hạng của một bộ thẻ */
export function getAudioReflexLeaderboard(deckId: number, limit = 10) {
  return apiFetch<AudioReflexLeaderboardEntry[]>(
    `/games/audio-reflex/leaderboard/${deckId}?limit=${limit}`,
    { auth: true },
  );
}

/* ---------------------------------------------------------------------------
   Multiplayer Audio Reflex Room APIs
   ------------------------------------------------------------------------- */

export interface MultiPlayerState {
  userId: string;
  displayName: string;
  avatar: string | null;
  host: boolean;
  score: number;
  correctCount: number;
  lastAnswerAt?: number;
  selectedDeckId?: number | null;
  selectedDeckTitle?: string | null;
  selectedDeckCardCount?: number;
  connected: boolean;
}

export interface AudioReflexRoomState {
  roomCode: string;
  deckId: number;
  hostUserId: string;
  status: "WAITING" | "PLAYING" | "FINISHED";
  questionCount: number;
  questions: AudioQuestionItem[];
  currentQuestionIndex: number;
  startedAt: number;
  currentQuestionStartedAt: number;
  players: Record<string, MultiPlayerState>;
  answeredThisQuestion: string[];
}

export function createAudioReflexRoom(deckId: number, questionCount = 10) {
  return apiFetch<AudioReflexRoomState>(
    `/games/audio-reflex/rooms?deckId=${deckId}&questionCount=${questionCount}`,
    { method: "POST", auth: true },
  );
}

export function joinAudioReflexRoom(roomCode: string) {
  return apiFetch<AudioReflexRoomState>(
    `/games/audio-reflex/rooms/${roomCode}/join`,
    { method: "POST", auth: true },
  );
}

export function startAudioReflexRoomGame(roomCode: string, questionCount?: number) {
  const query = questionCount ? `?questionCount=${questionCount}` : "";
  return apiFetch<AudioReflexRoomState>(
    `/games/audio-reflex/rooms/${roomCode}/start${query}`,
    { method: "POST", auth: true },
  );
}

export function getAudioReflexRoom(roomCode: string) {
  return apiFetch<AudioReflexRoomState>(
    `/games/audio-reflex/rooms/${roomCode}`,
    { method: "GET", auth: true },
  );
}

export function leaveAudioReflexRoom(roomCode: string) {
  return apiFetch<void>(
    `/games/audio-reflex/rooms/${roomCode}/leave`,
    { method: "DELETE", auth: true },
  );
}

export function selectPlayerDeckInRoom(roomCode: string, selectedDeckId?: number | null) {
  const query = selectedDeckId ? `?selectedDeckId=${selectedDeckId}` : "";
  return apiFetch<AudioReflexRoomState>(
    `/games/audio-reflex/rooms/${roomCode}/select-deck${query}`,
    { method: "PUT", auth: true },
  );
}

export function submitAudioReflexRoomAnswer(roomCode: string, cardId: number) {
  return apiFetch<AudioReflexRoomState>(
    `/games/audio-reflex/rooms/${roomCode}/answer`,
    {
      method: "POST",
      auth: true,
      body: JSON.stringify({ cardId }),
    },
  );
}

/* ---------------------------------------------------------------------------
   Multiplayer Space Striker Room APIs — /games/space-striker/rooms
   Tái dùng AudioQuestionItem/AudioOptionItem ở trên (backend dùng chung
   AudioReflexGameResponse.AudioQuestionItem cho cả 2 game).
   ------------------------------------------------------------------------- */

export interface SpaceStrikerPlayerState {
  userId: string;
  displayName: string;
  avatar: string | null;
  host: boolean;
  score: number;
  correctCount: number;
  lastAnswerAt?: number;
  selectedDeckId?: number | null;
  selectedDeckTitle?: string | null;
  selectedDeckCardCount?: number;
  connected: boolean;
  /** Mặc định 3, 0 = đã bị loại, không bắn được nữa. */
  lives: number;
}

export interface SpaceStrikerRoomState {
  roomCode: string;
  deckId: number;
  hostUserId: string;
  status: "WAITING" | "PLAYING" | "FINISHED";
  questionCount: number;
  questions: AudioQuestionItem[];
  currentQuestionIndex: number;
  startedAt: number;
  currentQuestionStartedAt: number;
  players: Record<string, SpaceStrikerPlayerState>;
  /** true khi câu hiện tại đã có người bắn trúng đầu tiên, đang chờ chuyển câu. */
  questionResolved: boolean;
}

/** Sự kiện đầy đủ mà server phát qua /topic/space-room/{code}. */
export type SpaceStrikerEventType =
  | "PLAYER_JOINED"
  | "PLAYER_LEFT"
  | "PLAYER_DISCONNECTED"
  | "PLAYER_RECONNECTED"
  | "PLAYER_DECK_SELECTED"
  | "ROOM_STARTED"
  | "PLAYER_MISSED"
  | "PLAYER_ELIMINATED"
  | "NEXT_QUESTION"
  | "QUESTION_TIMEOUT_NEXT"
  | "ROOM_FINISHED";

export interface SpaceStrikerSocketPayload {
  type: SpaceStrikerEventType;
  timeLimitSeconds: number;
  room: SpaceStrikerRoomState;
}

export function createSpaceStrikerRoom(deckId: number, questionCount = 10) {
  return apiFetch<SpaceStrikerRoomState>(
    `/games/space-striker/rooms?deckId=${deckId}&questionCount=${questionCount}`,
    { method: "POST", auth: true },
  );
}

export function joinSpaceStrikerRoom(roomCode: string) {
  return apiFetch<SpaceStrikerRoomState>(
    `/games/space-striker/rooms/${roomCode}/join`,
    { method: "POST", auth: true },
  );
}

export function startSpaceStrikerRoomGame(roomCode: string, questionCount?: number) {
  const query = questionCount ? `?questionCount=${questionCount}` : "";
  return apiFetch<SpaceStrikerRoomState>(
    `/games/space-striker/rooms/${roomCode}/start${query}`,
    { method: "POST", auth: true },
  );
}

export function getSpaceStrikerRoom(roomCode: string) {
  return apiFetch<SpaceStrikerRoomState>(
    `/games/space-striker/rooms/${roomCode}`,
    { method: "GET", auth: true },
  );
}

export function leaveSpaceStrikerRoom(roomCode: string) {
  return apiFetch<void>(
    `/games/space-striker/rooms/${roomCode}/leave`,
    { method: "DELETE", auth: true },
  );
}

export function selectPlayerDeckInSpaceStrikerRoom(
  roomCode: string,
  selectedDeckId?: number | null,
) {
  const query = selectedDeckId ? `?selectedDeckId=${selectedDeckId}` : "";
  return apiFetch<SpaceStrikerRoomState>(
    `/games/space-striker/rooms/${roomCode}/select-deck${query}`,
    { method: "PUT", auth: true },
  );
}

/** apiFetch tự JSON.stringify body — truyền object thuần, không tự stringify lần nữa. */
export function submitSpaceStrikerRoomAnswer(roomCode: string, cardId: number) {
  return apiFetch<SpaceStrikerRoomState>(
    `/games/space-striker/rooms/${roomCode}/answer`,
    {
      method: "POST",
      auth: true,
      body: { cardId },
    },
  );
}