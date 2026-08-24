"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChatCircleDots } from "@phosphor-icons/react/dist/ssr/ChatCircleDots";
import { X } from "@phosphor-icons/react/dist/ssr/X";
import { PaperPlaneRight } from "@phosphor-icons/react/dist/ssr/PaperPlaneRight";
import { Users } from "@phosphor-icons/react/dist/ssr/Users";
import { Lock } from "@phosphor-icons/react/dist/ssr/Lock";
import { ArrowClockwise } from "@phosphor-icons/react/dist/ssr/ArrowClockwise";
import { Client } from "@stomp/stompjs";

import { useSession } from "@/lib/auth/use-session";
import { getSession } from "@/lib/auth/session-store";
import { API_BASE_URL } from "@/lib/api/client";
import {
  type ChatMessageResponse,
  fetchMessageHistory,
  fetchOnlineCount,
  sendChatMessage,
} from "@/lib/api/chat";
import { EASE_OUT } from "@/lib/motion";
import Link from "next/link";

function formatTime(dateStr: string) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function CommunityChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessageResponse[]>([]);
  const [inputText, setInputText] = useState("");
  const [onlineCount, setOnlineCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const session = useSession();
  const currentUserId = session?.user?.id ? String(session.user.id) : null;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const stompClientRef = useRef<Client | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  /* --- Fetch History & Online Count --- */
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [historyData, onlineData] = await Promise.allSettled([
        fetchMessageHistory(1, 40),
        fetchOnlineCount(),
      ]);

      if (historyData.status === "fulfilled" && historyData.value?.content) {
        // Reverse array if server returns newest first
        const list = [...historyData.value.content].reverse();
        setMessages(list);
      }
      if (onlineData.status === "fulfilled" && onlineData.value?.onlineUsers !== undefined) {
        setOnlineCount(onlineData.value.onlineUsers);
      }
    } catch {
      setError("Không thể tải lịch sử chat");
    } finally {
      setLoading(false);
      setTimeout(scrollToBottom, 100);
    }
  }, []);

  /* --- Setup WebSocket STOMP --- */
  useEffect(() => {
    if (!isOpen) return;

    loadInitialData();

    // Polling fallback every 6 seconds to keep messages & online count up to date
    const interval = setInterval(async () => {
      try {
        const [historyRes, onlineRes] = await Promise.allSettled([
          fetchMessageHistory(1, 20),
          fetchOnlineCount(),
        ]);
        if (historyRes.status === "fulfilled" && historyRes.value?.content) {
          const fetched = [...historyRes.value.content].reverse();
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const newItems = fetched.filter((m) => !existingIds.has(m.id));
            if (newItems.length > 0) {
              setTimeout(scrollToBottom, 100);
              return [...prev, ...newItems];
            }
            return prev;
          });
        }
        if (onlineRes.status === "fulfilled" && onlineRes.value?.onlineUsers !== undefined) {
          setOnlineCount(onlineRes.value.onlineUsers);
        }
      } catch {
        // Silent polling error
      }
    }, 6000);

    // Setup WebSocket STOMP client
    try {
      const token = getSession()?.token.accessToken;
      const wsUrl = API_BASE_URL.replace(/^http/, "ws") + "/ws-chat";

      const client = new Client({
        brokerURL: wsUrl,
        connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
        onConnect: () => {
          client.subscribe("/topic/community", (msg) => {
            try {
              const newMsg: ChatMessageResponse = JSON.parse(msg.body);
              setMessages((prev) => {
                if (prev.some((m) => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
              });
              setTimeout(scrollToBottom, 100);
            } catch {
              // Ignore parse error
            }
          });
        },
      });

      client.activate();
      stompClientRef.current = client;
    } catch {
      // WebSocket fail gracefully, fallback polling is active
    }

    return () => {
      clearInterval(interval);
      if (stompClientRef.current) {
        stompClientRef.current.deactivate();
        stompClientRef.current = null;
      }
    };
  }, [isOpen, loadInitialData]);

  /* --- Gửi tin nhắn Optimistic (hiển thị ngay lập tức) --- */
  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    const content = inputText.trim();
    setInputText("");
    setError(null);

    // 1. Tạo tin nhắn tạm thời (optimistic message)
    const tempId = "temp-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6);
    const optimisticMsg: ChatMessageResponse = {
      id: tempId,
      senderId: currentUserId || "me",
      senderName: session?.user?.fullName || "Bạn",
      senderAvatar: session?.user?.avatar || null,
      content: content,
      createdAt: new Date().toISOString(),
    };

    // 2. Đẩy ngay vào danh sách tin nhắn để hiển thị tức thì (0ms lag)
    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(scrollToBottom, 50);

    // 3. Gửi API chạy ngầm ở background
    try {
      const created = await sendChatMessage({ content });
      setMessages((prev) => {
        // Thay thế tin nhắn tạm bằng tin nhắn chính thức từ server
        const hasRealAlready = prev.some((m) => m.id === created.id);
        if (hasRealAlready) {
          return prev.filter((m) => m.id !== tempId);
        }
        return prev.map((m) => (m.id === tempId ? created : m));
      });
    } catch (err: unknown) {
      // Nếu gửi lỗi, xóa tin nhắn tạm và hiển thị banner thông báo
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      const msg = err instanceof Error ? err.message : "Gửi tin nhắn thất bại";
      setError(msg);
    }
  };

  return (
    <>
      {/* Floating Chat Button */}
      <motion.button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        aria-label="Mở chat cộng đồng"
        className="fixed bottom-6 right-6 z-50 flex size-14 items-center justify-center rounded-full bg-accent text-accent-fg shadow-card transition-colors hover:bg-accent-hover focus:outline-none"
      >
        <AnimatePresence mode="wait" initial={false}>
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X size={26} weight="bold" />
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="relative flex items-center justify-center"
            >
              <ChatCircleDots size={28} weight="fill" />
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Community Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
            className="fixed bottom-24 right-6 z-50 flex h-[480px] w-[380px] max-w-[calc(100vw-2rem)] flex-col rounded-3xl border border-line bg-paper/95 shadow-card backdrop-blur-xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-line px-4 py-3 bg-surface/80">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-full bg-accent/15 text-accent">
                  <ChatCircleDots size={22} weight="fill" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-ink tracking-tight">
                    Chat Cộng Đồng
                  </h3>
                  <div className="flex items-center gap-1.5 text-[0.7rem] text-muted">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">
                      {onlineCount > 0 ? `${onlineCount} người online` : "Đã kết nối"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={loadInitialData}
                  className="flex size-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink"
                  title="Tải lại"
                >
                  <ArrowClockwise size={16} className={loading ? "animate-spin" : ""} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex size-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Message List Body */}
            <div className="flex flex-1 flex-col overflow-y-auto p-4 space-y-3 bg-surface/30">
              {loading && messages.length === 0 ? (
                <div className="flex flex-1 items-center justify-center text-xs text-muted">
                  <span className="animate-pulse">Đang tải tin nhắn...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center text-center text-muted p-4">
                  <Users size={32} className="opacity-40 mb-2" />
                  <p className="text-xs font-medium">Chưa có tin nhắn nào trong phòng chat.</p>
                  <p className="text-[0.7rem] opacity-75 mt-0.5">Hãy là người đầu tiên trò chuyện!</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = currentUserId && String(msg.senderId) === currentUserId;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 px-1">
                        <span className="text-[0.68rem] font-semibold text-muted">
                          {isMe ? "Bạn" : msg.senderName || "Thành viên"}
                        </span>
                        <span className="text-[0.62rem] text-muted opacity-70">
                          {formatTime(msg.createdAt)}
                        </span>
                      </div>
                      <div
                        className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed break-words shadow-2xs ${isMe
                            ? "bg-accent text-accent-fg rounded-tr-xs"
                            : "bg-surface border border-line text-ink rounded-tl-xs"
                          }`}
                      >
                        {msg.replyTo && (
                          <div className="mb-1.5 rounded-lg border-l-2 border-accent-hover bg-black/10 dark:bg-white/10 p-1.5 text-[0.65rem] opacity-85">
                            <span className="font-semibold">{msg.replyTo.senderName}: </span>
                            <span>{msg.replyTo.content}</span>
                          </div>
                        )}
                        {msg.content}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Error Banner */}
            {error && (
              <div className="bg-danger/10 text-danger text-[0.7rem] px-3 py-1 text-center font-medium border-t border-danger/20">
                {error}
              </div>
            )}

            {/* Footer Input Form */}
            <div className="border-t border-line p-3 bg-surface/90">
              {!session?.user ? (
                <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-surface-2 text-xs text-muted">
                  <span className="flex items-center gap-1.5">
                    <Lock size={14} /> Đăng nhập để nhắn tin
                  </span>
                  <Link
                    href="/login"
                    className="font-semibold text-accent hover:underline text-xs"
                  >
                    Đăng nhập
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSend} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Nhập tin nhắn..."
                    className="flex-1 rounded-full border border-line bg-surface px-4 py-2 text-xs text-ink placeholder:text-muted focus:border-accent focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!inputText.trim()}
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg shadow-sm transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
                  >
                    <PaperPlaneRight size={16} weight="fill" />
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
