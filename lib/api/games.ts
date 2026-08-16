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
