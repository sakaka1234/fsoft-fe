"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Client } from "@stomp/stompjs";
import { Trophy } from "@phosphor-icons/react/Trophy";
import { Users } from "@phosphor-icons/react/Users";
import { Copy } from "@phosphor-icons/react/Copy";
import { Check } from "@phosphor-icons/react/Check";
import { Crown } from "@phosphor-icons/react/Crown";
import { SignOut } from "@phosphor-icons/react/SignOut";
import { Cards } from "@phosphor-icons/react/Cards";
import { WifiSlash } from "@phosphor-icons/react/WifiSlash";
import { Play } from "@phosphor-icons/react/Play";
import { ArrowLeft } from "@phosphor-icons/react/ArrowLeft";
import { Sparkle } from "@phosphor-icons/react/Sparkle";
import { Medal } from "@phosphor-icons/react/Medal";
import { Flame } from "@phosphor-icons/react/Flame";
import { MagnifyingGlass } from "@phosphor-icons/react/MagnifyingGlass";
import { Heart } from "@phosphor-icons/react/Heart";
import { Rocket } from "@phosphor-icons/react/Rocket";
import { SpeakerHigh } from "@phosphor-icons/react/SpeakerHigh";
import { CheckCircle } from "@phosphor-icons/react/CheckCircle";
import { GameController } from "@phosphor-icons/react/GameController";

import {
  type SpaceStrikerRoomState,
  type SpaceStrikerSocketPayload,
  createSpaceStrikerRoom,
  joinSpaceStrikerRoom,
  leaveSpaceStrikerRoom,
  selectPlayerDeckInSpaceStrikerRoom,
  startSpaceStrikerRoomGame,
  submitSpaceStrikerRoomAnswer,
} from "@/lib/api/games";
import { listMyDecks } from "@/lib/api/decks";
import type { DeckResponse } from "@/lib/api/types";
import { API_BASE_URL } from "@/lib/api/client";
import { getSession } from "@/lib/auth/session-store";
import { useSession } from "@/lib/auth/use-session";
import { cn } from "@/lib/cn";

/* ---------------------------------------------------------------------------
   Helpers
   ------------------------------------------------------------------------- */

function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.88;
  window.speechSynthesis.speak(utterance);
}

const QUESTION_TIME_LIMIT = 15;
const MAX_LIVES = 3;
/** Vị trí xuất phát rải đều cho tối đa 4 quái — sau đó mỗi con tự di chuyển độc lập, không cố định cột nữa. */
const SPAWN_POSITIONS = [16, 40, 60, 84];

type LaserShot = {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  hit: boolean;
};

type FloatingText = {
  id: string;
  label: string;
  tone: "good" | "bad";
};

/**
 * Quái tự di chuyển ngang độc lập, dội lại khi chạm biên trái/phải, đồng thời rơi dần
 * xuống theo thời gian câu hỏi. Vị trí thật (x,y) được cập nhật ra ngoài qua onPositionUpdate
 * để phi thuyền luôn nhắm bắn đúng chỗ con quái đang đứng, không phải cột cố định.
 */
