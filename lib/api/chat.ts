import { apiFetch } from "@/lib/api/client";

export interface ReplyMessageResponse {
  id: string;
  senderName: string;
  content: string;
}

export interface ChatMessageResponse {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string | null;
  content: string;
  replyTo?: ReplyMessageResponse | null;
  createdAt: string;
}

export interface ChatMessageRequest {
  content: string;
  replyToId?: string | null;
}

export interface PageResponse<T> {
  content: T[];
  pageNo: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

/** Lấy lịch sử tin nhắn cộng đồng phân trang (1-based) */
export async function fetchMessageHistory(page = 1, size = 20) {
  return apiFetch<PageResponse<ChatMessageResponse>>(
    `/chat/messages?page=${page}&size=${size}`,
    { auth: true },
  );
}

/** Gửi tin nhắn cộng đồng qua REST API */
export async function sendChatMessage(request: ChatMessageRequest) {
  return apiFetch<ChatMessageResponse>("/chat/messages", {
    method: "POST",
    body: request,
    auth: true,
  });
}

/** Lấy số lượng người dùng đang online */
export async function fetchOnlineCount() {
  return apiFetch<{ onlineUsers: number }>("/chat/online-count", {
    auth: true,
  });
}
