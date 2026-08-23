"use client";

import { useEffect, useState, useRef } from "react";
import { SpeakerHigh } from "@phosphor-icons/react/SpeakerHigh";
import { Image as ImageIcon } from "@phosphor-icons/react/Image";
import { CheckCircle } from "@phosphor-icons/react/CheckCircle";
import { XCircle } from "@phosphor-icons/react/XCircle";

import type { CardResponse } from "@/lib/api/types";
import { reviewFsrsCard } from "@/lib/api/fsrs";
import { cn } from "@/lib/cn";
import { CardContextBlock } from "@/components/app/card-context-block";

type FsrsStudyModeProps = {
  cards: CardResponse[];
  onFinished?: () => void;
  onCardReviewed?: () => void;
};

/** Calculates estimated FSRS next review interval string based on rating & current card state */
function getEstimatedFsrsInterval(rating: number, repetitions = 0): string {
  if (rating === 1) return "10m";
  if (repetitions === 0) {
    switch (rating) {
      case 2: return "1d";
      case 3: return "2d";
      case 4: return "8d";
      default: return "1d";
    }
  }
  switch (rating) {
    case 2: return "2d";
    case 3: return "5d";
    case 4: return "12d";
    default: return "1d";
  }
}

export function FsrsStudyMode({ cards, onFinished, onCardReviewed }: FsrsStudyModeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [backStep, setBackStep] = useState<"initial" | "rating" | "test">("initial");
  const [typedInput, setTypedInput] = useState("");
  const [isAnswerChecked, setIsAnswerChecked] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const currentCard = cards[currentIndex];

  // Auto focus hidden text input when entering test mode
  useEffect(() => {
    if (backStep === "test" && hiddenInputRef.current) {
      hiddenInputRef.current.focus();
    }
  }, [backStep]);

  // Play audio voice test when entering test mode
  useEffect(() => {
    if (backStep === "test" && currentCard) {
      speakAudio("us");
    }
  }, [backStep, currentIndex]);

  // Keyboard navigation & shortcuts
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        document.activeElement?.tagName === "INPUT" &&
        document.activeElement !== hiddenInputRef.current
      ) {
        return;
      }

      if (!isFlipped) {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          setIsFlipped(true);
        }
        return;
      }

      // Card is flipped
      if (backStep === "initial") {
        if (event.key === "Tab") {
          event.preventDefault();
          setBackStep("rating"); // "Đã thuộc"
        } else if (event.key === "Enter") {
          event.preventDefault();
          setBackStep("test"); // "Chưa nhớ"
        }
      } else if (backStep === "rating" || isAnswerChecked) {
        if (["1", "2", "3", "4"].includes(event.key)) {
          event.preventDefault();
          handleRatingSelect(Number(event.key));
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFlipped, backStep, isAnswerChecked, currentIndex, cards.length]);

  if (!currentCard || cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-surface border border-line rounded-3xl">
        <CheckCircle size={48} className="text-emerald-500 mb-3" weight="fill" />
        <h3 className="text-xl font-bold text-ink">Hoàn thành bài học!</h3>
        <p className="text-sm text-muted mt-1">Bạn đã học xong tất cả các thẻ trong lượt này.</p>
        {onFinished ? (
          <button
            type="button"
            onClick={onFinished}
            className="mt-4 px-5 py-2.5 rounded-full bg-accent text-accent-fg text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Quay lại
          </button>
        ) : null}
      </div>
    );
  }

  function speakAudio(accent: "uk" | "us", e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    if (currentCard.audioUrl) {
      setIsPlayingAudio(accent);
      const audio = new Audio(currentCard.audioUrl);
      audio.play().catch(() => speakWebSpeech(currentCard.word, accent));
      audio.onended = () => setIsPlayingAudio(null);
    } else {
      speakWebSpeech(currentCard.word, accent);
    }
  }

  function speakWebSpeech(text: string, accent: "uk" | "us") {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = accent === "uk" ? "en-GB" : "en-US";
    utterance.rate = 0.9;
    setIsPlayingAudio(accent);
    utterance.onend = () => setIsPlayingAudio(null);
    utterance.onerror = () => setIsPlayingAudio(null);
    window.speechSynthesis.speak(utterance);
  }

  /** Submits FSRS rating and IMMEDIATELY jumps to next card */
  async function handleRatingSelect(rating: number) {
    if (busy || !currentCard) return;
    setBusy(true);

    // Fire API call in background
    reviewFsrsCard(currentCard.id, rating).catch(() => {});
    if (onCardReviewed) onCardReviewed();

    // Immediately reset states and jump to next card
    setIsFlipped(false);
    setBackStep("initial");
    setTypedInput("");
    setIsAnswerChecked(false);
    setBusy(false);

    if (currentIndex < cards.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      if (onFinished) onFinished();
    }
  }

  /** Handles typing input change into interactive letter slots */
  function handleTypingChange(value: string) {
    if (isAnswerChecked) return;
    setTypedInput(value);
    const cleanWord = currentCard.word.trim().toLowerCase();
    const cleanTyped = value.trim().toLowerCase();

    if (cleanTyped.length >= cleanWord.length || cleanTyped === cleanWord) {
      setIsAnswerChecked(true);
    }
  }

  /** Renders interactive letter slots */
  function renderLetterSlots() {
    const word = currentCard.word;
    if (!word) return null;
    const wordChars = word.split("");
    const typedChars = typedInput.split("");
    const isCorrect = typedInput.trim().toLowerCase() === word.trim().toLowerCase();

    return (
      <div className="flex flex-wrap items-center justify-center gap-2 font-mono">
        {wordChars.map((char, index) => {
          const isSpaceOrPunct = /[^a-zA-Z0-9]/.test(char);
          if (isSpaceOrPunct) {
            return (
              <span key={index} className="mx-1 text-muted text-xl">
                {char}
              </span>
            );
          }

          let charToShow = "_";
          let isTyped = false;

          if (index < typedChars.length) {
            charToShow = typedChars[index];
            isTyped = true;
          } else if (index === 0 || (index === wordChars.length - 1 && wordChars.length > 3)) {
            charToShow = char;
          }

          return (
            <span
              key={index}
              className={cn(
                "flex h-11 w-9 sm:h-12 sm:w-10 items-center justify-center rounded-2xl border-2 text-xl font-bold uppercase transition-all shadow-2xs",
                isAnswerChecked
                  ? isCorrect
                    ? "border-emerald-500 bg-emerald-500/15 text-emerald-600 font-black scale-105"
                    : "border-rose-500 bg-rose-500/15 text-rose-600 font-black scale-105"
                  : isTyped
                  ? "border-accent bg-accent/10 text-accent-text font-black scale-105"
                  : "border-line bg-surface-2 text-muted",
              )}
            >
              {charToShow}
            </span>
          );
        })}
      </div>
    );
  }

  const isTypedCorrect = typedInput.trim().toLowerCase() === currentCard.word.trim().toLowerCase();

  return (
    <div className="flex flex-col items-center gap-6 py-2">
      {/* Progress Header */}
      <div className="w-full max-w-xl flex items-center justify-between px-2 text-xs font-semibold text-muted">
        <span>Thẻ {currentIndex + 1} / {cards.length}</span>
        <div className="h-2 flex-1 max-w-[200px] bg-surface-2 rounded-full overflow-hidden mx-3 border border-line">
          <div
            className="h-full bg-accent transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }}
          />
        </div>
        <span className="font-mono text-accent-text">{Math.round(((currentIndex + 1) / cards.length) * 100)}%</span>
      </div>

      {/* 3D Flip Card Container */}
      <div
        className="w-full max-w-md sm:max-w-lg md:max-w-xl mx-auto cursor-pointer select-none"
        style={{ perspective: "1000px" }}
        onClick={() => setIsFlipped((prev) => !prev)}
        title="Nhấn để lật thẻ"
      >
        <div
          className="relative min-h-[300px] md:min-h-[340px] w-full transition-transform duration-700 ease-in-out"
          style={{
            transformStyle: "preserve-3d",
            transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          {/* FRONT SIDE (Mặt trước - Chuẩn 100% Xem Card) */}
          <div
            className="absolute inset-0 flex h-full w-full flex-col justify-center rounded-2xl border border-line bg-surface p-5 shadow-md md:p-6"
            style={{ backfaceVisibility: "hidden" }}
          >
            <div className="grid grid-cols-1 items-center gap-5 md:grid-cols-2">
              {/* Left Column: English Word & Audio */}
              <div className="flex flex-col items-center justify-center gap-3 text-center md:items-start md:text-left">
                <div className="flex flex-wrap items-baseline justify-center gap-2 md:justify-start">
                  <h2 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl md:text-4xl">
                    {currentCard.word}
                  </h2>
                  {currentCard.partOfSpeech ? (
                    <span className="text-base font-medium text-muted md:text-lg">
                      ({currentCard.partOfSpeech})
                    </span>
                  ) : null}
                </div>

                {/* Audio buttons (Blue UK & Red US) */}
                <div className="flex flex-col gap-2 pt-1">
                  <button
                    type="button"
                    onClick={(e) => speakAudio("uk", e)}
                    className="group flex items-center gap-2.5 rounded-lg px-3 py-1.5 transition-colors hover:bg-blue-500/10"
                    title="Nghe phát âm (UK)"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full text-blue-600 transition-transform group-hover:scale-110">
                      <SpeakerHigh
                        size={22}
                        weight="bold"
                        className={cn(isPlayingAudio === "uk" ? "animate-bounce" : "")}
                      />
                    </span>
                    <span className="font-mono text-base font-semibold text-ink md:text-lg">
                      {currentCard.phonetic ? currentCard.phonetic : `/${currentCard.word}/`}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => speakAudio("us", e)}
                    className="group flex items-center gap-2.5 rounded-lg px-3 py-1.5 transition-colors hover:bg-red-500/10"
                    title="Nghe phát âm (US)"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full text-red-600 transition-transform group-hover:scale-110">
                      <SpeakerHigh
                        size={22}
                        weight="bold"
                        className={cn(isPlayingAudio === "us" ? "animate-bounce" : "")}
                      />
                    </span>
                    <span className="font-mono text-base font-semibold text-ink md:text-lg">
                      {currentCard.phonetic ? currentCard.phonetic : `/${currentCard.word}/`}
                    </span>
                  </button>
                </div>
              </div>

              {/* Right Column: Card Image */}
              <div className="flex h-full w-full items-center justify-center">
                {currentCard.imageUrl ? (
                  <div className="relative flex h-[140px] md:h-[180px] w-full items-center justify-center overflow-hidden rounded-xl">
                    <img
                      src={currentCard.imageUrl}
                      alt={currentCard.word}
                      className="max-h-full max-w-full rounded-lg object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex h-[140px] md:h-[180px] w-full flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface-2 p-4 text-center">
                    <ImageIcon size={36} className="text-muted mb-2" />
                    <p className="text-sm font-medium text-muted">
                      Chưa có hình ảnh
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* BACK SIDE (Mặt sau - Bao gồm Nghĩa tiếng Việt VÀ Phần Test Gõ Từ Trực Tiếp Trên Card) */}
          <div
            className="absolute inset-0 flex h-full w-full flex-col items-center justify-between rounded-2xl border border-line bg-surface p-5 md:p-6 text-center shadow-md overflow-y-auto"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            {/* Upper Section: Nghĩa tiếng Việt */}
            <div className="w-full">
              <span className="text-[0.7rem] font-bold uppercase tracking-widest text-muted">
                Nghĩa tiếng Việt
              </span>
              <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-ink md:text-3xl">
                {currentCard.meaning}
              </h2>
            </div>

            {/* Middle Section: Khi ở chế độ Test ("Chưa nhớ"), hiển thị Khung Loa + Ô ký tự che TRỰC TIẾP TRÊN CARD */}
            {backStep === "test" ? (
              <div
                className="w-full flex flex-col items-center gap-3 bg-surface-2/90 border border-line p-4 rounded-2xl shadow-inner my-2"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-center">
                  <button
                    type="button"
                    onClick={(e) => speakAudio("us", e)}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-500/15 text-blue-600 hover:bg-blue-500/25 transition-colors shadow-xs"
                    title="Nghe lại phát âm"
                  >
                    <SpeakerHigh size={22} weight="fill" />
                  </button>
                </div>

                {/* Các Ô Ký Tự Che Dạng `B _ _ _ _ A` */}
                <div
                  className="w-full cursor-pointer py-1"
                  onClick={() => hiddenInputRef.current?.focus()}
                >
                  {renderLetterSlots()}
                </div>

                {/* Input ẩn để bắt phím gõ từ bàn phím */}
                <input
                  ref={hiddenInputRef}
                  type="text"
                  value={typedInput}
                  onChange={(e) => handleTypingChange(e.target.value)}
                  className="sr-only"
                  autoFocus
                />

                {!isAnswerChecked ? (
                  <span className="text-[0.75rem] text-muted font-medium">Gõ trực tiếp ký tự trên bàn phím để điền vào từ</span>
                ) : (
                  <div className="flex items-center justify-center gap-1.5 text-xs font-extrabold mt-1">
                    {isTypedCorrect ? (
                      <span className="flex items-center gap-1 text-emerald-600 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30">
                        <CheckCircle size={16} weight="fill" /> Chính xác! ({currentCard.word})
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-rose-600 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/30">
                        <XCircle size={16} weight="fill" /> Chưa chính xác! Đáp án đúng: <strong className="underline font-black">{currentCard.word}</strong>
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Nếu không phải test mode, hiển thị ví dụ ngữ cảnh */
              currentCard.exampleSentence || currentCard.exampleMeaning ? (
                <div className="w-full max-w-lg my-2">
                  <CardContextBlock
                    exampleSentence={currentCard.exampleSentence}
                    exampleMeaning={currentCard.exampleMeaning}
                  />
                </div>
              ) : null
            )}

            <div />
          </div>
        </div>
      </div>

      {/* ===========================================================================
          CÁC NÚT BẤM HÀNH ĐỘNG DƯỚI CARD
          ========================================================================= */}
      <div className="w-full max-w-md sm:max-w-lg md:max-w-xl mx-auto flex flex-col items-center">
        {!isFlipped ? (
          <span className="text-xs font-medium text-muted">
            Bấm vào card hoặc phím Space / Enter để lật mặt sau
          </span>
        ) : null}

        {/* BƯỚC 1: 2 Nút "Đã thuộc" & "Chưa nhớ" nằm BÊN NGOÀI DƯỚI CARD (Khi lật sang Mặt Sau) */}
        {isFlipped && backStep === "initial" ? (
          <div className="w-full flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-3 w-full">
              {/* Nút Đã thuộc (Viền Xanh Lá) */}
              <button
                type="button"
                onClick={() => setBackStep("rating")}
                className="flex items-center justify-center gap-2 rounded-2xl border-2 border-emerald-500/70 bg-emerald-500/5 py-3.5 text-base font-extrabold text-emerald-600 hover:bg-emerald-500/15 transition-all shadow-sm cursor-pointer active:scale-[0.98]"
              >
                <CheckCircle size={20} weight="bold" />
                Đã thuộc
              </button>

              {/* Nút Chưa nhớ (Nền Xanh Sky) */}
              <button
                type="button"
                onClick={() => setBackStep("test")}
                className="flex items-center justify-center gap-2 rounded-2xl bg-sky-500 py-3.5 text-base font-extrabold text-white hover:bg-sky-600 transition-colors shadow-md cursor-pointer active:scale-[0.98]"
              >
                Chưa nhớ
              </button>
            </div>
            <span className="text-[0.75rem] font-medium text-muted text-center mt-1">
              Tab: Đã thuộc · Enter: Chưa nhớ · Bấm &quot;Chưa nhớ&quot; để gõ test từ vựng
            </span>
          </div>
        ) : null}

        {/* BƯỚC 2: 4 Nút Đánh Giá FSRS nằm BÊN NGOÀI DƯỚI CARD (Khi ở backStep === "rating" hoặc sau khi gõ xong test) */}
        {isFlipped && (backStep === "rating" || isAnswerChecked) ? (
          <div className="w-full flex flex-col gap-2">
            <div className="grid grid-cols-4 gap-2 sm:gap-3 w-full">
              {/* Nút 1: Học lại (10m) */}
              <button
                type="button"
                onClick={() => handleRatingSelect(1)}
                disabled={busy}
                className="flex flex-col items-center justify-center rounded-2xl bg-rose-500 py-3 text-white hover:bg-rose-600 transition-colors shadow-md cursor-pointer disabled:opacity-50 active:scale-95"
              >
                <span className="text-sm font-extrabold">Học lại</span>
                <span className="text-xs font-mono opacity-90">{getEstimatedFsrsInterval(1, currentCard.position)}</span>
              </button>

              {/* Nút 2: Khó (2d) */}
              <button
                type="button"
                onClick={() => handleRatingSelect(2)}
                disabled={busy}
                className="flex flex-col items-center justify-center rounded-2xl border border-amber-500/40 bg-amber-500/10 py-3 text-amber-700 hover:bg-amber-500/20 transition-colors shadow-sm cursor-pointer disabled:opacity-50 active:scale-95"
              >
                <span className="text-sm font-extrabold">Khó</span>
                <span className="text-xs font-mono font-semibold text-amber-600">{getEstimatedFsrsInterval(2, currentCard.position)}</span>
              </button>

              {/* Nút 3: Tốt (3d) */}
              <button
                type="button"
                onClick={() => handleRatingSelect(3)}
                disabled={busy}
                className="flex flex-col items-center justify-center rounded-2xl border border-emerald-500/40 bg-emerald-500/10 py-3 text-emerald-700 hover:bg-emerald-500/20 transition-colors shadow-sm cursor-pointer disabled:opacity-50 active:scale-95"
              >
                <span className="text-sm font-extrabold">Tốt</span>
                <span className="text-xs font-mono font-semibold text-emerald-600">{getEstimatedFsrsInterval(3, currentCard.position)}</span>
              </button>

              {/* Nút 4: Dễ (8d) */}
              <button
                type="button"
                onClick={() => handleRatingSelect(4)}
                disabled={busy}
                className="flex flex-col items-center justify-center rounded-2xl bg-blue-600 py-3 text-white hover:bg-blue-700 transition-colors shadow-md cursor-pointer disabled:opacity-50 active:scale-95"
              >
                <span className="text-sm font-extrabold">Dễ</span>
                <span className="text-xs font-mono opacity-90">{getEstimatedFsrsInterval(4, currentCard.position)}</span>
              </button>
            </div>
            <span className="text-[0.75rem] font-medium text-muted text-center mt-1">
              Phím 1 · 2 · 3 · 4 · Chọn mức độ sẽ lập tức nhảy sang card tiếp theo
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
