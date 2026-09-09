import { apiFetch } from "@/lib/api/client";

/*
  The student-facing AI tutor: natural-language chat that can call tools to
  create decks, add vocabulary and inspect the caller's decks. The server
  owns the conversation per profile, so no conversationId is sent.

  This controller rides the /api prefix and answers snake_case payloads like
  the other AI routes; see the note in lib/api/ai.ts.
*/

export type UserAiChatResponse = {
  conversationId: string;
  reply: string;
  toolsCalled: string[] | null;
};

/** One turn of the tutor conversation. */
export function aiUserChat(message: string, signal?: AbortSignal) {
  if (!message.trim()) {
    throw new Error("Câu hỏi trống.");
  }
  return apiFetch<UserAiChatResponse>("/api/user/ai/chat", {
    method: "POST",
    body: { message: message.trim() },
    auth: true,
    signal,
  });
}

export type UserAiChatHistoryItem = {
  role: string;
  content: string;
};

/** The signed-in student's conversation, in server order. */
export function getUserAiChatHistory(signal?: AbortSignal) {
  return apiFetch<UserAiChatHistoryItem[]>("/api/user/ai/chat/history", {
    auth: true,
    signal,
  });
}

/** Wipes the tutor conversation for the signed-in student. */
export function resetUserAiChatHistory() {
  return apiFetch<void>("/api/user/ai/chat/history", {
    method: "DELETE",
    auth: true,
  });
}