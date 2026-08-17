"use client";

import { useState } from "react";
import { SpeakerHigh } from "@phosphor-icons/react/SpeakerHigh";
import { cn } from "@/lib/cn";

type CardContextBlockProps = {
  exampleSentence?: string | null;
  exampleMeaning?: string | null;
  className?: string;
  compact?: boolean;
};

export function CardContextBlock({
  exampleSentence,
  exampleMeaning,
  className,
  compact = false,
}: CardContextBlockProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  if (!exampleSentence && !exampleMeaning) return null;

  function playContextAudio(event: React.MouseEvent) {
    event.stopPropagation();
    event.preventDefault();

    if (!exampleSentence) return;

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(exampleSentence);
      utterance.lang = "en-US";
      utterance.rate = 0.9;

      // Tìm giọng đọc chuẩn tiếng Anh (en-US / en-GB)
      const voices = window.speechSynthesis.getVoices();
      const englishVoice = voices.find(
        (v) => v.lang.includes("en-US") || v.lang.startsWith("en"),
      );
      if (englishVoice) {
        utterance.voice = englishVoice;
      }

      setIsPlaying(true);
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);

      window.speechSynthesis.speak(utterance);
    }
  }

  return (
    <div
      className={cn(
        "group relative flex items-start gap-3 rounded-2xl border border-line/70 bg-surface-2/60 transition-all hover:bg-surface-2/90 shadow-2xs",
        compact ? "p-3 text-xs md:text-sm" : "p-4 md:p-5 text-sm md:text-base",
        className,
      )}
    >
      {/* Audio Speaker Button */}
      {exampleSentence ? (
        <button
          type="button"
          onClick={playContextAudio}
          className={cn(
            "mt-0.5 flex shrink-0 items-center justify-center rounded-full text-accent transition-transform hover:scale-110 active:scale-95",
            compact ? "h-6 w-6" : "h-8 w-8",
          )}
          title="Nghe câu ngữ cảnh (Audio)"
          aria-label="Nghe câu ngữ cảnh"
        >
          <SpeakerHigh
            size={compact ? 18 : 22}
            weight="bold"
            className={cn(
              isPlaying
                ? "animate-bounce text-accent"
                : "text-accent/80 group-hover:text-accent",
            )}
          />
        </button>
      ) : null}

      {/* Context sentences */}
      <div className="flex flex-1 flex-col gap-1 text-left leading-relaxed">
        {exampleSentence ? (
          <p className="font-medium text-ink italic">
            &ldquo;{exampleSentence}&rdquo;
          </p>
        ) : null}

        {exampleMeaning ? (
          <p className="font-normal text-muted text-xs md:text-sm">
            ({exampleMeaning})
          </p>
        ) : null}
      </div>
    </div>
  );
}
