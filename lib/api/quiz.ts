import { apiFetch } from "@/lib/api/client";
import type {
  QuizGenerateRequest,
  QuizGenerateResponse,
  QuizResultResponse,
  QuizSubmitRequest,
} from "@/lib/api/types";

/**
 * Khởi tạo bài Quiz nội bộ (DB Fast Generator)
 */
export function generateLocalQuiz(body: QuizGenerateRequest, signal?: AbortSignal) {
  return apiFetch<QuizGenerateResponse>("/api/v1/quiz/generate-local", {
    method: "POST",
    body,
    auth: true,
    signal,
  });
}

/**
 * Nộp bài thi Quiz & Lưu kết quả
 */
export function submitQuiz(body: QuizSubmitRequest, signal?: AbortSignal) {
  return apiFetch<QuizResultResponse>("/api/v1/quiz/submit", {
    method: "POST",
    body,
    auth: true,
    signal,
  });
}

/**
 * Lấy lịch sử bài thi Quiz của tôi
 */
export function getQuizHistory(signal?: AbortSignal) {
  return apiFetch<QuizResultResponse[]>("/api/v1/quiz/history", {
    method: "GET",
    auth: true,
    signal,
  });
}

/**
 * Xem chi tiết 1 bài thi Quiz theo ID
 */
export function getQuizResult(id: number, signal?: AbortSignal) {
  return apiFetch<QuizResultResponse>(`/api/v1/quiz/result/${id}`, {
    method: "GET",
    auth: true,
    signal,
  });
}

/**
 * Báo cáo thống kê phong độ thi Quiz của tôi
 */
export function getQuizAnalytics(signal?: AbortSignal) {
  return apiFetch<import("@/lib/api/types").QuizAnalyticsResponse>("/api/v1/quiz/analytics", {
    method: "GET",
    auth: true,
    signal,
  });
}
