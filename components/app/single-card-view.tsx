"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "@phosphor-icons/react/ArrowLeft";
import { ArrowRight } from "@phosphor-icons/react/ArrowRight";
import { SpeakerHigh } from "@phosphor-icons/react/SpeakerHigh";
import { Image as ImageIcon } from "@phosphor-icons/react/Image";

import type { CardResponse } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { CardContextBlock } from "@/components/app/card-context-block";

type SingleCardViewProps = {
  cards: CardResponse[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  onEditCard?: (card: CardResponse) => void;
  busy?: boolean;
};

export function SingleCardView({
  cards,
  currentIndex,
  onIndexChange,
  onEditCard,
  busy = false,
}: SingleCardViewProps) {
  const card = cards[currentIndex];
  const [isFlipped, setIsFlipped] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState<string | null>(null);
  const [loadedImageUrl, setLoadedImageUrl] = useState<string | null>(null);

  const isImageLoading = Boolean(card?.imageUrl) && loadedImageUrl !== card?.imageUrl;

  // Preload next and previous card images into browser cache
  useEffect(() => {
    const nextCard = cards[currentIndex + 1];
    const prevCard = cards[currentIndex - 1];

    if (nextCard?.imageUrl) {
      const imgNext = new Image();
      imgNext.src = nextCard.imageUrl;
    }
    if (prevCard?.imageUrl) {
      const imgPrev = new Image();
      imgPrev.src = prevCard.imageUrl;
    }
  }, [currentIndex, cards]);

  // Keyboard navigation & flip shortcuts
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (event.key === " ") {
        event.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (event.key === "ArrowLeft") {
        if (currentIndex > 0) {
          onIndexChange(currentIndex - 1);
        }
      } else if (event.key === "ArrowRight") {
        if (currentIndex < cards.length - 1) {
          onIndexChange(currentIndex + 1);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, cards.length, onIndexChange]);

  if (!card) return null;

  function playAudio(accent: "uk" | "us", event: React.MouseEvent) {
    event.stopPropagation(); // Prevents card flip on audio click

    if (card.audioUrl) {
      setIsPlayingAudio(accent);
      const audio = new Audio(card.audioUrl);
      audio.play().catch(() => {
        speakWebSpeech(card.word, accent);
      });
      audio.onended = () => setIsPlayingAudio(null);
    } else {
      speakWebSpeech(card.word, accent);
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

  return (
    <div className="flex flex-col items-center gap-6 py-2">
      {/* 3D Flip Card Container */}
      <div
        className="w-full max-w-md sm:max-w-lg md:max-w-xl mx-auto cursor-pointer select-none"
        style={{ perspective: "1000px" }}
        onClick={() => setIsFlipped((prev) => !prev)}
        title="Nhấn để lật thẻ"
      >
        <div
          className="relative min-h-[400px] sm:min-h-[340px] md:min-h-[320px] w-full transition-transform duration-700 ease-in-out"
          style={{
            transformStyle: "preserve-3d",
            transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          {/* FRONT SIDE (Mặt trước) */}
          <div
            className="absolute inset-0 flex h-full w-full flex-col justify-center rounded-2xl border border-line bg-surface p-5 shadow-md md:p-6"
            style={{ backfaceVisibility: "hidden" }}
          >
            <div className="grid grid-cols-1 items-center gap-5 md:grid-cols-2">
              {/* Left Column: English Word & Audio */}
              <div className="flex flex-col items-center justify-center gap-3 text-center md:items-start md:text-left">
                <div className="flex flex-wrap items-baseline justify-center gap-2 md:justify-start">
                  <h2 className="text-2xl font-extrabold tracking-tight break-words text-ink sm:text-3xl md:text-4xl">
                    {card.word}
                  </h2>
                  {card.partOfSpeech ? (
                    <span className="text-base font-medium text-muted md:text-lg">
                      ({card.partOfSpeech})
                    </span>
                  ) : null}
                </div>

                {/* One phonetic field feeds both rows, so the label is the
                    only thing telling UK from US. It used to be icon colour
                    alone, which said nothing and failed on colour vision. */}
                <div className="flex flex-col gap-1 pt-1">
                  <button
                    type="button"
                    onClick={(e) => playAudio("uk", e)}
                    className="group flex min-h-10 items-center gap-2.5 rounded-field px-3 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
                    aria-label={"Nghe phát âm UK của " + card.word}
                  >
                    <span className="w-7 shrink-0 font-mono text-[0.7rem] font-bold tracking-wide">
                      UK
                    </span>
                    <span className="flex size-6 shrink-0 items-center justify-center">
                      <SpeakerHigh
                        size={18}
                        weight={isPlayingAudio === "uk" ? "fill" : "regular"}
                        className={cn(
                          "transition-opacity",
                          isPlayingAudio === "uk"
                            ? "text-accent-text"
                            : "opacity-70 group-hover:opacity-100",
                        )}
                      />
                    </span>
                    <span className="font-mono text-base break-all text-ink">
                      {card.phonetic ? card.phonetic : `/${card.word}/`}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => playAudio("us", e)}
                    className="group flex min-h-10 items-center gap-2.5 rounded-field px-3 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
                    aria-label={"Nghe phát âm US của " + card.word}
                  >
                    <span className="w-7 shrink-0 font-mono text-[0.7rem] font-bold tracking-wide">
                      US
                    </span>
                    <span className="flex size-6 shrink-0 items-center justify-center">
                      <SpeakerHigh
                        size={18}
                        weight={isPlayingAudio === "us" ? "fill" : "regular"}
                        className={cn(
                          "transition-opacity",
                          isPlayingAudio === "us"
                            ? "text-accent-text"
                            : "opacity-70 group-hover:opacity-100",
                        )}
                      />
                    </span>
                    <span className="font-mono text-base break-all text-ink">
                      {card.phonetic ? card.phonetic : `/${card.word}/`}
                    </span>
                  </button>
                </div>
              </div>

              {/* Right Column: Card Image */}
              <div className="flex h-full w-full items-center justify-center">
                {card.imageUrl ? (
                  <div className="relative flex h-[140px] md:h-[180px] w-full items-center justify-center overflow-hidden rounded-xl">
                    {isImageLoading ? (
                      <div className="absolute inset-0 animate-pulse rounded-xl bg-surface-2" />
                    ) : null}
                    <img
                      src={card.imageUrl}
                      alt={card.word}
                      decoding="async"
                      onLoad={() => setLoadedImageUrl(card.imageUrl)}
                      onError={() => setLoadedImageUrl(card.imageUrl)}
                      className={cn(
                        "max-h-full max-w-full rounded-lg object-contain transition-opacity duration-300",
                        isImageLoading ? "opacity-0" : "opacity-100",
                      )}
                    />
                  </div>
                ) : (
                  <div className="flex h-[140px] md:h-[180px] w-full flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface-2 p-4 text-center">
                    <ImageIcon size={36} className="text-muted mb-2" />
                    <p className="text-sm font-medium text-muted">
                      Chưa có hình ảnh
                    </p>
                    {onEditCard ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditCard(card);
                        }}
                        className="mt-1 inline-flex min-h-10 items-center rounded-lg px-3 text-xs font-semibold text-accent-text hover:underline"
                      >
                        + Thêm ảnh
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* BACK SIDE (Mặt sau - Nghĩa tiếng Việt & Ngữ cảnh) */}
          <div
            className="absolute inset-0 flex h-full w-full flex-col items-center justify-center-safe rounded-2xl border border-line bg-surface p-6 md:p-8 text-center shadow-md overflow-y-auto"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <span className="text-[0.7rem] font-bold uppercase tracking-widest text-muted">
              Nghĩa tiếng Việt
            </span>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-ink md:text-3xl lg:text-4xl">
              {card.meaning}
            </h2>

            {/* Khối Ngữ Cảnh (Context Block) */}
            {card.exampleSentence || card.exampleMeaning ? (
              <div className="mt-4 w-full max-w-lg">
                <CardContextBlock
                  exampleSentence={card.exampleSentence}
                  exampleMeaning={card.exampleMeaning}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Bottom Navigation Control Bar */}
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => onIndexChange(currentIndex - 1)}
            disabled={currentIndex === 0 || busy}
            className="flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-surface text-ink transition-colors hover:bg-surface-2 disabled:opacity-40 shadow-sm"
            aria-label="Card trước"
          >
            <ArrowLeft size={22} />
          </button>

          <span className="font-mono text-base font-semibold text-muted min-w-[75px] text-center">
            {currentIndex + 1} / {cards.length}
          </span>

          <button
            type="button"
            onClick={() => onIndexChange(currentIndex + 1)}
            disabled={currentIndex === cards.length - 1 || busy}
            className="flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-surface text-ink transition-colors hover:bg-surface-2 disabled:opacity-40 shadow-sm"
            aria-label="Card sau"
          >
            <ArrowRight size={22} />
          </button>
        </div>


      </div>
    </div>
  );
}
