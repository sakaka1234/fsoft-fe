"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Client } from "@stomp/stompjs";
import { SpeakerHigh } from "@phosphor-icons/react/SpeakerHigh";
import { Trophy } from "@phosphor-icons/react/Trophy";
import { Lightning } from "@phosphor-icons/react/Lightning";
import { CheckCircle } from "@phosphor-icons/react/CheckCircle";
import { XCircle } from "@phosphor-icons/react/XCircle";
import { GameController } from "@phosphor-icons/react/GameController";
import { Timer } from "@phosphor-icons/react/Timer";
import { Users } from "@phosphor-icons/react/Users";
import { Copy } from "@phosphor-icons/react/Copy";
import { Check } from "@phosphor-icons/react/Check";
import { Crown } from "@phosphor-icons/react/Crown";
import { SignOut } from "@phosphor-icons/react/SignOut";
import { Cards } from "@phosphor-icons/react/Cards";
import { Waveform } from "@phosphor-icons/react/Waveform";
import { WifiSlash } from "@phosphor-icons/react/WifiSlash";
import { Play } from "@phosphor-icons/react/Play";
import { ArrowLeft } from "@phosphor-icons/react/ArrowLeft";
import { Sparkle } from "@phosphor-icons/react/Sparkle";
import { Medal } from "@phosphor-icons/react/Medal";
import { Flame } from "@phosphor-icons/react/Flame";
import { MagnifyingGlass } from "@phosphor-icons/react/MagnifyingGlass";
import { Clock } from "@phosphor-icons/react/Clock";

import {
  type AudioReflexRoomState,
  createAudioReflexRoom,
  getAudioReflexRoom,
  joinAudioReflexRoom,
  leaveAudioReflexRoom,
  selectPlayerDeckInRoom,
  startAudioReflexRoomGame,
  submitAudioReflexRoomAnswer,
} from "@/lib/api/games";
import { listMyDecks } from "@/lib/api/decks";
import type { DeckResponse } from "@/lib/api/types";
import { API_BASE_URL } from "@/lib/api/client";
import { getSession } from "@/lib/auth/session-store";
import { useSession } from "@/lib/auth/use-session";
import { cn } from "@/lib/cn";

/* ---------------------------------------------------------------------------
   Helpers & Audio Visualizer
   ------------------------------------------------------------------------- */

function speak(text: string, onStart?: () => void, onEnd?: () => void) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.9;
  if (onStart) utterance.onstart = onStart;
  if (onEnd) utterance.onend = onEnd;
  window.speechSynthesis.speak(utterance);
}

const QUESTION_TIME_LIMIT = 15;
const OPTION_LETTERS = ["A", "B", "C", "D"];

interface Props {
  /* Cả hai đều tuỳ chọn: vào phòng bằng mã thì chủ phòng mới là người
     cung cấp bộ thẻ, người vào không cần có bộ thẻ nào. deckId chỉ dùng đúng
     một chỗ là lúc TẠO phòng. */
  deckId?: number;
  deckTitle?: string;
  onBackToSolo?: () => void;
}

