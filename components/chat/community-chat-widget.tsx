"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Client } from "@stomp/stompjs";

import { ChatCircleDots } from "@phosphor-icons/react/dist/ssr/ChatCircleDots";
import { X } from "@phosphor-icons/react/dist/ssr/X";
import { PaperPlaneRight } from "@phosphor-icons/react/dist/ssr/PaperPlaneRight";
import { ArrowUUpLeft } from "@phosphor-icons/react/dist/ssr/ArrowUUpLeft";
import { Users } from "@phosphor-icons/react/dist/ssr/Users";
import { Circle } from "@phosphor-icons/react/dist/ssr/Circle";

import {
  ChatMessageResponse,
  fetchMessageHistory,
  fetchOnlineCount,
  sendChatMessage,
} from "@/lib/api/chat";
import { API_BASE_URL } from "@/lib/api/client";
import { useSession } from "@/lib/auth/use-session";
import { EASE_OUT } from "@/lib/motion";

export function CommunityChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessageResponse[]>([]);
  const [inputContent, setInputContent] = useState("");
  const [onlineCount, setOnlineCount] = useState<number>(0);
  const [replyingTo, setReplyingTo] = useState<ChatMessageResponse | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const session = useSession();
  const stompClientRef = useRef<Client | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Cuộn xuống tin nhắn mới nhất
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Lấy danh sách tin nhắn ban đầu và số người online
  useEffect(() => {
    if (!session) return;
    async function initData() {
      setIsLoadingHistory(true);
      try {
        const [historyRes, onlineRes] = await Promise.allSettled([
          fetchMessageHistory(1, 30),
          fetchOnlineCount(),
        ]);

        if (historyRes.status === "fulfilled" && historyRes.value?.content) {
          // Server trả về mảng sắp xếp giảm dần theo thời gian, đảo ngược lại để hiển thị từ cũ -> mới
          setMessages([...historyRes.value.content].reverse());
        }

        if (onlineRes.status === "fulfilled" && onlineRes.value) {
          setOnlineCount(onlineRes.value.onlineUsers || 0);
        }
      } catch (err) {
        console.error("Lỗi khởi tạo chat:", err);
      } finally {
        setIsLoadingHistory(false);
      }
    }

    initData();
  }, [session]);

  // Thiết lập kết nối WebSocket STOMP
  useEffect(() => {
    if (!session) return;
    // Chuyển đổi http/https URL thành ws/wss URL chuẩn bao gồm context path
    const wsBase = API_BASE_URL.replace(/^http/, "ws").replace(/\/$/, "");
    const wsUrl = `${wsBase}/ws-chat/websocket`;

    const token = session.token.accessToken;
    const client = new Client({
      brokerURL: wsUrl,
      connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: () => {
        setIsConnected(true);
        // Subscribe topic tin nhắn cộng đồng
        client.subscribe("/topic/community", (message) => {
          try {
            const newMsg: ChatMessageResponse = JSON.parse(message.body);
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;

              // Tìm tin nhắn tạm thời (Optimistic message) trùng người gửi & nội dung để thay thế bằng tin nhắn thật từ server
              const tempIndex = prev.findIndex(
                (m) =>
                  m.id.startsWith("temp-") &&
                  m.senderId === newMsg.senderId &&
                  m.content === newMsg.content
              );

              if (tempIndex !== -1) {
                const updated = [...prev];
                updated[tempIndex] = newMsg;
                return updated;
              }

              return [...prev, newMsg];
            });
          } catch (e) {
            console.error("Lỗi parse message WebSocket:", e);
          }
        });

        // Subscribe topic đếm online
        client.subscribe("/topic/online-count", (message) => {
          try {
            const data = JSON.parse(message.body);
            if (typeof data.onlineUsers === "number") {
              setOnlineCount(data.onlineUsers);
            }
          } catch (e) {
            console.error("Lỗi parse online count WebSocket:", e);
          }
        });
      },
      onDisconnect: () => {
        setIsConnected(false);
      },
      onStompError: (frame) => {
        console.error("Lỗi STOMP WebSocket:", frame.headers["message"]);
      },
    });

    client.activate();
    stompClientRef.current = client;

    return () => {
      client.deactivate();
    };
  }, [session]);

  // Gửi tin nhắn với Optimistic UI (hiển thị ngay lập tức không cần đợi server)
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const content = inputContent.trim();
    if (!content) return;

    if (!session) {
      alert("Vui lòng đăng nhập để gửi tin nhắn!");
      return;
    }

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const senderName = session.user.fullName?.trim() || session.user.email || "Tôi";
    const senderAvatar = session.user.avatar || null;

    const optimisticMsg: ChatMessageResponse = {
      id: tempId,
      senderId: String(session.user.id),
      senderName,
      senderAvatar,
      content,
      replyTo: replyingTo
        ? {
            id: replyingTo.id,
            senderName: replyingTo.senderName,
            content: replyingTo.content,
          }
        : null,
      createdAt: new Date().toISOString(),
    };

    // 1. Đẩy tin nhắn vào giao diện NGAY LẬP TỨC
    setMessages((prev) => [...prev, optimisticMsg]);

    const targetReply = replyingTo;
    setInputContent("");
    setReplyingTo(null);

    try {
      const payload = {
        content,
        replyToId: targetReply ? targetReply.id : null,
      };

      // 2. Gửi dữ liệu tới Server
      if (stompClientRef.current && stompClientRef.current.connected) {
        stompClientRef.current.publish({
          destination: "/app/chat.send",
          body: JSON.stringify(payload),
        });
      } else {
        // Fallback gửi qua REST API nếu không có kết nối WebSocket
        const newMsg = await sendChatMessage(payload);
        setMessages((prev) => {
          const tempIndex = prev.findIndex((m) => m.id === tempId);
          if (tempIndex !== -1) {
            const updated = [...prev];
            updated[tempIndex] = newMsg;
            return updated;
          }
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      }
    } catch (err) {
      console.error("Lỗi gửi tin nhắn:", err);
      // Nếu gửi thất bại, xóa tin nhắn tạm và thông báo cho user
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      alert("Gửi tin nhắn thất bại. Vui lòng thử lại!");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const currentUserId = session?.user.id ? String(session.user.id) : null;

  if (!session) {
    return null;
  }

  return (
    <>
      {/* Nút Chat Nổi (Floating Action Button) */}
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
              {/* Badge số người online */}
              {onlineCount > 0 && (
                <span className="absolute -top-2 -right-2.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1 text-[0.65rem] font-bold text-white shadow-sm">
                  {onlineCount}
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Cửa sổ Popup Chat Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
            className="fixed bottom-24 right-6 z-50 flex h-[530px] w-[380px] max-w-[calc(100vw-2rem)] flex-col rounded-card border border-line bg-paper/95 shadow-card backdrop-blur-lg overflow-hidden"
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-line px-4 py-3 bg-surface/60">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-full bg-accent/10 text-accent">
                  <ChatCircleDots size={22} weight="fill" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-ink tracking-tight">
                    Chat Cộng Đồng
                  </h3>
                  <div className="flex items-center gap-1.5 text-[0.725rem] text-muted">
                    <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                      <Circle size={8} weight="fill" className="animate-pulse" />
                      {onlineCount} online
                    </span>
                    <span>•</span>
                    <span>{isConnected ? "Realtime" : "Kết nối lại..."}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex size-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>

            {/* Khung danh sách tin nhắn */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-3.5 text-xs">
              {isLoadingHistory ? (
                <div className="flex h-full items-center justify-center text-muted">
                  <span className="animate-pulse">Đang tải tin nhắn...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center text-muted p-4">
                  <Users size={36} className="mb-2 opacity-50" />
                  <p className="font-medium">Chưa có tin nhắn nào</p>
                  <p className="text-[0.7rem] opacity-75">Hãy là người đầu tiên gửi tin nhắn trò chuyện!</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = currentUserId !== null && msg.senderId === currentUserId;

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? "items-end" : "items-start"} group`}
                    >
                      {/* Tên người gửi & Thời gian */}
                      <div className={`mb-1 flex items-center gap-1.5 px-1 text-[0.675rem] text-muted ${isMe ? "flex-row-reverse" : ""}`}>
                        <span className="font-medium text-ink/80">{msg.senderName}</span>
                        <span>•</span>
                        <span>
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      <div className={`flex items-start gap-1.5 max-w-[85%] ${isMe ? "flex-row-reverse" : ""}`}>
                        {/* Bong bóng tin nhắn */}
                        <div
                          className={`relative rounded-2xl px-3.5 py-2.5 max-w-full overflow-hidden ${
                            isMe
                              ? "bg-accent text-accent-fg rounded-tr-xs"
                              : "bg-surface-2 text-ink border border-line rounded-tl-xs"
                          }`}
                        >
                          {/* Trích dẫn tin nhắn nếu có */}
                          {msg.replyTo && (
                            <div
                              className={`mb-1.5 rounded-lg px-2.5 py-1 text-[0.675rem] border-l-2 max-w-full overflow-hidden ${
                                isMe
                                  ? "bg-black/10 border-white/60 text-white/90"
                                  : "bg-surface border-accent text-muted"
                              }`}
                            >
                              <span className="font-semibold block truncate">{msg.replyTo.senderName}</span>
                              <p className="truncate opacity-90">{msg.replyTo.content}</p>
                            </div>
                          )}

                          <p className="whitespace-pre-wrap break-words leading-relaxed text-[0.825rem]">
                            {msg.content}
                          </p>
                        </div>

                        {/* Nút trả lời (Reply) khi hover */}
                        <button
                          type="button"
                          onClick={() => setReplyingTo(msg)}
                          title="Trả lời tin nhắn này"
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted hover:text-ink rounded-full hover:bg-surface-2 self-center shrink-0"
                        >
                          <ArrowUUpLeft size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Xem trước tin nhắn đang trả lời (Reply Preview Bar) */}
            {replyingTo && (
              <div className="flex items-center justify-between border-t border-line bg-surface-2/70 px-3 py-1.5 text-[0.7rem] text-muted">
                <div className="flex items-center gap-1.5 truncate">
                  <ArrowUUpLeft size={13} className="text-accent shrink-0" />
                  <span className="truncate">
                    Trả lời <strong className="text-ink">{replyingTo.senderName}</strong>: &quot;{replyingTo.content}&quot;
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyingTo(null)}
                  className="text-muted hover:text-ink p-0.5"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Input Bar */}
            <div className="border-t border-line p-3 bg-surface/80">
              {session ? (
                <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                  <textarea
                    value={inputContent}
                    onChange={(e) => setInputContent(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Nhập tin nhắn... (Enter để gửi)"
                    rows={1}
                    className="flex-1 max-h-24 min-h-[38px] resize-none rounded-xl border border-line bg-paper px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-accent focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!inputContent.trim() || isSending}
                    className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-fg transition-opacity disabled:opacity-40 hover:bg-accent-hover"
                  >
                    <PaperPlaneRight size={16} weight="fill" />
                  </button>
                </form>
              ) : (
                <div className="rounded-xl border border-line bg-surface-2/60 p-2.5 text-center text-[0.75rem] text-muted">
                  Bạn cần{" "}
                  <Link href="/sign-in" className="font-semibold text-accent underline">
                    đăng nhập
                  </Link>{" "}
                  để gửi tin nhắn.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