function FallingEnemy({
  optionId,
  text,
  spawnX,
  running,
  exploding,
  disabled,
  timeLimitSeconds,
  onClick,
  onPositionUpdate,
}: {
  optionId: number;
  text: string;
  spawnX: number;
  running: boolean;
  exploding: boolean;
  disabled: boolean;
  timeLimitSeconds: number;
  onClick: (optionId: number, x: number, y: number) => void;
  onPositionUpdate: (optionId: number, x: number, y: number) => void;
}) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const posRef = useRef({
    x: spawnX,
    y: -8,
    vx: (Math.random() < 0.5 ? -1 : 1) * (9 + Math.random() * 7), // %/giây ngang
  });
  const runningRef = useRef(running);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef(0);
  const onPositionUpdateRef = useRef(onPositionUpdate);

  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  useEffect(() => {
    onPositionUpdateRef.current = onPositionUpdate;
  }, [onPositionUpdate]);

  useEffect(() => {
    const fallSpeedPerSec = 82 / timeLimitSeconds; // rơi tới gần đáy đúng lúc hết giờ

    function applyPosition() {
      if (elRef.current) {
        elRef.current.style.left = `${posRef.current.x}%`;
        elRef.current.style.top = `${posRef.current.y}%`;
      }
      onPositionUpdateRef.current(optionId, posRef.current.x, posRef.current.y);
    }

    applyPosition();
    lastTsRef.current = performance.now();

    function tick(now: number) {
      const dt = Math.min(0.05, (now - lastTsRef.current) / 1000);
      lastTsRef.current = now;

      if (runningRef.current) {
        const p = posRef.current;
        p.x += p.vx * dt;
        if (p.x <= 7) {
          p.x = 7;
          p.vx = Math.abs(p.vx); // dội sang phải
        } else if (p.x >= 93) {
          p.x = 93;
          p.vx = -Math.abs(p.vx); // dội sang trái
        }
        p.y = Math.min(78, p.y + fallSpeedPerSec * dt);
        applyPosition();
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={elRef} className="absolute -translate-x-1/2" style={{ left: `${spawnX}%`, top: "-8%" }}>
      <motion.button
        type="button"
        disabled={disabled}
        onClick={() => onClick(optionId, posRef.current.x, posRef.current.y)}
        animate={
          exploding
            ? { scale: [1, 1.35, 0], opacity: [1, 1, 0], rotate: [0, 12, -10] }
            : { scale: 1, opacity: 1 }
        }
        transition={exploding ? { duration: 0.45, ease: "easeOut" } : { duration: 0.15 }}
        className={cn(
          "flex flex-col items-center gap-1 rounded-2xl border px-3 py-2.5 text-xs font-bold shadow-lg transition-colors cursor-pointer select-none",
          "border-violet-400/40 bg-violet-950/80 text-violet-100 hover:border-cyan-300 hover:bg-violet-900/90",
          disabled && "cursor-not-allowed opacity-70",
        )}
        style={{ maxWidth: "150px" }}
      >
        <span className="text-lg">👾</span>
        <span className="leading-snug text-center">{text}</span>
      </motion.button>
    </div>
  );
}

interface Props {
  deckId: number;
  deckTitle: string;
  onBackToSolo?: () => void;
}

export function SpaceStrikerMultiplayer({ deckId, onBackToSolo }: Props) {
  const session = useSession();
  const currentUserId = session?.user?.id ? String(session.user.id) : "";

  /* --- Room / lobby state --- */
  const [room, setRoom] = useState<SpaceStrikerRoomState | null>(null);
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [myDecks, setMyDecks] = useState<DeckResponse[]>([]);
  const [loadingMyDecks, setLoadingMyDecks] = useState(false);
  const [showDeckModal, setShowDeckModal] = useState(false);
  const [deckSearchQuery, setDeckSearchQuery] = useState("");

  /* --- Gameplay state --- */
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_LIMIT);
  const [shipX, setShipX] = useState(50); // vị trí phi thuyền theo % chiều ngang
  const [lasers, setLasers] = useState<LaserShot[]>([]);
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const [combo, setCombo] = useState(0);
  const [screenShake, setScreenShake] = useState(false);
  const [explodingOptionId, setExplodingOptionId] = useState<number | null>(null);
  const [locked, setLocked] = useState(false); // đã bắn cho câu này (chờ server), tạm khoá double-fire

  const stompClientRef = useRef<Client | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const keysDown = useRef<Set<string>>(new Set());
  const moveLoopRef = useRef<number | null>(null);
  /** Vị trí sống (x,y %) của từng quái theo optionId — cập nhật liên tục bởi FallingEnemy, dùng để nhắm laser đúng chỗ. */
  const enemyPositionsRef = useRef<Record<number, { x: number; y: number }>>({});

  const handleEnemyPositionUpdate = useCallback((optionId: number, x: number, y: number) => {
    enemyPositionsRef.current[optionId] = { x, y };
  }, []);

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

  const pushFloatingText = useCallback((label: string, tone: "good" | "bad") => {
    const id = `${Date.now()}-${Math.random()}`;
    setFloatingTexts((prev) => [...prev, { id, label, tone }]);
    setTimeout(() => {
      setFloatingTexts((prev) => prev.filter((t) => t.id !== id));
    }, 1400);
  }, []);

  /* --- WebSocket setup --- */
  const setupWebSocket = useCallback(
    (roomCode: string) => {
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
            client.subscribe(`/topic/space-room/${roomCode}`, (msg) => {
              try {
                const payload = JSON.parse(msg.body) as SpaceStrikerSocketPayload;
                handleSocketEvent(payload);
              } catch {
                // ignore parse error
              }
            });

            client.publish({
              destination: `/app/space-room/${roomCode}/join-socket`,
              headers: token ? { Authorization: `Bearer ${token}` } : {},
              body: "{}",
            });
          },
        });

        client.activate();
        stompClientRef.current = client;
      } catch {
        // graceful fallback — REST vẫn hoạt động độc lập
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [currentUserId],
  );

  /** Xử lý từng loại sự kiện — đây là nơi DUY NHẤT quyết định chuyển câu/hiệu ứng, không tự suy đoán ở nơi khác. */
  function handleSocketEvent(payload: SpaceStrikerSocketPayload) {
    const { type, room: nextRoom } = payload;

    if (type === "PLAYER_MISSED" || type === "PLAYER_ELIMINATED") {
      const isMe = Object.values(nextRoom.players).some(
        (p) => p.userId === currentUserId && p.lives < (room?.players[currentUserId]?.lives ?? MAX_LIVES),
      );
      if (isMe) {
        setCombo(0);
        setScreenShake(true);
        setTimeout(() => setScreenShake(false), 350);
        pushFloatingText(type === "PLAYER_ELIMINATED" ? "Bị loại!" : "Trượt! -1 máu", "bad");
      }
    }

    if (type === "NEXT_QUESTION" || type === "QUESTION_TIMEOUT_NEXT") {
      setLocked(false);
      setExplodingOptionId(null);
      setLasers([]);
    }

    setRoom(nextRoom);
  }

  /* Cleanup */
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (moveLoopRef.current) cancelAnimationFrame(moveLoopRef.current);
      if (stompClientRef.current) {
        stompClientRef.current.deactivate();
        stompClientRef.current = null;
      }
      window.speechSynthesis?.cancel();
    };
  }, []);

  /* Timer đồng bộ theo currentQuestionStartedAt từ server (không tự đếm độc lập) */
  useEffect(() => {
    if (!room || room.status !== "PLAYING") {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      return;
    }

    const currentQ = room.questions[room.currentQuestionIndex];
    if (currentQ) speak(currentQ.word);

    setLocked(room.questionResolved);

    const elapsedSeconds = Math.floor((Date.now() - room.currentQuestionStartedAt) / 1000);
    setTimeLeft(Math.max(0, QUESTION_TIME_LIMIT - elapsedSeconds));

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [room?.currentQuestionIndex, room?.currentQuestionStartedAt, room?.status]);

  /* Điều khiển phi thuyền bằng phím mũi tên (mượt, không giật khung) */
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") keysDown.current.add(e.key);
    }
    function onKeyUp(e: KeyboardEvent) {
      keysDown.current.delete(e.key);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    function loop() {
      if (keysDown.current.has("ArrowLeft")) {
        setShipX((x) => Math.max(6, x - 1.6));
      }
      if (keysDown.current.has("ArrowRight")) {
        setShipX((x) => Math.min(94, x + 1.6));
      }
      moveLoopRef.current = requestAnimationFrame(loop);
    }
    moveLoopRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      if (moveLoopRef.current) cancelAnimationFrame(moveLoopRef.current);
    };
  }, []);

  /* Kéo/chạm để di chuyển phi thuyền trên mobile */
  function handleTrackPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.buttons === 0 && e.pointerType !== "touch") return;
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    setShipX(Math.min(94, Math.max(6, pct)));
  }

  /* --- Actions --- */

  async function handleCreateRoom() {
    setLoading(true);
    setError(null);
    try {
      const state = await createSpaceStrikerRoom(deckId, 10);
      setRoom(state);
      setupWebSocket(state.roomCode);
      loadMyDecks();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không thể tạo phòng");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinRoom(codeToJoin?: string) {
    const code = (codeToJoin || joinCodeInput).trim().toUpperCase();
    if (!code) {
      setError("Vui lòng nhập mã phòng (6 ký tự)");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const state = await joinSpaceStrikerRoom(code);
      setRoom(state);
      setupWebSocket(state.roomCode);
      loadMyDecks();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không thể vào phòng. Kiểm tra lại mã!");
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectMyDeck(selectedDeckId: number | null) {
    if (!room) return;
    setLoading(true);
    try {
      const updated = await selectPlayerDeckInSpaceStrikerRoom(room.roomCode, selectedDeckId);
      setRoom(updated);
      setShowDeckModal(false);

      if (stompClientRef.current?.connected) {
        const token = getSession()?.token.accessToken;
        stompClientRef.current.publish({
          destination: `/app/space-room/${room.roomCode}/select-deck`,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: JSON.stringify({ deckId: selectedDeckId }),
        });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Lỗi chọn bộ thẻ");
    } finally {
      setLoading(false);
    }
  }

  async function handleStartGame() {
    if (!room) return;
    setLoading(true);
    setError(null);
    try {
      const updated = await startSpaceStrikerRoomGame(room.roomCode);
      setRoom(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không thể bắt đầu. Cần ít nhất 2 người!");
    } finally {
      setLoading(false);
    }
  }

  /** Bắn vào 1 con quái — luật first-hit-wins, chỉ hiệu ứng local, kết quả thật do server quyết định qua sự kiện. */
  function handleFire(optionId: number, atX: number, atY: number) {
    if (!room || room.status !== "PLAYING" || locked) return;
    const myLives = room.players[currentUserId]?.lives ?? MAX_LIVES;
    if (myLives <= 0) return;

    const currentQ = room.questions[room.currentQuestionIndex];
    const isCorrectGuess = currentQ && Number(optionId) === Number(currentQ.correctOptionId);

    const laserId = `${Date.now()}-${Math.random()}`;
    setLasers((prev) => [
      ...prev,
      { id: laserId, fromX: shipX, fromY: 92, toX: atX, toY: atY, hit: !!isCorrectGuess },
    ]);
    setTimeout(() => {
      setLasers((prev) => prev.filter((l) => l.id !== laserId));
    }, 220);

    if (isCorrectGuess) {
      setLocked(true);
      setExplodingOptionId(optionId);
      setCombo((c) => c + 1);
      pushFloatingText("Trúng đích!", "good");
    }

    // Gửi qua WebSocket (ưu tiên, độ trễ thấp)
    if (stompClientRef.current?.connected) {
      const token = getSession()?.token.accessToken;
      stompClientRef.current.publish({
        destination: `/app/space-room/${room.roomCode}/answer`,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: JSON.stringify({ cardId: optionId }),
      });
    }

    // Gửi REST dự phòng — response mới nhất từ server luôn là sự thật, ghi đè state cục bộ
    submitSpaceStrikerRoomAnswer(room.roomCode, optionId)
      .then((updated) => setRoom(updated))
      .catch(() => {
        /* WebSocket đã lo phần chính, bỏ qua lỗi REST dự phòng */
      });
  }

  async function handleLeaveRoom() {
    if (!room) return;
    try {
      await leaveSpaceStrikerRoom(room.roomCode);
    } catch {
      // silent
    } finally {
      if (stompClientRef.current) {
        stompClientRef.current.deactivate();
        stompClientRef.current = null;
      }
      setRoom(null);
    }
  }

  function copyRoomCode() {
    if (!room) return;
    navigator.clipboard.writeText(room.roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const filteredMyDecks = myDecks.filter((d) =>
    d.title.toLowerCase().includes(deckSearchQuery.toLowerCase()),
  );

  /* ===========================================================================
     RENDER 1: NO ROOM — Chọn tạo phòng / vào phòng
     ========================================================================= */
  if (!room) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl mx-auto flex flex-col gap-6"
      >
        <div className="flex flex-col items-center gap-4 text-center py-6">
          <div className="relative flex size-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-violet-500/20 via-accent/20 to-cyan-500/20 text-accent shadow-xl border border-accent/20 backdrop-blur-md">
            <Rocket size={40} weight="fill" className="text-accent drop-shadow-md -rotate-45" />
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              className="absolute -top-1 -right-1 text-cyan-400"
            >
              <Sparkle size={20} weight="fill" />
            </motion.div>
          </div>

          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-ink bg-gradient-to-r from-ink via-accent to-ink bg-clip-text text-transparent">
              Space Striker
            </h2>
            <p className="mt-1.5 text-sm text-muted max-w-md">
              Cùng bạn bè lái phi thuyền, ai bắn trúng từ vựng đúng nhanh nhất sẽ ghi điểm — bắn trượt mất máu, hết máu bị loại!
            </p>
          </div>

          {error && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mt-2 rounded-2xl border border-danger/30 bg-danger/10 px-5 py-2.5 text-xs font-semibold text-danger shadow-sm"
            >
              {error}
            </motion.div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full mt-4">
            <div className="group relative flex flex-col items-center justify-between gap-5 p-7 rounded-3xl border border-cyan-500/30 bg-gradient-to-b from-surface via-surface to-cyan-500/5 shadow-xl hover:shadow-2xl hover:border-cyan-500/60 transition-all duration-300 text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-500 shadow-inner group-hover:scale-110 transition-transform">
                  <Crown size={32} weight="fill" />
                </div>
                <div>
                  <h3 className="font-bold text-ink text-lg">Tạo Phòng Mới</h3>
                  <p className="text-xs text-muted mt-1 leading-relaxed">Trở thành Host, mời bạn bè cùng xuất kích</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCreateRoom}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-cyan-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-cyan-500/25 hover:from-cyan-600 hover:to-cyan-700 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? "Đang khởi tạo..." : "Tạo Phòng Mới"}
              </button>
            </div>

            <div className="group relative flex flex-col items-center justify-between gap-5 p-7 rounded-3xl border border-violet-500/30 bg-gradient-to-b from-surface via-surface to-violet-500/5 shadow-xl hover:shadow-2xl hover:border-violet-500/60 transition-all duration-300 text-center">
              <div className="flex flex-col items-center gap-3 w-full">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-500 shadow-inner group-hover:scale-110 transition-transform">
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
                  className="w-full text-center tracking-[0.25em] uppercase font-mono font-extrabold text-lg rounded-2xl border border-line bg-surface-2 px-4 py-2.5 text-ink focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 focus:outline-none transition-all"
                />
              </div>
              <button
                type="button"
                onClick={() => handleJoinRoom()}
                disabled={loading || !joinCodeInput.trim()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-violet-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-600/25 hover:bg-violet-700 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
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
     RENDER 2: LOBBY
     ========================================================================= */
  if (room.status === "WAITING") {
    const myPlayerState = room.players[currentUserId];

    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl mx-auto flex flex-col gap-6"
      >
        <div className="relative overflow-hidden flex flex-col items-center gap-4 rounded-3xl border border-line bg-surface p-7 text-center shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-2 text-xs font-extrabold text-accent uppercase tracking-widest bg-accent/10 px-3 py-1 rounded-full border border-accent/20">
            <Rocket size={14} weight="fill" /> Phòng Không Chiến
          </div>

          <div className="flex items-center gap-4 bg-surface-2 border border-line/80 px-8 py-3.5 rounded-2xl shadow-inner">
            <span className="font-mono text-4xl font-black tracking-[0.2em] text-ink">
              {room.roomCode}
            </span>
            <button
              type="button"
              onClick={copyRoomCode}
              className="flex size-10 items-center justify-center rounded-xl bg-surface border border-line text-muted hover:text-accent hover:border-accent transition-all active:scale-95 shadow-sm cursor-pointer"
              title="Copy mã phòng"
            >
              {copied ? <Check size={20} className="text-emerald-500" /> : <Copy size={20} />}
            </button>
          </div>
          <p className="text-xs text-muted font-medium">Chia sẻ mã 6 ký tự cho bạn bè để cùng xuất kích</p>

          {error && (
            <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-2 text-xs font-semibold text-danger">
              {error}
            </div>
          )}

          <div className="w-full mt-1 p-4 rounded-2xl border border-dashed border-accent/40 bg-accent/5 flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3 text-left">
              <div className="flex size-10 items-center justify-center rounded-xl bg-accent/15 text-accent shrink-0">
                <Cards size={22} weight="fill" />
              </div>
              <div>
                <p className="text-xs font-extrabold text-ink uppercase tracking-wider">
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

        <div className="rounded-3xl border border-line bg-surface overflow-hidden shadow-lg">
          <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-surface-2/70">
            <span className="text-xs font-extrabold uppercase tracking-wider text-ink flex items-center gap-2">
              <Users size={16} className="text-accent" /> Phi đội ({playersList.length}/20)
            </span>
            {isHost && (
              <span className="text-xs font-bold text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full flex items-center gap-1 border border-amber-500/20">
                <Crown size={14} weight="fill" /> Bạn là Host
              </span>
            )}
          </div>

          <ul className="divide-y divide-line">
            {playersList.map((p) => (
              <li key={p.userId} className="flex items-center justify-between p-4 text-sm hover:bg-surface-2/40 transition-colors">
                <div className="flex items-center gap-3.5">
                  <div className="relative">
                    <div className="flex size-11 items-center justify-center rounded-full bg-gradient-to-tr from-accent/20 to-violet-500/20 font-black text-accent text-base border border-accent/30 shadow-xs">
                      {p.displayName?.substring(0, 1) || "U"}
                    </div>
                    {!p.connected && (
                      <span
                        className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-danger text-white ring-2 ring-surface shadow-xs"
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
                        <span className="flex items-center gap-0.5 text-[0.65rem] font-black uppercase bg-amber-500/15 text-amber-600 px-2 py-0.5 rounded-full border border-amber-500/30">
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
                      <p className="text-xs text-muted opacity-75 mt-0.5 italic">Chưa chọn bộ thẻ đóng góp</p>
                    )}
                  </div>
                </div>

                <span
                  className={cn(
                    "text-xs font-bold px-3 py-1 rounded-full border",
                    p.connected
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                      : "bg-danger/10 border-danger/30 text-danger",
                  )}
                >
                  {p.connected ? "Sẵn sàng" : "Mất mạng"}
                </span>
              </li>
            ))}
          </ul>
        </div>

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
              className="inline-flex items-center gap-2 rounded-full bg-accent text-accent-fg hover:bg-accent-hover px-8 py-3.5 text-sm font-extrabold shadow-xl hover:shadow-2xl transition-all cursor-pointer disabled:opacity-50 active:scale-95"
            >
              <Play size={18} weight="fill" />
              {loading ? "Đang khởi tạo..." : "Xuất Kích"}
            </button>
          ) : (
            <div className="text-xs font-bold text-muted italic animate-pulse">
              Đang chờ Host bắt đầu trận đấu...
            </div>
          )}
        </div>

        {showDeckModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-md rounded-3xl border border-line bg-paper p-6 shadow-2xl overflow-hidden flex flex-col gap-4"
            >
              <div className="flex items-center justify-between border-b border-line pb-3">
                <h3 className="font-extrabold text-ink text-base flex items-center gap-2">
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

              <div className="relative w-full">
                <MagnifyingGlass size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  value={deckSearchQuery}
                  onChange={(e) => setDeckSearchQuery(e.target.value)}
                  placeholder="Tìm bộ thẻ của bạn..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-line bg-surface text-xs font-semibold text-ink focus:border-accent focus:outline-none"
                />
              </div>

              {loadingMyDecks ? (
                <div className="py-8 text-center text-xs text-muted animate-pulse font-semibold">
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
                            "w-full flex items-center justify-between p-3.5 rounded-2xl border text-left text-sm font-medium transition-all cursor-pointer shadow-2xs",
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
     RENDER 3: PLAYING — Màn chơi arcade chính
     ========================================================================= */
  if (room.status === "PLAYING") {
    const currentQ = room.questions[room.currentQuestionIndex];
    const myPlayer = room.players[currentUserId];
    const myLives = myPlayer?.lives ?? MAX_LIVES;
    const isCriticalTime = timeLeft <= 3;
    const sortedPlayers = [...playersList].sort((a, b) => b.score - a.score);

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-6xl mx-auto w-full flex flex-col gap-4"
      >
        {/* Thanh HUD phi đội — điểm/máu/kết nối từng người, cuộn ngang trên mobile */}
        <div className="flex items-center gap-2.5 overflow-x-auto pb-1 px-1">
          {sortedPlayers.map((p) => {
            const isMe = p.userId === currentUserId;
            return (
              <div
                key={p.userId}
                className={cn(
                  "flex shrink-0 items-center gap-2.5 rounded-2xl border px-3 py-2 shadow-2xs transition-all",
                  isMe ? "border-accent bg-accent/10 ring-2 ring-accent/25" : "border-line bg-surface",
                  p.lives <= 0 && "opacity-40 grayscale",
                )}
              >
                <div className="relative flex size-8 items-center justify-center rounded-full bg-gradient-to-tr from-accent/25 to-violet-500/25 text-xs font-black text-accent border border-accent/30">
                  {p.displayName?.substring(0, 1) || "U"}
                  {!p.connected && (
                    <span className="absolute -bottom-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-danger text-white ring-2 ring-surface">
                      <WifiSlash size={8} />
                    </span>
                  )}
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-[0.7rem] font-bold text-ink flex items-center gap-1">
                    {p.host && <Crown size={10} weight="fill" className="text-amber-500 shrink-0" />}
                    {p.displayName}
                    {isMe && <span className="text-accent">(Bạn)</span>}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-0.5">
                      {Array.from({ length: MAX_LIVES }).map((_, i) => (
                        <Heart
                          key={i}
                          size={11}
                          weight="fill"
                          className={i < p.lives ? "text-danger" : "text-line"}
                        />
                      ))}
                    </span>
                    <span className="font-mono text-[0.7rem] font-black text-muted">{p.score.toLocaleString()}đ</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Khung game arcade */}
        <motion.div
          animate={screenShake ? { x: [0, -10, 10, -6, 6, 0] } : { x: 0 }}
          transition={{ duration: 0.35 }}
          className="relative overflow-hidden rounded-[2rem] border border-violet-500/30 shadow-2xl"
          style={{
            background:
              "radial-gradient(ellipse at top, rgba(124,58,237,0.35), transparent 55%), radial-gradient(ellipse at bottom, rgba(6,182,212,0.25), transparent 55%), #0a0a14",
          }}
        >
          {/* Nền vũ trụ nhiều lớp: tinh vân trôi + hành tinh xa + sao lấp lánh */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {/* Tinh vân trôi chậm */}
            <motion.div
              animate={{ x: [0, 40, -20, 0], y: [0, -20, 15, 0] }}
              transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-1/4 -left-1/4 h-[70%] w-[70%] rounded-full opacity-40 blur-3xl"
              style={{ background: "radial-gradient(circle, rgba(168,85,247,0.5), transparent 65%)", mixBlendMode: "screen" }}
            />
            <motion.div
              animate={{ x: [0, -30, 25, 0], y: [0, 25, -15, 0] }}
              transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -bottom-1/4 -right-1/4 h-[65%] w-[65%] rounded-full opacity-35 blur-3xl"
              style={{ background: "radial-gradient(circle, rgba(6,182,212,0.5), transparent 65%)", mixBlendMode: "screen" }}
            />
            <motion.div
              animate={{ x: [0, 15, -25, 0], y: [0, -10, 10, 0] }}
              transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-1/3 right-1/4 h-[40%] w-[40%] rounded-full opacity-25 blur-3xl"
              style={{ background: "radial-gradient(circle, rgba(236,72,153,0.45), transparent 65%)", mixBlendMode: "screen" }}
            />

            {/* Hành tinh xa */}
            <div
              className="absolute top-6 right-8 size-10 rounded-full opacity-70"
              style={{ background: "radial-gradient(circle at 32% 32%, #fbbf24, #b45309 70%)", boxShadow: "0 0 18px 2px rgba(251,191,36,0.35)" }}
            />
            <div
              className="absolute bottom-10 left-10 size-6 rounded-full opacity-50"
              style={{ background: "radial-gradient(circle at 35% 35%, #a5b4fc, #4338ca 70%)", boxShadow: "0 0 12px 1px rgba(129,140,248,0.35)" }}
            />

            {/* Sao lấp lánh */}
            {Array.from({ length: 90 }).map((_, i) => {
              const size = i % 7 === 0 ? 2.4 : i % 3 === 0 ? 1.6 : 1;
              return (
                <motion.span
                  key={i}
                  className="absolute rounded-full bg-white"
                  style={{
                    top: `${(i * 29 + (i % 5) * 13) % 100}%`,
                    left: `${(i * 47 + (i % 7) * 11) % 100}%`,
                    width: size,
                    height: size,
                  }}
                  animate={{ opacity: [0.15, 0.9, 0.15] }}
                  transition={{
                    duration: 2 + (i % 5),
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: (i % 10) * 0.3,
                  }}
                />
              );
            })}
          </div>

          {/* HUD trên cùng: máu, combo, điểm, đồng hồ */}
          <div className="relative z-20 flex items-center justify-between px-5 pt-4">
            <div className="flex items-center gap-1.5">
              {Array.from({ length: MAX_LIVES }).map((_, i) => (
                <motion.span
                  key={i}
                  animate={i >= myLives ? { scale: [1, 0.6, 0] } : { scale: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <Heart
                    size={22}
                    weight="fill"
                    className={i < myLives ? "text-rose-500 drop-shadow-[0_0_6px_rgba(244,63,94,0.7)]" : "text-white/15"}
                  />
                </motion.span>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {combo > 1 && (
                <motion.div
                  key={combo}
                  initial={{ scale: 0.6, opacity: 0, y: -6 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  className="flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-400/40 px-3 py-1 text-amber-300 text-xs font-black shadow-[0_0_16px_rgba(251,191,36,0.35)]"
                >
                  <Flame size={14} weight="fill" /> Combo x{combo}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-black text-cyan-300 flex items-center gap-1.5">
                <Trophy size={16} weight="fill" className="text-amber-400" />
                {(myPlayer?.score ?? 0).toLocaleString()}đ
              </span>
              <span
                className={cn(
                  "font-mono text-sm font-black rounded-full px-2.5 py-0.5 border",
                  isCriticalTime
                    ? "text-rose-300 border-rose-400/50 bg-rose-500/20 animate-pulse"
                    : "text-white/80 border-white/15 bg-white/5",
                )}
              >
                {timeLeft}s
              </span>
            </div>
          </div>

          {/* Thanh tiến độ câu hỏi */}
          <div className="relative z-20 px-5 mt-2">
            <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-cyan-400 transition-all duration-500"
                style={{ width: `${((room.currentQuestionIndex + 1) / room.questions.length) * 100}%` }}
              />
            </div>
            <div className="mt-1 text-[0.65rem] font-mono text-white/50">
              Câu {room.currentQuestionIndex + 1}/{room.questions.length}
            </div>
          </div>

          {/* Câu hỏi / câu ví dụ khuyết từ */}
          {currentQ && (
            <div className="relative z-20 mx-5 mt-3 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm px-4 py-3 text-center">
              <button
                type="button"
                onClick={() => speak(currentQ.word)}
                className="inline-flex items-center gap-2 text-white/90 hover:text-cyan-300 transition-colors cursor-pointer"
              >
                <SpeakerHigh size={18} weight="fill" />
                <span className="text-sm font-semibold">
                  {currentQ.exampleSentence
                    ? currentQ.exampleSentence.replace(currentQ.word, "[ ? ]")
                    : "Nghe phát âm và bắn trúng đáp án"}
                </span>
              </button>
            </div>
          )}

          {/* Vùng chiến đấu: quái tự dội tường + tia laser đúng góc */}
          <div className="relative z-10 h-[300px] sm:h-[360px] mt-3">
            {currentQ?.options.map((opt, idx) => {
              const isExploding = explodingOptionId === opt.optionId;
              return (
                <FallingEnemy
                  key={`${room.currentQuestionIndex}-${opt.optionId}`}
                  optionId={opt.optionId}
                  text={opt.text}
                  spawnX={SPAWN_POSITIONS[idx] ?? 50}
                  running={!locked && myLives > 0}
                  exploding={isExploding}
                  disabled={locked || myLives <= 0}
                  timeLimitSeconds={QUESTION_TIME_LIMIT}
                  onClick={handleFire}
                  onPositionUpdate={handleEnemyPositionUpdate}
                />
              );
            })}

            {/* Tia laser bắn ra — vẽ đúng đường thẳng thật từ nòng súng tới đúng chỗ quái đang đứng */}
            <svg
              className="absolute inset-0 h-full w-full pointer-events-none z-20"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <AnimatePresence>
                {lasers.map((laser) => (
                  <motion.line
                    key={laser.id}
                    x1={laser.fromX}
                    y1={laser.fromY}
                    initial={{ x2: laser.fromX, y2: laser.fromY, opacity: 1 }}
                    animate={{ x2: laser.toX, y2: laser.toY, opacity: [1, 1, 0] }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    stroke={laser.hit ? "#22d3ee" : "#fb7185"}
                    strokeWidth={1.6}
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                    style={{
                      filter: laser.hit
                        ? "drop-shadow(0 0 4px #22d3ee)"
                        : "drop-shadow(0 0 3px #fb7185)",
                    }}
                  />
                ))}
              </AnimatePresence>
            </svg>

            {/* Floating text: Trúng đích / Trượt / Bị loại */}
            <AnimatePresence>
              {floatingTexts.map((t) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 0, scale: 0.8 }}
                  animate={{ opacity: 1, y: -30, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.2 }}
                  className={cn(
                    "absolute left-1/2 top-1/3 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-black shadow-lg",
                    t.tone === "good"
                      ? "bg-cyan-500/90 text-white shadow-cyan-500/40"
                      : "bg-rose-500/90 text-white shadow-rose-500/40",
                  )}
                >
                  {t.label}
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Đường ray điều khiển + phi thuyền */}
            <div
              ref={trackRef}
              onPointerMove={handleTrackPointerMove}
              onPointerDown={handleTrackPointerMove}
              className="absolute inset-x-0 bottom-2 h-16 touch-none"
            >
              <motion.div
                animate={{ left: `${shipX}%` }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="absolute -translate-x-1/2 bottom-2 flex flex-col items-center"
              >
                <Rocket
                  size={30}
                  weight="fill"
                  className={cn(
                    "text-cyan-300 drop-shadow-[0_0_10px_rgba(34,211,238,0.6)]",
                    myLives <= 0 && "text-white/20 grayscale",
                  )}
                />
              </motion.div>
            </div>
          </div>

          {myLives <= 0 && (
            <div className="relative z-20 pb-4 text-center text-xs font-bold text-rose-300 uppercase tracking-widest">
              Phi thuyền của bạn đã bị hạ — theo dõi trận đấu tới khi kết thúc
            </div>
          )}
          {locked && myLives > 0 && (
            <div className="relative z-20 pb-4 text-center text-xs font-bold text-cyan-300 uppercase tracking-widest animate-pulse">
              Trúng đích! Đang chờ chuyển câu tiếp theo...
            </div>
          )}
        </motion.div>

        <p className="text-center text-[0.7rem] text-muted">
          Dùng phím <kbd className="px-1.5 py-0.5 rounded bg-surface-2 border border-line font-mono">←</kbd>{" "}
          <kbd className="px-1.5 py-0.5 rounded bg-surface-2 border border-line font-mono">→</kbd> hoặc kéo/chạm để di chuyển, bấm vào quái để bắn.
        </p>
      </motion.div>
    );
  }

  /* ===========================================================================
     RENDER 4: FINISHED — Bảng xếp hạng cuối
     ========================================================================= */
  const finalRanking = [...playersList].sort((a, b) => b.score - a.score);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-xl mx-auto flex flex-col gap-6"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex size-16 items-center justify-center rounded-3xl bg-gradient-to-tr from-amber-500/20 to-cyan-500/20 text-amber-500 border border-amber-500/20 shadow-xl">
          <Trophy size={34} weight="fill" />
        </div>
        <h2 className="text-2xl font-black text-ink">Trận đấu kết thúc!</h2>
        <p className="text-sm text-muted">Bảng xếp hạng cuối cùng của phi đội</p>
      </div>

      <div className="rounded-3xl border border-line bg-surface overflow-hidden shadow-lg divide-y divide-line">
        {finalRanking.map((p, rank) => {
          const isMe = p.userId === currentUserId;
          return (
            <div
              key={p.userId}
              className={cn(
                "flex items-center justify-between px-5 py-4",
                isMe && "bg-accent/5",
                rank === 0 && "bg-gradient-to-r from-amber-500/10 to-transparent",
              )}
            >
              <div className="flex items-center gap-3.5">
                <div
                  className={cn(
                    "flex size-9 items-center justify-center rounded-xl font-mono text-sm font-black",
                    rank === 0
                      ? "bg-amber-500 text-white"
                      : rank === 1
                        ? "bg-slate-400 text-white"
                        : rank === 2
                          ? "bg-amber-700 text-white"
                          : "bg-surface-2 text-muted",
                  )}
                >
                  {rank < 3 ? <Medal size={16} weight="fill" /> : rank + 1}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-ink text-sm">{p.displayName}</span>
                    {isMe && <span className="text-[0.65rem] text-accent font-bold">(Bạn)</span>}
                    {p.lives <= 0 && (
                      <span className="text-[0.6rem] font-bold text-danger bg-danger/10 px-1.5 py-0.5 rounded-full border border-danger/20">
                        Bị loại
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted mt-0.5">{p.correctCount} câu bắn trúng</p>
                </div>
              </div>
              <span className="font-mono font-black text-ink text-sm">{p.score.toLocaleString()}đ</span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={handleLeaveRoom}
          className="inline-flex items-center gap-2 rounded-full bg-accent text-accent-fg hover:bg-accent-hover px-6 py-3 text-sm font-bold shadow-lg transition-all cursor-pointer active:scale-95"
        >
          <SignOut size={16} /> Về Sảnh Chờ
        </button>
      </div>
    </motion.div>
  );
}