export function AudioReflexMultiplayer({ deckId, deckTitle, onBackToSolo }: Props) {
  const session = useSession();
  const currentUserId = session?.user?.id ? String(session.user.id) : "";

  /* --- States --- */
  const [room, setRoom] = useState<AudioReflexRoomState | null>(null);
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  /* Audio playing visualizer state (LẦN 6) */
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  /* My Decks selection modal & search (LẦN 7) */
  const [myDecks, setMyDecks] = useState<DeckResponse[]>([]);
  const [loadingMyDecks, setLoadingMyDecks] = useState(false);
  const [showDeckModal, setShowDeckModal] = useState(false);
  const [deckSearchQuery, setDeckSearchQuery] = useState("");

  /* Playing state */
  const [selectedOptionId, setSelectedOptionId] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(QUESTION_TIME_LIMIT);
  const [scorePopup, setScorePopup] = useState<{ points: number; isCorrect: boolean } | null>(null);

  const stompClientRef = useRef<Client | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* --- Load my decks --- */
  const loadMyDecks = useCallback(async () => {
    setLoadingMyDecks(true);
    try {
      const res = await listMyDecks(1, 50);
      setMyDecks(res?.content ?? []);
    } catch {
      setMyDecks([]);
    } finally {
      setLoadingMyDecks(false);
    }
  }, []);

  /* --- Setup STOMP WebSocket Connection --- */
  const setupWebSocket = useCallback((roomCode: string) => {
    if (stompClientRef.current) {
      stompClientRef.current.deactivate();
      stompClientRef.current = null;
    }

    try {
      const token = getSession()?.token.accessToken;
      const wsUrl = API_BASE_URL.replace(/^http/, "ws") + "/ws-game";

      const client = new Client({
        brokerURL: wsUrl,
        connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
        reconnectDelay: 3000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
        onConnect: () => {
          client.subscribe(`/topic/room/${roomCode}`, (msg) => {
            try {
              const payload = JSON.parse(msg.body);
              if (payload.room) {
                setRoom(payload.room);
              }
            } catch {
              // Ignore parse error
            }
          });

          client.publish({
            destination: `/app/room/${roomCode}/join-socket`,
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: "",
          });
        },
      });

      client.activate();
      stompClientRef.current = client;
    } catch {
      // Graceful fallback
    }
  }, []);

  /* Cleanup on unmount */
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (stompClientRef.current) {
        stompClientRef.current.deactivate();
        stompClientRef.current = null;
      }
      window.speechSynthesis?.cancel();
    };
  }, []);

  /* Helper speak with audio visualizer */
  const triggerAudioPlay = useCallback((text: string) => {
    speak(
      text,
      () => setIsPlayingAudio(true),
      () => setIsPlayingAudio(false),
    );
  }, []);

  /* Timer & Current Question Effect */
  useEffect(() => {
    if (!room || room.status !== "PLAYING") {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      return;
    }

    const currentQ = room.questions[room.currentQuestionIndex];
    if (currentQ) {
      triggerAudioPlay(currentQ.word);
    }

    setAnswered(false);
    setSelectedOptionId(null);
    setScorePopup(null);

    const elapsedSeconds = Math.floor((Date.now() - room.currentQuestionStartedAt) / 1000);
    const initialRemaining = Math.max(0, QUESTION_TIME_LIMIT - elapsedSeconds);
    setTimeLeft(initialRemaining);

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    timerIntervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [room?.currentQuestionIndex, room?.currentQuestionStartedAt, room?.status, triggerAudioPlay]);

  /* Track if current user answered */
  useEffect(() => {
    if (!room || room.status !== "PLAYING" || !currentUserId) return;
    if (room.answeredThisQuestion?.includes(currentUserId)) {
      setAnswered(true);
    }
  }, [room?.answeredThisQuestion, room?.status, currentUserId]);

  /* --- Actions --- */

  /** 1. Host Tạo Phòng mới */
  async function handleCreateRoom() {
    /* Nút tạo phòng đã bị ẩn khi không có bộ thẻ; đây là chốt chặn thứ hai. */
    if (deckId == null) return;
    setLoading(true);
    setError(null);
    try {
      const state = await createAudioReflexRoom(deckId, 10);
      setRoom(state);
      setupWebSocket(state.roomCode);
      loadMyDecks();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Không thể tạo phòng";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  /** 2. Người chơi nhập mã để vào phòng */
  async function handleJoinRoom(codeToJoin?: string) {
    const code = (codeToJoin || joinCodeInput).trim().toUpperCase();
    if (!code) {
      setError("Vui lòng nhập mã phòng (6 ký tự)");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const state = await joinAudioReflexRoom(code);
      setRoom(state);
      setupWebSocket(state.roomCode);
      loadMyDecks();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Không thể vào phòng. Kiểm tra lại mã!";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  /** 3. Chọn bộ thẻ cá nhân đóng góp vào phòng */
  async function handleSelectMyDeck(selectedDeckId: number | null) {
    if (!room) return;
    setLoading(true);
    try {
      const updated = await selectPlayerDeckInRoom(room.roomCode, selectedDeckId);
      setRoom(updated);
      setShowDeckModal(false);

      if (stompClientRef.current?.connected) {
        const token = getSession()?.token.accessToken;
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        stompClientRef.current.publish({
          destination: `/app/room/${room.roomCode}/select-deck`,
          headers,
          body: JSON.stringify({ deckId: selectedDeckId }),
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi chọn bộ thẻ";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  /** 4. Host bấm Bắt đầu ván chơi */
  async function handleStartGame() {
    if (!room) return;
    setLoading(true);
    setError(null);
    try {
      const updated = await startAudioReflexRoomGame(room.roomCode);
      setRoom(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Không thể bắt đầu. Cần ít nhất 2 người!";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  /** 5. Nộp câu trả lời */
  async function handleAnswer(optionId: number) {
    if (!room || room.status !== "PLAYING" || answered) return;
    setAnswered(true);
    setSelectedOptionId(optionId);

    const currentQ = room.questions[room.currentQuestionIndex];
    const isCorrect = currentQ && Number(optionId) === Number(currentQ.correctOptionId);

    let points = 0;
    if (isCorrect) {
      const elapsedMs = Date.now() - room.currentQuestionStartedAt;
      const speedBonus = Math.max(0, 500 - Math.floor(elapsedMs / 20));
      points = 500 + speedBonus;
    } else {
      points = -200;
    }
    setScorePopup({ points, isCorrect });

    // 1. Gửi qua WebSocket STOMP
    if (stompClientRef.current?.connected) {
      const token = getSession()?.token.accessToken;
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      stompClientRef.current.publish({
        destination: `/app/room/${room.roomCode}/answer`,
        headers,
        body: JSON.stringify({ cardId: optionId }),
      });
    }

    // 2. Gửi REST API dự phòng
    try {
      const updated = await submitAudioReflexRoomAnswer(room.roomCode, optionId);
      setRoom(updated);
    } catch {
      // Dynamic fallback ignored
    }
  }

  /** 6. Rời phòng */
  async function handleLeaveRoom() {
    if (!room) return;
    try {
      await leaveAudioReflexRoom(room.roomCode);
    } catch {
      // Silent error
    } finally {
      if (stompClientRef.current) {
        stompClientRef.current.deactivate();
        stompClientRef.current = null;
      }
      setRoom(null);
    }
  }

  /** Copy Mã Phòng */
  function copyRoomCode() {
    if (!room) return;
    navigator.clipboard.writeText(room.roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  /* Filtered decks in modal (LẦN 7) */
  const filteredMyDecks = myDecks.filter((d) =>
    d.title.toLowerCase().includes(deckSearchQuery.toLowerCase()),
  );

  /* ===========================================================================
     RENDER 1: NO ROOM (Màn Hình Khởi Tạo & Chọn Mã Phòng)
     ========================================================================= */
  if (!room) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl mx-auto flex flex-col gap-6"
      >
        <div className="flex flex-col items-center gap-4 text-center py-6">
          <div className="relative flex size-20 items-center justify-center rounded-card bg-accent-soft text-accent shadow-card border border-accent/20 backdrop-blur-md">
            <Users size={42} weight="fill" className="text-accent drop-shadow-md" />
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
              className="absolute -top-1 -right-1 text-accent-text"
            >
              <Sparkle size={20} weight="fill" />
            </motion.div>
          </div>

          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-ink">
              Chơi Cùng Bạn Bè
            </h2>
            <p className="mt-1.5 text-sm text-muted max-w-md">
              Tạo phòng thi đấu hoặc nhập mã 6 ký tự để so tài nghe âm thanh từ vựng real-time!
            </p>
          </div>

          {error && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mt-2 rounded-card border border-danger/30 bg-danger/10 px-5 py-2.5 text-xs font-semibold text-danger shadow-sm"
            >
              {error}
            </motion.div>
          )}

          <div
            className={cn(
              "grid grid-cols-1 gap-5 w-full mt-4",
              deckId != null ? "sm:grid-cols-2" : "sm:max-w-sm sm:mx-auto",
            )}
          >
            {/* Card 1: Tạo phòng mới */}
            {deckId != null ? (
              <div className="group relative flex flex-col items-center justify-between gap-5 p-7 rounded-card border border-line bg-surface shadow-card transition-colors hover:border-accent hover:bg-surface-2 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="flex size-14 items-center justify-center rounded-card bg-accent-soft text-accent-text shadow-inner">
                    <Crown size={32} weight="fill" />
                  </div>
                  <div>
                    <h3 className="font-bold text-ink text-lg">Tạo Phòng Mới</h3>
                    <p className="text-xs text-muted mt-1 leading-relaxed">Trở thành Host và mời bạn bè tham gia phòng thi đấu</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCreateRoom}
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-bold bg-accent text-accent-fg shadow-card hover:bg-accent-hover active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
                >
                  {loading ? "Đang khởi tạo..." : "Tạo Phòng Mới"}
                </button>
              </div>
            ) : null}

            {/* Card 2: Nhập mã phòng */}
            <div className="group relative flex flex-col items-center justify-between gap-5 p-7 rounded-card border border-line bg-surface shadow-card transition-colors hover:border-accent hover:bg-surface-2 text-center">
              <div className="flex flex-col items-center gap-3 w-full">
                <div className="flex size-14 items-center justify-center rounded-card bg-accent-soft text-accent-text shadow-inner">
                  <GameController size={32} weight="fill" />
                </div>
                <div>
                  <h3 className="font-bold text-ink text-lg">Tham Gia Phòng</h3>
                  <p className="text-xs text-muted mt-1">Nhập mã 6 ký tự để vào phòng</p>
                </div>
                <input
                  type="text"
                  maxLength={6}
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  placeholder="X7K9A2"
                  className="w-full text-center tracking-[0.25em] font-mono font-semibold text-lg rounded-card border border-line bg-surface-2 px-4 py-2.5 text-ink focus:border-accent focus:ring-2 focus:ring-accent focus:outline-none transition-all"
                />
              </div>
              <button
                type="button"
                onClick={() => handleJoinRoom()}
                disabled={loading || !joinCodeInput.trim()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-bold text-accent-fg shadow-card hover:bg-accent-hover active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? "Đang vào..." : "Vào Phòng"}
              </button>
            </div>
          </div>

          {onBackToSolo && (
            <button
              type="button"
              onClick={onBackToSolo}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink transition-colors cursor-pointer"
            >
              <ArrowLeft size={14} /> Quay lại chế độ Chơi đơn
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  const isHost = room.hostUserId === currentUserId;
  const playersList = Object.values(room.players || {});

  /* ===========================================================================
     RENDER 2: LOBBY (Phòng Chờ Chuyên Nghiệp & Modal Bộ Thẻ Cá Nhân LẦN 7)
     ========================================================================= */
  if (room.status === "WAITING") {
    const myPlayerState = room.players[currentUserId];

    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl mx-auto flex flex-col gap-6"
      >
        {/* Room Header & Code Banner */}
        <div className="relative overflow-hidden flex flex-col items-center gap-4 rounded-card border border-line bg-surface p-7 text-center shadow-card backdrop-blur-xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-accent bg-accent/10 px-3 py-1 rounded-full border border-accent/20">
            <Users size={14} /> Phòng Thi Đấu Trực Tuyến
          </div>

          <div className="flex items-center gap-4 bg-surface-2 border border-line/80 px-8 py-3.5 rounded-card shadow-inner">
            <span className="font-mono text-4xl font-semibold tracking-[0.2em] text-ink">
              {room.roomCode}
            </span>
            <button
              type="button"
              onClick={copyRoomCode}
              className="flex size-10 items-center justify-center rounded-field bg-surface border border-line text-muted hover:text-accent hover:border-accent transition-all active:scale-95 shadow-sm cursor-pointer"
              title="Copy Mã Phòng"
            >
              {copied ? <Check size={20} className="text-ok" /> : <Copy size={20} />}
            </button>
          </div>
          <p className="text-xs text-muted font-medium">Chia sẻ mã 6 ký tự trên cho bạn bè để cùng thi đấu</p>

          {error && (
            <div className="rounded-field border border-danger/30 bg-danger/10 px-4 py-2 text-xs font-semibold text-danger">
              {error}
            </div>
          )}

          {/* Bộ Thẻ Đóng Góp Banner */}
          <div className="w-full mt-1 p-4 rounded-card border border-dashed border-accent/40 bg-accent/5 flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3 text-left">
              <div className="flex size-10 items-center justify-center rounded-field bg-accent/15 text-accent shrink-0">
                <Cards size={22} weight="fill" />
              </div>
              <div>
                <p className="text-xs font-semibold text-ink">
                  {isHost ? "Bộ thẻ phòng (Host):" : "Bộ thẻ bạn đóng góp:"}
                </p>
                <p className="text-xs text-muted truncate max-w-[200px] sm:max-w-[280px] font-semibold mt-0.5">
                  {myPlayerState?.selectedDeckTitle
                    ? `${myPlayerState.selectedDeckTitle} (${myPlayerState.selectedDeckCardCount} từ)`
                    : "Chưa chọn bộ thẻ đóng góp"}
                </p>
              </div>
            </div>

            {!isHost && (
              <button
                type="button"
                onClick={() => {
                  setShowDeckModal(true);
                  loadMyDecks();
                }}
                className="px-4 py-2 rounded-full bg-accent text-accent-fg text-xs font-bold hover:bg-accent-hover transition-all cursor-pointer shrink-0 shadow-md active:scale-95"
              >
                {myPlayerState?.selectedDeckId ? "Đổi thẻ" : "Chọn thẻ"}
              </button>
            )}
          </div>
        </div>

        {/* Danh sách Người Chơi trong Phòng */}
        <div className="rounded-card border border-line bg-surface overflow-hidden shadow-card">
          <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-surface-2/70">
            <span className="text-xs font-semibold text-ink flex items-center gap-2">
              <Users size={16} className="text-accent" /> Thành viên ({playersList.length}/20)
            </span>
            {isHost && (
              <span className="text-xs font-bold text-accent-text bg-accent-soft px-2.5 py-1 rounded-full flex items-center gap-1 border border-accent">
                <Crown size={14} weight="fill" /> Bạn là Host
              </span>
            )}
          </div>

          <ul className="divide-y divide-line">
            {playersList.map((p) => (
              <li key={p.userId} className="flex items-center justify-between p-4 text-sm hover:bg-surface-2/40 transition-colors">
                <div className="flex items-center gap-3.5">
                  <div className="relative">
                    <div className="flex size-11 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent text-base border border-accent/30 shadow-xs">
                      {p.displayName?.substring(0, 1) || "U"}
                    </div>
                    {!p.connected && (
                      <span
                        className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-danger text-accent-fg ring-2 ring-surface shadow-xs"
                        title="Bị mất mạng"
                      >
                        <WifiSlash size={11} />
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-ink text-base">{p.displayName}</span>
                      {p.host && (
                        <span className="flex items-center gap-0.5 text-xs font-semibold bg-accent-soft text-accent-text px-2 py-0.5 rounded-full border border-accent">
                          <Crown size={10} weight="fill" /> Host
                        </span>
                      )}
                    </div>

                    {p.selectedDeckTitle ? (
                      <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
                        <Cards size={12} className="text-accent" />
                        Đóng góp: <strong className="text-ink font-semibold">{p.selectedDeckTitle}</strong> ({p.selectedDeckCardCount} từ)
                      </p>
                    ) : (
                      <p className="text-xs text-muted opacity-75 mt-0.5 italic">
                        Chưa chọn bộ thẻ đóng góp
                      </p>
                    )}
                  </div>
                </div>

                <span
                  className={cn(
                    "text-xs font-bold px-3 py-1 rounded-full border",
                    p.connected
                      ? "bg-ok-soft border-ok text-ok"
                      : "bg-danger/10 border-danger/30 text-danger",
                  )}
                >
                  {p.connected ? "Sẵn sàng" : "Mất mạng"}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={handleLeaveRoom}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-line text-xs font-bold text-muted hover:text-danger hover:border-danger/40 transition-all cursor-pointer active:scale-95"
          >
            <SignOut size={16} /> Rời phòng
          </button>

          {isHost ? (
            <button
              type="button"
              onClick={handleStartGame}
              disabled={loading || playersList.length < 2}
              className="inline-flex items-center gap-2 rounded-full bg-accent text-accent-fg hover:bg-accent-hover px-8 py-3.5 text-sm font-semibold shadow-card hover:shadow-card transition-all cursor-pointer disabled:opacity-50 active:scale-95"
            >
              <Play size={18} weight="fill" />
              {loading ? "Đang khởi tạo..." : "Bắt Đầu Ván Chơi"}
            </button>
          ) : (
            <div className="text-xs font-bold text-muted italic">
              Đang chờ Host bắt đầu trận đấu...
            </div>
          )}
        </div>

        {/* Modal Chọn Bộ Thẻ Cá Nhân (LẦN 7: Tìm kiếm + Mini Flashcards Container) */}
        {showDeckModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-2 backdrop-blur-md p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-md rounded-card border border-line bg-paper p-6 shadow-card overflow-hidden flex flex-col gap-4"
            >
              <div className="flex items-center justify-between border-b border-line pb-3">
                <h3 className="font-semibold text-ink text-base flex items-center gap-2">
                  <Cards size={20} className="text-accent" /> Chọn Bộ Thẻ Cá Nhân
                </h3>
                <button
                  type="button"
                  onClick={() => setShowDeckModal(false)}
                  className="text-xs text-muted hover:text-ink font-bold cursor-pointer px-2 py-1 rounded-lg hover:bg-surface-2"
                >
                  Đóng
                </button>
              </div>

              {/* Ô tìm kiếm bộ thẻ */}
              <div className="relative w-full">
                <MagnifyingGlass size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  value={deckSearchQuery}
                  onChange={(e) => setDeckSearchQuery(e.target.value)}
                  placeholder="Tìm bộ thẻ của bạn..."
                  className="w-full pl-9 pr-4 py-2 rounded-field border border-line bg-surface text-xs font-semibold text-ink focus:border-accent focus:outline-none"
                />
              </div>

              {loadingMyDecks ? (
                <div className="py-8 text-center text-xs text-muted font-semibold">
                  Đang tải danh sách bộ thẻ...
                </div>
              ) : filteredMyDecks.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted font-medium">
                  {deckSearchQuery ? "Không tìm thấy bộ thẻ nào phù hợp." : "Bạn chưa có bộ thẻ cá nhân nào."}
                </div>
              ) : (
                <ul className="max-h-64 overflow-y-auto space-y-2.5 pr-1">
                  {filteredMyDecks.map((d) => {
                    const isSelected = myPlayerState?.selectedDeckId === d.id;
                    return (
                      <li key={d.id}>
                        <button
                          type="button"
                          onClick={() => handleSelectMyDeck(d.id)}
                          className={cn(
                            "w-full flex items-center justify-between p-3.5 rounded-card border text-left text-sm font-medium transition-all cursor-pointer shadow-2xs",
                            isSelected
                              ? "border-accent bg-accent/15 text-accent font-bold ring-2 ring-accent/30"
                              : "border-line bg-surface hover:bg-surface-2 text-ink",
                          )}
                        >
                          <div className="flex flex-col">
                            <span className="truncate max-w-[220px] font-bold text-sm">{d.title}</span>
                            <span className="text-xs text-muted font-normal mt-0.5">{d.totalCards} từ vựng</span>
                          </div>
                          {isSelected && <CheckCircle size={22} weight="fill" className="text-accent" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {myPlayerState?.selectedDeckId && (
                <button
                  type="button"
                  onClick={() => handleSelectMyDeck(null)}
                  className="mt-2 w-full py-2 text-center text-xs font-bold text-danger hover:underline cursor-pointer"
                >
                  Bỏ chọn bộ thẻ cá nhân
                </button>
              )}
            </motion.div>
          </div>
        )}
      </motion.div>
    );
  }

  /* ===========================================================================
     RENDER 3: PLAYING (LẦN 6: Soundwave, LẦN 8: Streak & Status, LẦN 9: Time Emergency)
     ========================================================================= */
  if (room.status === "PLAYING") {
    const currentQ = room.questions[room.currentQuestionIndex];
    const progress = ((room.currentQuestionIndex + 1) / room.questions.length) * 100;
    const timerPct = (timeLeft / QUESTION_TIME_LIMIT) * 100;
    const sortedPlayers = [...playersList].sort((a, b) => b.score - a.score);
    const isCriticalTime = timeLeft <= 3;

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-5xl mx-auto w-full"
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* =================================================================
             CỘT BÊN TRÁI (COL-SPAN-2): CÂU HỎI & CÁC NÚT ĐÁP ÁN
             ================================================================= */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {/* Live HUD Header: Điểm + Số câu hỏi (6/10) + Score Popup + Timer */}
            <div className="flex items-center justify-between gap-3 text-sm px-1">
              <div className="flex items-center gap-2.5 font-semibold text-ink">
                <Trophy size={22} className="text-accent-text drop-shadow-sm shrink-0" weight="fill" />
                <span className="font-mono text-xl font-semibold">
                  {room.players[currentUserId]?.score?.toLocaleString() || 0} đ
                </span>

                <span className="text-xs font-mono font-bold text-muted tabular-nums shrink-0 bg-surface border border-line px-2.5 py-0.5 rounded-full shadow-2xs">
                  {room.currentQuestionIndex + 1} / {room.questions.length}
                </span>

                {/* Animated Floating Score Popup */}
                <AnimatePresence mode="wait">
                  {scorePopup && (
                    <motion.div
                      key={room.currentQuestionIndex + "-" + scorePopup.points}
                      initial={{ scale: 0.5, y: 12, opacity: 0 }}
                      animate={{ scale: 1.15, y: 0, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-semibold shadow-md border backdrop-blur-md",
                        scorePopup.isCorrect
                          ? "bg-ok-soft border-ok text-ok"
                          : "bg-danger/15 border-danger/40 text-danger",
                      )}
                    >
                      {scorePopup.isCorrect ? (
                        <>
                          <Lightning size={14} weight="fill" />
                          <span>+{scorePopup.points}đ</span>
                        </>
                      ) : (
                        <>
                          <XCircle size={14} weight="fill" />
                          <span>-200đ (Trả lời sai)</span>
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Timer Emergency Badge */}
              <div
                className={cn(
                  "flex items-center gap-2 bg-surface border px-3 py-1 rounded-full transition-all shadow-2xs",
                  isCriticalTime
                    ? "border-danger bg-danger/15 ring-4 ring-danger/20 text-danger"
                    : "border-line text-ink",
                )}
              >
                <Timer size={18} className={isCriticalTime ? "text-danger animate-spin" : "text-muted"} />
                <span
                  className={cn(
                    "font-mono font-semibold tabular-nums text-sm",
                    isCriticalTime ? "text-danger font-semibold text-base" : "text-ink",
                  )}
                >
                  {timeLeft}s
                </span>
              </div>
            </div>

            {/* Thanh đếm ngược thời gian */}
            <div className="h-2 w-full rounded-full bg-surface-2 overflow-hidden shadow-inner">
              <motion.div
                className={cn(
                  "h-full rounded-full transition-colors",
                  isCriticalTime ? "bg-danger shadow-card" : timeLeft > 5 ? "bg-accent" : "bg-accent",
                )}
                animate={{ width: `${timerPct}%` }}
                transition={{ duration: 0.9, ease: "linear" }}
              />
            </div>

            {/* Question Card (KHUNG CHỨA LOA THU GỌN) */}
            {currentQ && (
              <div
                className={cn(
                  "relative rounded-card border bg-surface/90 backdrop-blur-xl p-4 text-center shadow-card overflow-hidden transition-all duration-300",
                  isCriticalTime ? "border-danger/60 ring-2 ring-danger/20" : "border-line",
                )}
              >
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => triggerAudioPlay(currentQ.word)}
                  className="group relative flex items-center justify-center gap-3 w-full py-4 px-4 rounded-card bg-accent/10 border border-accent/20 hover:bg-accent/15 transition-all cursor-pointer shadow-inner overflow-hidden"
                >
                  <div className="relative flex size-12 items-center justify-center rounded-full bg-accent text-accent-fg shadow-md transition-transform shrink-0">
                    <SpeakerHigh size={24} weight="fill" />
                  </div>

                  {/* Animated Sound Wave Bars */}
                  <div className="flex items-center gap-1.5 h-5">
                    {[10, 16, 12, 18, 10].map((h, i) => (
                      <motion.span
                        key={i}
                        className="w-1 rounded-full bg-accent"
                        animate={isPlayingAudio ? { height: [4, h, 4] } : { height: 4 }}
                        transition={{ duration: 0.4, repeat: isPlayingAudio ? Infinity : 0, delay: i * 0.1 }}
                      />
                    ))}
                    <span className="text-xs font-semibold text-accent ml-1">
                      {isPlayingAudio ? "Đang phát..." : "Nhấn để nghe lại"}
                    </span>
                  </div>
                </motion.button>

                {answered && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2.5 flex flex-col items-center gap-0.5"
                  >
                    <h3 className="text-2xl font-semibold text-ink tracking-tight">
                      {currentQ.word}
                    </h3>
                    {currentQ.phonetic && (
                      <p className="font-mono text-xs text-muted font-bold">{currentQ.phonetic}</p>
                    )}
                  </motion.div>
                )}
              </div>
            )}

            {/* Options Grid */}
            {currentQ && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {currentQ.options.map((opt, idx) => {
                  const isSelected = Number(selectedOptionId) === Number(opt.optionId);
                  const isCorrect = Number(opt.optionId) === Number(currentQ.correctOptionId);
                  const optionLetter = OPTION_LETTERS[idx] || "";

                  let btnClass =
                    "group relative flex items-center gap-3.5 rounded-card border p-4 text-sm font-bold transition-all duration-200 cursor-pointer select-none text-left shadow-2xs";

                  if (answered) {
                    if (isCorrect) {
                      btnClass += " border-ok bg-ok-soft text-ok ring-2 ring-ok shadow-md scale-[1.01]";
                    } else if (isSelected && !isCorrect) {
                      btnClass += " border-danger bg-danger/15 text-danger ring-2 ring-danger/40";
                    } else {
                      btnClass += " border-line bg-surface text-muted opacity-40";
                    }
                  } else {
                    btnClass +=
                      " border-line bg-surface text-ink hover:border-accent hover:bg-accent/5 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]";
                  }

                  return (
                    <button
                      key={opt.optionId}
                      type="button"
                      onClick={() => handleAnswer(opt.optionId)}
                      disabled={answered}
                      className={btnClass}
                    >
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-field text-xs font-semibold font-mono transition-all shadow-xs",
                          answered
                            ? isCorrect
                              ? "bg-ok text-accent-fg"
                              : isSelected && !isCorrect
                              ? "bg-danger text-accent-fg"
                              : "bg-surface-2 text-muted"
                            : "bg-surface-2 text-muted group-hover:bg-accent group-hover:text-accent-fg",
                        )}
                      >
                        {optionLetter}
                      </span>

                      <span className="flex-1 font-bold text-sm leading-snug">{opt.text}</span>

                      {answered && isCorrect && (
                        <CheckCircle size={20} weight="fill" className="text-ok shrink-0 drop-shadow-sm" />
                      )}
                      {answered && isSelected && !isCorrect && (
                        <XCircle size={20} weight="fill" className="text-danger shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {answered && (
              <div className="mt-1 text-center text-xs font-semibold text-muted italic flex items-center justify-center gap-1.5">
                <Clock size={14} className="text-accent" />
                Đã gửi câu trả lời! Đang chờ các đối thủ còn lại...
              </div>
            )}
          </div>

          {/* =================================================================
             CỘT BÊN PHẢI (COL-SPAN-1): BẢNG XẾP HẠNG CỐ ĐỊNH KHÔNG DI CHUYỂN
             ================================================================= */}
          <div className="lg:col-span-1 rounded-card border border-line bg-surface p-5 shadow-card sticky top-6 self-start backdrop-blur-xl h-fit min-h-[360px] select-none">
            <div className="flex items-center justify-between border-b border-line pb-3.5 mb-4">
              <div className="flex items-center gap-2">
                <Trophy size={22} className="text-accent-text drop-shadow-sm shrink-0" weight="fill" />
                <h3 className="font-semibold text-ink text-sm">
                  BXH Trực Tiếp
                </h3>
              </div>
              <span className="text-xs font-mono font-semibold text-muted bg-surface-2 px-2.5 py-0.5 rounded-full border border-line">
                {playersList.length} Người
              </span>
            </div>

            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-0.5">
              <AnimatePresence>
                {sortedPlayers.map((p, rank) => {
                  const isMe = p.userId === currentUserId;
                  const isTop1 = rank === 0;
                  const isTop2 = rank === 1;
                  const isTop3 = rank === 2;
                  const hasAnswered = room.answeredThisQuestion?.includes(p.userId);

                  return (
                    <motion.div
                      key={p.userId}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                      className={cn(
                        "flex items-center justify-between p-3.5 rounded-card border transition-all shadow-xs relative overflow-hidden",
                        isMe
                          ? "border-accent bg-accent/10 shadow-md ring-2 ring-accent/30"
                          : isTop1
                          ? "border-accent to-transparent"
                          : "border-line bg-surface-2/60",
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Rank Badge */}
                        <div
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-field font-mono text-xs font-semibold shadow-xs",
                            isTop1
                              ? "bg-accent text-accent-fg"
                              : isTop2
                              ? "bg-surface-2 text-ink"
                              : isTop3
                              ? "bg-accent text-accent-fg"
                              : "bg-surface text-muted border border-line",
                          )}
                        >
                          {isTop1 ? <Crown size={16} weight="fill" /> : `#${rank + 1}`}
                        </div>

                        {/* Avatar & Name & LẦN 8: Answer status dot */}
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={cn("truncate text-xs font-semibold", isMe ? "text-accent" : "text-ink")}>
                              {p.displayName}
                            </span>
                            {isMe && (
                              <span className="text-xs font-semibold bg-accent text-accent-fg px-1.5 py-0.5 rounded-full">
                                Bạn
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted font-medium">
                              {p.correctCount} câu đúng
                            </span>
                            {p.correctCount >= 3 && (
                              <span className="text-xs font-semibold text-accent-text bg-accent-soft px-1 rounded flex items-center gap-0.5">
                                <Flame size={10} weight="fill" /> Streak
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Score & Answered Status */}
                      <div className="flex flex-col items-end shrink-0">
                        <span className="font-mono text-base font-semibold text-accent">
                          {p.score.toLocaleString()} đ
                        </span>
                        {hasAnswered ? (
                          <span className="text-xs font-bold text-ok flex items-center gap-1">
                            <CheckCircle size={10} weight="fill" /> Đã nộp
                          </span>
                        ) : (
                          <span className="text-xs text-muted flex items-center gap-1 opacity-70">
                            <span className="size-1.5 rounded-full bg-accent" /> Suy nghĩ...
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  /* ===========================================================================
     RENDER 4: FINISHED (LẦN 10: Match Analytics Awards & Podium)
     ========================================================================= */
  if (room.status === "FINISHED") {
    const sortedPlayers = [...playersList].sort((a, b) => b.score - a.score);
    const top1 = sortedPlayers[0];
    const top2 = sortedPlayers[1];
    const top3 = sortedPlayers[2];
    const remainingPlayers = sortedPlayers.slice(3);

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-3xl mx-auto flex flex-col gap-8 py-4"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-20 items-center justify-center rounded-card bg-accent-soft text-accent-text border border-accent shadow-card">
            <Trophy size={46} weight="fill" className="drop-shadow-md" />
          </div>
          <div>
            <h2 className="text-3xl font-semibold text-ink tracking-tight">
              Kết Thúc Trận Đấu!
            </h2>
            <p className="text-sm font-semibold text-muted mt-1">Bảng vinh danh bục vương miện thi đấu</p>
          </div>
        </div>

        {/* 3D PODIUM DISPLAY (BỤC VINH QUANG) */}
        <div className="flex items-end justify-center gap-3 sm:gap-6 pt-8 pb-4">
          {/* Rank 2 (Bên trái) */}
          {top2 && (
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex flex-col items-center w-1/3 max-w-[170px]"
            >
              <div className="flex flex-col items-center mb-2">
                <div className="flex size-14 items-center justify-center rounded-full bg-surface-2 text-ink font-semibold text-xl border-2 border-line shadow-md">
                  {top2.displayName?.substring(0, 1)}
                </div>
                <span className="font-semibold text-sm text-ink truncate max-w-[120px] mt-1">
                  {top2.displayName}
                </span>
                <span className="font-mono text-xs font-semibold text-accent">{top2.score.toLocaleString()} đ</span>
              </div>
              <div className="flex h-32 w-full flex-col items-center justify-start rounded-t-card border-t-4 border-line bg-surface-2 pt-3 shadow-card">
                <Medal size={28} className="text-muted" weight="fill" />
                <span className="font-mono font-semibold text-muted text-lg">#2</span>
              </div>
            </motion.div>
          )}

          {/* Rank 1 (Ở giữa - Cao nhất) */}
          {top1 && (
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="flex flex-col items-center w-1/3 max-w-[190px] -mt-6"
            >
              <div className="flex flex-col items-center mb-2 relative">
                <Crown size={32} weight="fill" className="text-accent-text absolute -top-8" />
                <div className="flex size-18 items-center justify-center rounded-full bg-accent text-accent-fg font-semibold text-2xl border-4 border-accent shadow-card ring-4 ring-accent">
                  {top1.displayName?.substring(0, 1)}
                </div>
                <span className="font-semibold text-base text-accent-text truncate max-w-[130px] mt-1">
                  {top1.displayName}
                </span>
                <span className="font-mono text-sm font-semibold text-accent">{top1.score.toLocaleString()} đ</span>
              </div>
              <div className="w-full h-44 rounded-t-3xl bg-accent-soft border-t-4 border-accent flex flex-col items-center justify-start pt-4 shadow-card">
                <Trophy size={34} className="text-accent-text" weight="fill" />
                <span className="font-mono font-semibold text-accent-text text-2xl">#1</span>
                <span className="text-xs font-semibold text-accent-text bg-accent-soft px-2 py-0.5 rounded-full mt-1">
                  CHAMPION
                </span>
              </div>
            </motion.div>
          )}

          {/* Rank 3 (Bên phải) */}
          {top3 && (
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col items-center w-1/3 max-w-[170px]"
            >
              <div className="flex flex-col items-center mb-2">
                <div className="flex size-14 items-center justify-center rounded-full bg-accent text-accent-fg font-semibold text-xl border-2 border-accent shadow-md">
                  {top3.displayName?.substring(0, 1)}
                </div>
                <span className="font-semibold text-sm text-ink truncate max-w-[120px] mt-1">
                  {top3.displayName}
                </span>
                <span className="font-mono text-xs font-semibold text-accent">{top3.score.toLocaleString()} đ</span>
              </div>
              <div className="w-full h-24 rounded-t-3xl bg-accent-soft border-t-4 border-accent flex flex-col items-center justify-start pt-2 shadow-card">
                <Medal size={24} className="text-accent-text" weight="fill" />
                <span className="font-mono font-semibold text-accent-text text-base">#3</span>
              </div>
            </motion.div>
          )}
        </div>

        {/* LẦN 10: Match MVP Analytics Awards */}
        {top1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3.5 p-4 rounded-card border border-accent bg-accent-soft">
              <div className="flex size-11 items-center justify-center rounded-field bg-accent text-accent-fg font-bold shrink-0">
                <Lightning size={24} weight="fill" />
              </div>
              <div>
                <span className="text-xs font-semibold text-accent-text tracking-wider">Speed Demon</span>
                <p className="text-xs font-bold text-ink truncate">{top1.displayName} ({top1.score}đ)</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 p-4 rounded-card border border-accent/30 bg-accent/10">
              <div className="flex size-11 items-center justify-center rounded-field bg-accent text-accent-fg font-bold shrink-0">
                <Flame size={24} weight="fill" />
              </div>
              <div>
                <span className="text-xs font-semibold text-accent tracking-wider">Streak Master</span>
                <p className="text-xs font-bold text-ink truncate">{top1.displayName} ({top1.correctCount} câu đúng)</p>
              </div>
            </div>
          </div>
        )}

        {/* Bảng xếp hạng từ hạng 4 trở đi */}
        {remainingPlayers.length > 0 && (
          <div className="rounded-card border border-line bg-surface overflow-hidden shadow-card">
            <div className="px-5 py-3 border-b border-line bg-surface-2 text-xs font-semibold text-muted">
              Thành viên khác
            </div>
            <div className="divide-y divide-line">
              {remainingPlayers.map((p, idx) => (
                <div
                  key={p.userId}
                  className={cn(
                    "flex items-center justify-between p-4 text-sm font-semibold",
                    p.userId === currentUserId && "bg-accent/10 font-bold",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-semibold text-muted text-xs">#{idx + 4}</span>
                    <span className="text-ink">{p.displayName}</span>
                  </div>
                  <div className="flex items-center gap-3 font-mono">
                    <span className="text-xs text-muted">{p.correctCount}/{room.questions.length} đúng</span>
                    <span className="font-semibold text-accent">{p.score.toLocaleString()} đ</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="flex justify-center mt-2">
          <button
            type="button"
            onClick={handleLeaveRoom}
            className="inline-flex items-center gap-2 rounded-full bg-accent text-accent-fg hover:bg-accent-hover px-10 py-4 text-sm font-semibold shadow-card transition-all cursor-pointer active:scale-95"
          >
            Quay Lại Màn Hình Phòng
          </button>
        </div>
      </motion.div>
    );
  }

  return null;
}
