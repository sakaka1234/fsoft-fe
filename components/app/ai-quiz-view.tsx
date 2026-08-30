"use client";

import { useState } from "react";
import { Sparkle } from "@phosphor-icons/react/Sparkle";

import { Button } from "@/components/ui/button";
import { Field, SelectInput } from "@/components/ui/field";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/app/states";
import { ApiError } from "@/lib/api/client";
import { aiQuiz } from "@/lib/api/ai";
import type { AiQuizQuestion, AiQuizResponse } from "@/lib/api/types";
import { cn } from "@/lib/cn";

type AiQuizViewProps = {
  deckId: number;
};

/**
 * Which renderer a question gets.
 *
 * Decided from the payload, not from question.type. The OpenAPI document types
 * that field as a bare string with no enum, and the endpoint answered 500
 * throughout the writing of this, so there was no way to learn the vocabulary
 * it uses. Branching on the data that is actually present degrades safely
 * whatever strings the backend settles on.
 */
function shapeOf(question: AiQuizQuestion) {
  if (question.matching?.length) return "matching" as const;
  if (question.options?.length) return "choice" as const;
  return "unsupported" as const;
}

export function AiQuizView({ deckId }: AiQuizViewProps) {
  const [count, setCount] = useState(5);
  const [useAiContext, setUseAiContext] = useState(true);
  const [quiz, setQuiz] = useState<AiQuizResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);

  async function onGenerate() {
    setLoading(true);
    setError(null);
    setQuiz(null);
    setIndex(0);
    setPicked(null);
    setCorrectCount(0);
    try {
      const result = await aiQuiz({
        deck_id: deckId,
        question_count: count,
        use_ai_context: useAiContext,
      });
      setQuiz(result);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Không sinh được bài tập. Thử lại nhé.",
      );
    }
    setLoading(false);
  }

  function onPick(optionIndex: number, question: AiQuizQuestion) {
    if (picked !== null) return;
    setPicked(optionIndex);
    if (optionIndex === question.correct_index) {
      setCorrectCount((value) => value + 1);
    }
  }

  function onNext() {
    setPicked(null);
    setIndex((value) => value + 1);
  }

  if (loading) {
    return (
      <div>
        <p className="mb-4 text-center text-sm text-muted">
          Đang sinh câu hỏi, có thể mất một lúc...
        </p>
        <CardSkeleton count={3} />
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="rounded-card border border-line bg-surface p-6">
          <h3 className="text-xl font-semibold tracking-tight">Quiz AI</h3>
          <p className="mt-2 text-base text-muted">
            AI đọc bộ thẻ này rồi sinh câu hỏi từ chính những từ bạn đang học.
          </p>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <Field id="quiz-count" label="Số câu hỏi">
              <SelectInput
                id="quiz-count"
                value={String(count)}
                onChange={(event) => setCount(Number(event.target.value))}
              >
                {[5, 10, 15, 20].map((value) => (
                  <option key={value} value={value}>
                    {value} câu
                  </option>
                ))}
              </SelectInput>
            </Field>

            <Field id="quiz-context" label="Nguồn câu hỏi">
              <SelectInput
                id="quiz-context"
                value={useAiContext ? "ai" : "plain"}
                onChange={(event) =>
                  setUseAiContext(event.target.value === "ai")
                }
              >
                <option value="ai">Có AI diễn giải</option>
                <option value="plain">Chỉ dựa trên thẻ</option>
              </SelectInput>
            </Field>
          </div>

          {error ? (
            <div className="mt-5">
              <ErrorState message={error} />
            </div>
          ) : null}

          <div className="mt-6">
            <Button onClick={onGenerate}>
              <Sparkle aria-hidden size={16} weight="fill" />
              Sinh bài tập
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (quiz.questions.length === 0) {
    return (
      <EmptyState
        title="AI không sinh được câu hỏi nào"
        body="Bộ thẻ có thể còn quá ít từ. Thêm vài thẻ rồi thử lại."
        action={<Button onClick={onGenerate}>Thử lại</Button>}
      />
    );
  }

  if (index >= quiz.questions.length) {
    return (
      <div className="mx-auto max-w-xl text-center">
        <div className="rounded-card border border-line bg-surface p-8">
          <p className="font-mono text-5xl tracking-tight tabular-nums">
            {correctCount}/{quiz.questions.length}
          </p>
          <p className="mt-3 text-base text-muted">Số câu đúng</p>

          {/* Where the questions came from. Worth showing: a mostly
              deterministic run is repeatable, a mostly generated one is not. */}
          <p className="mt-6 text-sm text-muted">
            {quiz.stats.deterministic_count} câu dựng từ thẻ,{" "}
            {quiz.stats.llm_count} câu do AI sinh, mất {quiz.stats.latency_ms}
            ms.
          </p>

          <div className="mt-6">
            <Button onClick={onGenerate}>Làm bài mới</Button>
          </div>
        </div>
      </div>
    );
  }

  const question = quiz.questions[index];
  const shape = shapeOf(question);

  return (
    <div className="mx-auto max-w-xl">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          Câu {index + 1} / {quiz.questions.length}
        </span>
        <span>Đúng {correctCount}</span>
      </div>

      <div className="mt-4 rounded-card border border-line bg-surface p-6">
        <p className="text-xl font-semibold tracking-tight">{question.prompt}</p>

        {question.audio_url ? (
          <audio
            controls
            src={question.audio_url}
            className="mt-4 w-full"
            aria-label="Phát âm thanh câu hỏi"
          />
        ) : null}

        {shape === "unsupported" ? (
          <p className="mt-4 text-base text-muted">
            Dạng câu hỏi này chưa hiển thị được.
          </p>
        ) : null}

        {shape === "choice" ? (
          <ul className="mt-5 grid gap-2">
            {question.options.map((option, optionIndex) => {
              const isPicked = picked === optionIndex;
              const isCorrect = optionIndex === question.correct_index;
              const revealed = picked !== null;
              return (
                <li key={option + optionIndex}>
                  <button
                    type="button"
                    onClick={() => onPick(optionIndex, question)}
                    disabled={revealed}
                    className={cn(
                      "w-full rounded-field border px-4 py-3 text-left transition-colors",
                      !revealed && "border-line hover:bg-surface-2",
                      revealed && isCorrect && "border-ok bg-ok-soft",
                      revealed &&
                        isPicked &&
                        !isCorrect &&
                        "border-danger bg-danger-soft",
                      revealed &&
                        !isCorrect &&
                        !isPicked &&
                        "border-line opacity-60",
                    )}
                  >
                    {option}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        {shape === "matching" ? (
          <ul className="mt-5 grid gap-2">
            {question.matching?.map((pair) => (
              <li
                key={pair.card_id}
                className="flex items-center justify-between gap-4 rounded-field border border-line px-4 py-3"
              >
                <span className="font-semibold">{pair.word}</span>
                <span className="text-muted">
                  {question.options[pair.correct_option_index] ?? "?"}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {picked !== null && question.explanation ? (
          <p className="mt-5 rounded-field bg-surface-2 p-4 text-base">
            {question.explanation}
          </p>
        ) : null}
      </div>

      <div className="mt-5 flex justify-end">
        <Button
          onClick={onNext}
          disabled={shape === "choice" && picked === null}
        >
          {index + 1 === quiz.questions.length ? "Xem kết quả" : "Câu tiếp"}
        </Button>
      </div>
    </div>
  );
}
