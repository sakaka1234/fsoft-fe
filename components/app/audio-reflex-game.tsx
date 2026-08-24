"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { SpeakerHigh } from "@phosphor-icons/react/SpeakerHigh";
import { Trophy } from "@phosphor-icons/react/Trophy";
import { Lightning } from "@phosphor-icons/react/Lightning";
import { CheckCircle } from "@phosphor-icons/react/CheckCircle";
import { XCircle } from "@phosphor-icons/react/XCircle";
import { ArrowCounterClockwise } from "@phosphor-icons/react/ArrowCounterClockwise";
import { GameController } from "@phosphor-icons/react/GameController";
import { Ranking } from "@phosphor-icons/react/Ranking";
import { Timer } from "@phosphor-icons/react/Timer";
import { Lightbulb } from "@phosphor-icons/react/Lightbulb";
import { WarningCircle } from "@phosphor-icons/react/WarningCircle";
import { Waveform } from "@phosphor-icons/react/Waveform";

import {
  type AudioQuestionItem,
  type AudioReflexGameResponse,
  type AudioReflexLeaderboardEntry,
  getAudioReflexLeaderboard,
  startAudioReflexGame,
  submitAudioReflexResult,
} from "@/lib/api/games";
import { cn } from "@/lib/cn";

/* ---------------------------------------------------------------------------
   Helpers
   ------------------------------------------------------------------------- */

function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Generates a masked word hint (e.g. "P _ o _ a _ l _") */
function generateMaskedWord(word: string): string {
  if (!word) return "";
  const chars = word.split("");
  return chars
    .map((char, index) => {
      if (char === " " || char === "-") return char;
      if (index === 0) return char;
      if (index === chars.length - 1 && chars.length > 3) return char;
      const reveal = (index * 7 + word.length * 3) % 4 === 0;
      return reveal ? char : "_";
    })
    .join(" ");
}

/* ---------------------------------------------------------------------------
   Props
   ------------------------------------------------------------------------- */

interface Props {
  deckId: number;
  deckTitle: string;
}

/* ---------------------------------------------------------------------------
   Phase: lobby | playing | result
   ------------------------------------------------------------------------- */

type Phase = "lobby" | "playing" | "result";

interface GameState {
  questions: AudioQuestionItem[];
  currentIndex: number;
  score: number;
  combo: number;
  maxCombo: number;
  correctAnswers: number;
  selectedOptionId: number | null;
  answered: boolean;
  startedAt: number; // Date.now()
  timeLeft: number; // giây còn lại mỗi câu
}

const TIME_PER_QUESTION = 10; // giây
const COMBO_THRESHOLD = 3; // bắt đầu nhân điểm khi combo >= 3
const OPTION_LETTERS = ["A", "B", "C", "D"];

/* ---------------------------------------------------------------------------
   Leaderboard sub-component
   ------------------------------------------------------------------------- */

function Leaderboard({
  entries,
  loading,
}: {
  entries: AudioReflexLeaderboardEntry[];
  loading: boolean;
}) {
  return (
    <div className="mt-4 rounded-card border border-line bg-surface overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-line bg-surface-2/60">
        <Trophy size={16} className="text-accent-text" weight="fill" />
        <span className="text-xs font-bold text-ink tracking-wide">Bảng xếp hạng</span>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2 p-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-9 animate-pulse rounded-field bg-surface-2" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1 py-8 text-muted text-sm">
          <Ranking size={28} className="opacity-40" />
          <p>Chưa có ai chơi. Hãy là người đầu tiên!</p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {entries.map((entry, i) => (
            <li
              key={entry.userId + "-" + i}
              className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-surface-2/50"
            >
              <span
                className={cn(
                  "w-6 text-center font-mono font-bold tabular-nums",
                  entry.rank === 1 && "text-accent-text",
                  entry.rank === 2 && "text-muted",
                  entry.rank === 3 && "text-accent-text",
                  entry.rank > 3 && "text-muted",
                )}
              >
                {entry.rank}
              </span>
              <span className="flex-1 truncate font-medium text-ink">
                {entry.userName}
              </span>
              <span className="font-mono text-xs text-muted">
                {entry.accuracy}%
              </span>
              <span className="font-mono font-semibold text-accent">
                {entry.score.toLocaleString()} đ
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Main Component
   ------------------------------------------------------------------------- */

export function AudioReflexGame({ deckId, deckTitle }: Props) {
  const [phase, setPhase] = useState<Phase>("lobby");
  const [leaderboard, setLeaderboard] = useState<AudioReflexLeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [gameData, setGameData] = useState<AudioReflexGameResponse | null>(null);
  const [gameLoading, setGameLoading] = useState(false);
  const [gameError, setGameError] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  const [gs, setGs] = useState<GameState | null>(null);
  const [showHint, setShowHint] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gameStartTime = useRef<number>(0);

  /* --- Tải bảng xếp hạng --- */
  const loadLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true);
    try {
      const data = await getAudioReflexLeaderboard(deckId);
      setLeaderboard(data ?? []);
    } catch {
      setLeaderboard([]);
    } finally {
      setLeaderboardLoading(false);
    }
  }, [deckId]);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  /* --- Đồng hồ đếm ngược --- */
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleTimeout = useCallback(() => {
    stopTimer();
    setGs((prev) => {
      if (!prev || prev.answered) return prev;
      return { ...prev, answered: true, selectedOptionId: -1, combo: 0 };
    });
  }, [stopTimer]);

  const startTimer = useCallback(() => {
    stopTimer();
    timerRef.current = setInterval(() => {
      setGs((prev) => {
        if (!prev) return prev;
        if (prev.timeLeft <= 1) {
          stopTimer();
          return { ...prev, timeLeft: 0 };
        }
        return { ...prev, timeLeft: prev.timeLeft - 1 };
      });
    }, 1000);
  }, [stopTimer]);

  // Tự động hết giờ khi timeLeft = 0
  useEffect(() => {
    if (gs?.timeLeft === 0 && !gs.answered) {
      handleTimeout();
    }
  }, [gs?.timeLeft, gs?.answered, handleTimeout]);

  // Chuyển câu tiếp theo sau khi trả lời
  useEffect(() => {
    if (!gs?.answered) return;
    const delay = setTimeout(() => {
      stopTimer();
      setShowHint(false);
      setGs((prev) => {
        if (!prev) return prev;
        const nextIndex = prev.currentIndex + 1;
        if (nextIndex >= prev.questions.length) {
          return prev; // Kết thúc game
        }
        const nextQ = prev.questions[nextIndex];
        speak(nextQ.word);
        startTimer();
        return {
          ...prev,
          currentIndex: nextIndex,
          selectedOptionId: null,
          answered: false,
          timeLeft: TIME_PER_QUESTION,
        };
      });
    }, 1300);
    return () => clearTimeout(delay);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gs?.answered, gs?.currentIndex]);

  // Phát hiện kết thúc game
  useEffect(() => {
    if (!gs?.answered) return;
    if (gs.currentIndex >= gs.questions.length - 1) {
      const delay = setTimeout(() => {
        stopTimer();
        setPhase("result");
        handleSubmitResult(gs);
      }, 1400);
      return () => clearTimeout(delay);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gs?.answered, gs?.currentIndex, gs?.questions.length]);

  /* --- Bắt đầu game --- */
  async function handleStart() {
    setGameLoading(true);
    setGameError(null);
    setShowHint(false);
    try {
      const data = await startAudioReflexGame(deckId);
      setGameData(data);
      const first = data.questions[0];
      gameStartTime.current = Date.now();
      setGs({
        questions: data.questions,
        currentIndex: 0,
        score: 0,
        combo: 0,
        maxCombo: 0,
        correctAnswers: 0,
        selectedOptionId: null,
        answered: false,
        startedAt: Date.now(),
        timeLeft: TIME_PER_QUESTION,
      });
      setPhase("playing");
      speak(first.word);
      startTimer();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Không thể tải game. Vui lòng thử lại!";
      setGameError(msg);
    } finally {
      setGameLoading(false);
    }
  }

  /* --- Chọn đáp án --- */
  function handleAnswer(optionId: number) {
    if (!gs || gs.answered) return;
    stopTimer();

    const currentQ = gs.questions[gs.currentIndex];
    const isCorrect = optionId === currentQ.correctOptionId;

    setGs((prev) => {
      if (!prev) return prev;
      const newCombo = isCorrect ? prev.combo + 1 : 0;
      const newMaxCombo = Math.max(prev.maxCombo, newCombo);
      const multiplier = newCombo >= COMBO_THRESHOLD ? 1 + (newCombo - COMBO_THRESHOLD) * 0.5 : 1;
      const baseScore = isCorrect ? Math.max(100, prev.timeLeft * 15) : 0;
      const earned = Math.round(baseScore * multiplier);

      return {
        ...prev,
        answered: true,
        selectedOptionId: optionId,
        score: prev.score + earned,
        combo: newCombo,
        maxCombo: newMaxCombo,
        correctAnswers: prev.correctAnswers + (isCorrect ? 1 : 0),
      };
    });
  }

  /* --- Nộp kết quả --- */
  async function handleSubmitResult(state: GameState) {
    setSubmitLoading(true);
    try {
      const completionTime = (Date.now() - gameStartTime.current) / 1000;
      await submitAudioReflexResult({
        deckId,
        score: state.score,
        maxCombo: state.maxCombo,
        correctAnswers: state.correctAnswers,
        totalQuestions: state.questions.length,
        completionTime,
      });
      await loadLeaderboard();
    } catch {
      // Silent error handling
    } finally {
      setSubmitLoading(false);
    }
  }

  /* --- Chơi lại --- */
  function handleReplay() {
    stopTimer();
    setGs(null);
    setGameData(null);
    setShowHint(false);
    setPhase("lobby");
    loadLeaderboard();
  }

  /* --- Cleanup khi unmount --- */
  useEffect(() => {
    return () => {
      stopTimer();
      window.speechSynthesis?.cancel();
    };
  }, [stopTimer]);

  /* ===========================================================================
     RENDER: LOBBY
     ========================================================================= */
  if (phase === "lobby") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl mx-auto flex flex-col gap-6"
      >
        {/* Header Lobby */}
        <div className="flex flex-col items-center gap-3 text-center py-6">
          <div className="flex size-16 items-center justify-center rounded-card bg-accent/10 text-accent shadow-inner">
            <GameController size={36} weight="fill" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-ink">Thử Thách Phản Xạ Nghe</h2>
            <p className="mt-1 text-sm text-muted">
              Nghe âm thanh phát ra và chọn nghĩa chính xác trong{" "}
              <strong className="text-ink font-semibold">{TIME_PER_QUESTION} giây</strong>
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2.5 mt-2">
            {[
              { icon: <SpeakerHigh size={14} weight="fill" />, text: "Nghe & Đoán" },
              { icon: <Timer size={14} weight="fill" />, text: `${TIME_PER_QUESTION}s/câu` },
              { icon: <Lightning size={14} weight="fill" />, text: "Combo Thưởng" },
            ].map(({ icon, text }) => (
              <span
                key={text}
                className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-muted shadow-2xs"
              >
                {icon}
                {text}
              </span>
            ))}
          </div>

          {gameError && (
            <div className="mt-2 rounded-field border border-danger/30 bg-danger/5 px-4 py-2 text-xs font-medium text-danger">
              {gameError}
            </div>
          )}

          <button
            type="button"
            onClick={handleStart}
            disabled={gameLoading}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-accent px-8 py-3.5 text-sm font-semibold text-accent-fg shadow-card transition-all hover:bg-accent-hover active:scale-95 disabled:opacity-60"
          >
            {gameLoading ? (
              <span className="">Đang chuẩn bị...</span>
            ) : (
              <>
                <GameController size={18} weight="fill" />
                Vào Chơi Ngay
              </>
            )}
          </button>
        </div>

        <Leaderboard entries={leaderboard} loading={leaderboardLoading} />
      </motion.div>
    );
  }

  /* ===========================================================================
     RENDER: PLAYING
     ========================================================================= */
  if (phase === "playing" && gs) {
    const currentQ = gs.questions[gs.currentIndex];
    const progress = ((gs.currentIndex + 1) / gs.questions.length) * 100;
    const timerPct = (gs.timeLeft / TIME_PER_QUESTION) * 100;
    const isTimeout = gs.answered && gs.selectedOptionId === -1;

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-xl mx-auto w-full flex flex-col gap-4"
      >
        {/* HUD Header: Điểm + Số câu hỏi + Combo + Timer */}
        <div className="flex items-center justify-between gap-3 text-sm px-1">
          <div className="flex items-center gap-2.5 font-semibold text-ink">
            <Trophy size={20} className="text-accent-text drop-shadow-sm shrink-0" weight="fill" />
            <span className="font-mono text-xl font-semibold">{gs.score.toLocaleString()} đ</span>
            <span className="text-xs font-mono font-bold text-muted tabular-nums shrink-0 bg-surface border border-line px-2.5 py-0.5 rounded-full shadow-2xs">
              {gs.currentIndex + 1} / {gs.questions.length}
            </span>
          </div>

          {gs.combo >= 2 && (
            <motion.div
              key={gs.combo}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-1 rounded-full bg-accent-soft border border-accent px-3 py-0.5 text-xs font-semibold text-accent-text shadow-2xs"
            >
              <Lightning size={13} weight="fill" /> x{gs.combo} Combo!
            </motion.div>
          )}

          <div className="flex items-center gap-1.5 bg-surface border border-line px-3 py-1 rounded-full shadow-2xs">
            <Timer size={18} className={gs.timeLeft <= 3 ? "text-danger" : "text-muted"} />
            <span
              className={cn(
                "font-mono font-bold tabular-nums text-sm",
                gs.timeLeft <= 3 ? "text-danger font-semibold text-base" : "text-ink",
              )}
            >
              {gs.timeLeft}s
            </span>
          </div>
        </div>

        {/* Thanh đếm ngược */}
        <div className="h-2 w-full rounded-full bg-surface-2 overflow-hidden shadow-inner">
          <motion.div
            className={cn(
              "h-full rounded-full transition-colors",
              gs.timeLeft > 5 ? "bg-accent" : gs.timeLeft > 3 ? "bg-accent" : "bg-danger",
            )}
            animate={{ width: `${timerPct}%` }}
            transition={{ duration: 0.9, ease: "linear" }}
          />
        </div>

        {/* Question Card (KHUNG LOA THU GỌN CHUẨN MỚI) */}
        <AnimatePresence mode="wait">
          <motion.div
            key={gs.currentIndex}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="relative rounded-card border border-line bg-surface/90 backdrop-blur-md p-4 text-center shadow-card overflow-hidden"
          >
            {/* Warning Banner khi hết giờ */}
            {isTimeout && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="inline-flex items-center gap-1.5 rounded-full bg-danger/15 border border-danger/30 px-3.5 py-1 text-xs font-semibold text-danger mb-2 shadow-2xs"
              >
                <WarningCircle size={15} weight="fill" />
                HẾT THỜI GIAN!
              </motion.div>
            )}

            <div className="flex flex-col items-center gap-2">
              {/* Nút phát âm thanh thu nhỏ chuẩn mới */}
              <motion.button
                type="button"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => speak(currentQ.word)}
                className="group relative flex items-center justify-center gap-3 w-full py-4 px-4 rounded-card bg-accent/10 border border-accent/20 hover:bg-accent/15 transition-all cursor-pointer shadow-inner overflow-hidden"
              >
                <div className="relative flex size-12 items-center justify-center rounded-full bg-accent text-accent-fg shadow-md transition-transform shrink-0">
                  <SpeakerHigh size={24} weight="fill" />
                </div>

                <div className="flex items-center gap-1.5 text-xs font-semibold text-accent">
                  <Waveform size={16} />
                  <span>Nhấn để nghe âm thanh</span>
                </div>
              </motion.button>

              {/* Từ tiếng Anh sau khi trả lời */}
              {gs.answered && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 flex flex-col items-center gap-0.5"
                >
                  <h3 className="text-2xl font-semibold text-ink tracking-tight from-ink via-accent to-ink bg-clip-text text-transparent">
                    {currentQ.word}
                  </h3>
                  {currentQ.phonetic && (
                    <p className="font-mono text-xs text-muted font-bold">{currentQ.phonetic}</p>
                  )}
                  {currentQ.exampleSentence && (
                    <p className="text-xs text-muted italic max-w-sm mt-0.5">
                      &ldquo;{currentQ.exampleSentence}&rdquo;
                    </p>
                  )}
                </motion.div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Options Grid */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 mt-1">
          {currentQ.options.map((opt, idx) => {
            const isSelected = gs.selectedOptionId === opt.optionId;
            const isCorrect = opt.optionId === currentQ.correctOptionId;
            const showResult = gs.answered;
            const optionLetter = OPTION_LETTERS[idx] || "";

            let btnClass =
              "group relative flex items-center gap-3 rounded-card border p-3.5 text-sm font-semibold transition-all duration-200 cursor-pointer select-none text-left shadow-2xs";

            if (showResult) {
              if (isCorrect) {
                btnClass += " border-ok bg-ok-soft text-ok shadow-md";
              } else if (isSelected && !isCorrect) {
                btnClass += " border-danger bg-danger/15 text-danger";
              } else {
                btnClass += " border-line bg-surface text-muted opacity-40";
              }
            } else {
              btnClass +=
                " border-line bg-surface text-ink hover:border-accent hover:bg-accent/5 hover:shadow-md active:scale-[0.98]";
            }

            return (
              <motion.button
                key={opt.optionId}
                type="button"
                onClick={() => handleAnswer(opt.optionId)}
                disabled={gs.answered}
                whileHover={!gs.answered ? { scale: 1.01, y: -1 } : undefined}
                whileTap={!gs.answered ? { scale: 0.98 } : undefined}
                className={btnClass}
              >
                {/* Badge A, B, C, D */}
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold font-mono transition-colors",
                    showResult
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

                <span className="flex-1 font-medium text-sm md:text-base leading-snug">
                  {opt.text}
                </span>

                {showResult && isCorrect && (
                  <CheckCircle size={18} weight="fill" className="text-ok shrink-0" />
                )}
                {showResult && isSelected && !isCorrect && (
                  <XCircle size={18} weight="fill" className="text-danger shrink-0" />
                )}
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    );
  }

  /* ===========================================================================
     RENDER: RESULT
     ========================================================================= */
  if (phase === "result" && gs) {
    const accuracy = gs.questions.length > 0
      ? Math.round((gs.correctAnswers / gs.questions.length) * 100)
      : 0;
    const completionMs = Date.now() - gameStartTime.current;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-xl mx-auto flex flex-col gap-6"
      >
        <div className="flex flex-col items-center gap-4 rounded-card border border-line bg-surface p-8 text-center shadow-card">
          <div className="flex size-16 items-center justify-center rounded-full bg-accent-soft text-accent-text shadow-inner">
            <Trophy size={36} weight="fill" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted">Tổng điểm đạt được</p>
            <p className="text-5xl font-semibold tracking-tight text-ink mt-1">
              {gs.score.toLocaleString()}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 w-full max-w-sm mt-2 p-4 rounded-card bg-surface-2/60 border border-line">
            <div className="flex flex-col items-center gap-0.5">
              <p className="text-2xl font-bold text-ok">{accuracy}%</p>
              <p className="text-xs text-muted font-medium">Chính xác</p>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <p className="text-2xl font-bold text-accent-text">{gs.maxCombo}x</p>
              <p className="text-xs text-muted font-medium">Max combo</p>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <p className="text-2xl font-bold text-ink">{formatTime(completionMs)}</p>
              <p className="text-xs text-muted font-medium">Thời gian</p>
            </div>
          </div>

          <p className="text-sm font-medium text-muted mt-1">
            Đã trả lời đúng {gs.correctAnswers}/{gs.questions.length} câu hỏi
          </p>

          <button
            type="button"
            onClick={handleReplay}
            className="mt-2 inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3 text-sm font-semibold text-accent-fg shadow-card transition-all hover:bg-accent-hover active:scale-95 cursor-pointer"
          >
            <ArrowCounterClockwise size={16} weight="bold" />
            Chơi lại ngay
          </button>
        </div>

        {submitLoading ? (
          <div className="text-center text-xs text-muted">Đang lưu kết quả lên bảng xếp hạng...</div>
        ) : (
          <Leaderboard entries={leaderboard} loading={leaderboardLoading} />
        )}
      </motion.div>
    );
  }

  return null;
}
