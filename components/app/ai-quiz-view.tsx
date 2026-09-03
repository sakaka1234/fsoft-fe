"use client";

import { useEffect, useState } from "react";
import { Sparkle } from "@phosphor-icons/react/Sparkle";
import { SpeakerHigh } from "@phosphor-icons/react/SpeakerHigh";
import { CheckCircle } from "@phosphor-icons/react/CheckCircle";
import { Lightning } from "@phosphor-icons/react/Lightning";
import { ChartLineUp } from "@phosphor-icons/react/ChartLineUp";
import { Trophy } from "@phosphor-icons/react/Trophy";
import { Clock } from "@phosphor-icons/react/Clock";
import { ClockCounterClockwise } from "@phosphor-icons/react/ClockCounterClockwise";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SelectDropdown } from "@/components/ui/select-dropdown";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/app/states";
import { ApiError } from "@/lib/api/client";
import { aiQuiz } from "@/lib/api/ai";
import { generateLocalQuiz, submitQuiz, getQuizAnalytics } from "@/lib/api/quiz";
import type {
  QuizQuestionResponse,
  QuizGenerateResponse,
  QuizResultResponse,
  QuizAnalyticsResponse,
} from "@/lib/api/types";
import { cn } from "@/lib/cn";

type AiQuizViewProps = {
  deckId: number;
};

function playAudio(word: string, audioUrl?: string | null) {
  if (audioUrl) {
    const audio = new Audio(audioUrl);
    audio.play().catch(() => playTts(word));
    return;
  }
  playTts(word);
}

function playTts(text: string) {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }
}

/**
 * Which renderer a question gets.
 */
function shapeOf(question: QuizQuestionResponse) {
  if (question.matching?.length) return "matching" as const;
  if (question.choices?.length) return "choice" as const;
  return "unsupported" as const;
}

export function AiQuizView({ deckId }: AiQuizViewProps) {
  const [activeTab, setActiveTab] = useState<"QUIZ" | "HISTORY">("QUIZ");
  const [engine, setEngine] = useState<"LOCAL" | "AI">("LOCAL");
  const [count, setCount] = useState(5);
  const [useAiContext, setUseAiContext] = useState(true);
  const [isSrsOnly, setIsSrsOnly] = useState(false);
  const [quizType, setQuizType] = useState<string>("MIXED");
  const [quiz, setQuiz] = useState<QuizGenerateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [matchingPicks, setMatchingPicks] = useState<Record<number, number>>({});
  const [matchingSubmitted, setMatchingSubmitted] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);

  const [startTime, setStartTime] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [submittedResult, setSubmittedResult] = useState<QuizResultResponse | null>(null);

  // Analytics State
  const [analytics, setAnalytics] = useState<QuizAnalyticsResponse | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  useEffect(() => {
    if (activeTab === "HISTORY") {
      fetchAnalytics();
    }
  }, [activeTab]);

  async function fetchAnalytics() {
    setAnalyticsLoading(true);
    try {
      const data = await getQuizAnalytics();
      setAnalytics(data);
    } catch (err) {
      console.error("Lỗi khi tải báo cáo analytics Quiz:", err);
    } finally {
      setAnalyticsLoading(false);
    }
  }

  async function onGenerate() {
    setLoading(true);
    setError(null);
    setQuiz(null);
    setIndex(0);
    setPicked(null);
    setMatchingPicks({});
    setMatchingSubmitted(false);
    setCorrectCount(0);
    setSubmittedResult(null);
    setStartTime(Date.now());

    try {
      if (engine === "LOCAL") {
        const result = await generateLocalQuiz({
          deckId: deckId,
          questionCount: count,
        });
        setQuiz(result);
      } else {
        const selectedTypes =
          quizType === "MIXED"
            ? ["MULTIPLE_CHOICE", "LISTENING", "MATCHING"]
            : [quizType];

        const rawAiResult = await aiQuiz({
          deck_id: deckId,
          question_count: count,
          use_ai_context: quizType === "FILL_BLANK" ? true : useAiContext,
          is_srs_only: isSrsOnly,
          types: selectedTypes,
        });

        const convertedQuestions: QuizQuestionResponse[] = (rawAiResult.questions || []).map((q) => ({
          index: q.index ?? 0,
          cardId: q.card_id ?? 0,
          word: q.prompt,
          meaning: q.explanation,
          questionText: q.prompt,
          questionType: q.type ?? "MULTIPLE_CHOICE",
          choices: q.options ?? [],
          correctIndex: q.correct_index ?? 0,
          correctAnswer: q.options?.[q.correct_index ?? 0] ?? "",
          explanation: q.explanation ?? "",
          audioUrl: q.audio_url || undefined,
          engine: q.generated_by ?? "AI",
          matching: q.matching || undefined,
        }));

        setQuiz({
          questions: convertedQuestions,
          totalQuestions: convertedQuestions.length,
          engine: "AI",
        });
      }
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Không sinh được bài tập. Vui lòng kiểm tra lại số lượng thẻ trong bộ.",
      );
    }
    setLoading(false);
  }

  function onPick(optionIndex: number, question: QuizQuestionResponse) {
    if (picked !== null) return;
    setPicked(optionIndex);

    const isCorrect = optionIndex === question.correctIndex;
    if (isCorrect) {
      setCorrectCount((value) => value + 1);
    }
  }

  function onSubmitMatching(question: QuizQuestionResponse) {
    if (!question.matching || matchingSubmitted) return;
    setMatchingSubmitted(true);
    const allCorrect = question.matching.every(
      (pair, idx) => matchingPicks[idx] === pair.correct_option_index
    );
    if (allCorrect) {
      setCorrectCount((val) => val + 1);
    }
  }

  async function handleFinishQuiz() {
    if (submitting || !quiz) return;
    setSubmitting(true);
    const timeSpentSeconds = Math.max(1, Math.round((Date.now() - startTime) / 1000));
    const totalQuestions = quiz.questions.length;
    const accuracyRate = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) / 100 : 0;

    try {
      const res = await submitQuiz({
        scope: "DECK",
        totalQuestions,
        correctAnswers: correctCount,
        score: correctCount * 10,
        accuracyRate,
        timeSpentSeconds,
      });
      setSubmittedResult(res);
    } catch (err) {
      console.error("Lỗi khi nộp kết quả Quiz:", err);
    } finally {
      setSubmitting(false);
    }
  }

  function onNext() {
    if (quiz && index + 1 >= quiz.questions.length) {
      handleFinishQuiz();
    }
    setPicked(null);
    setMatchingPicks({});
    setMatchingSubmitted(false);
    setIndex((value) => value + 1);
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Navigation Tabs */}
      <div className="mb-6 flex justify-center gap-2 rounded-field bg-surface-2 p-1.5 border border-line max-w-md mx-auto">
        <button
          type="button"
          onClick={() => setActiveTab("QUIZ")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 rounded-button py-2 text-sm font-semibold transition-all",
            activeTab === "QUIZ"
              ? "bg-surface text-foreground shadow-2xs"
              : "text-muted hover:text-foreground"
          )}
        >
          <Lightning size={18} weight="fill" />
          <span>Luyện Tập Quiz</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("HISTORY")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 rounded-button py-2 text-sm font-semibold transition-all",
            activeTab === "HISTORY"
              ? "bg-surface text-foreground shadow-2xs"
              : "text-muted hover:text-foreground"
          )}
        >
          <ClockCounterClockwise size={18} weight="bold" />
          <span>Lịch Sử & Phong Độ</span>
        </button>
      </div>

      {activeTab === "HISTORY" ? (
        <div className="space-y-6">
          {analyticsLoading ? (
            <CardSkeleton count={3} />
          ) : analytics ? (
            <>
              {/* Analytics Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-card border border-line bg-surface p-4 text-center">
                  <p className="font-mono text-2xl font-black text-brand">{analytics.totalQuizzesTaken}</p>
                  <p className="mt-1 text-xs text-muted font-medium">Lượt làm bài</p>
                </div>

                <div className="rounded-card border border-line bg-surface p-4 text-center">
                  <p className="font-mono text-2xl font-black text-ok">
                    {Math.round(analytics.averageAccuracyRate * 100)}%
                  </p>
                  <p className="mt-1 text-xs text-muted font-medium">Độ chính xác TB</p>
                </div>

                <div className="rounded-card border border-line bg-surface p-4 text-center">
                  <p className="font-mono text-2xl font-black text-amber-500">{analytics.totalScoreEarned} XP</p>
                  <p className="mt-1 text-xs text-muted font-medium">Tổng XP tích lũy</p>
                </div>

                <div className="rounded-card border border-line bg-surface p-4 text-center">
                  <p className="font-mono text-2xl font-black text-foreground">
                    {Math.round(analytics.totalTimeSpentSeconds / 60)} phút
                  </p>
                  <p className="mt-1 text-xs text-muted font-medium">Thời gian học</p>
                </div>
              </div>

              {/* Recent Quiz Results Table */}
              <div className="rounded-card border border-line bg-surface p-5">
                <h4 className="flex items-center gap-2 font-bold text-base mb-4">
                  <ChartLineUp size={20} weight="bold" /> Nhật Ký 7 Lần Thi Gần Nhất
                </h4>

                {analytics.recentResults.length === 0 ? (
                  <p className="text-sm text-muted text-center py-6">Chưa có lịch sử bài thi nào. Hãy làm bài tập để ghi nhận phong độ nhé!</p>
                ) : (
                  <div className="space-y-3">
                    {analytics.recentResults.map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-field border border-line bg-surface-2 p-3 text-sm">
                        <div>
                          <p className="font-semibold text-foreground">
                            {item.correctAnswers}/{item.totalQuestions} câu đúng ({Math.round(item.accuracyRate * 100)}%)
                          </p>
                          <p className="text-xs text-muted">
                            {new Date(item.createdAt).toLocaleString("vi-VN")} • {item.timeSpentSeconds}s
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="inline-flex items-center gap-1 font-mono font-bold text-amber-500">
                            +{item.xpEarned ?? item.score} XP
                          </span>
                          {item.isPerfectScore ? (
                            <span className="block text-[10px] font-extrabold text-ok uppercase">Perfect 100%</span>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <ErrorState message="Không thể tải báo cáo phong độ thi Quiz." />
          )}
        </div>
      ) : (
        /* QUIZ TAB */
        <div>
          {loading ? (
            <div>
              <p className="mb-4 text-center text-sm text-muted">
                Đang chuẩn bị câu hỏi, vui lòng đợi trong giây lát...
              </p>
              <CardSkeleton count={3} />
            </div>
          ) : !quiz ? (
            <div className="rounded-card border border-line bg-surface p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold tracking-tight">Bài Kiểm Tra Quiz</h3>
                <span className="inline-flex items-center gap-1 rounded-tag bg-brand/10 text-brand px-2.5 py-1 text-xs font-semibold">
                  <Lightning size={14} weight="fill" /> Smart Generator
                </span>
              </div>
              <p className="mt-2 text-base text-muted">
                Tạo bài tập kiểm tra trắc nghiệm từ bộ thẻ từ vựng để củng cố kiến thức.
              </p>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <Field id="quiz-engine" label="Chế độ tạo câu hỏi">
                  <SelectDropdown
                    id="quiz-engine"
                    value={engine}
                    options={[
                      { value: "LOCAL", label: "Tạo nhanh" },
                      { value: "AI", label: "Tạo nâng cao với AI" },
                    ]}
                    onValueChange={(v) => setEngine(v as "LOCAL" | "AI")}
                  />
                </Field>

                <Field id="quiz-count" label="Số câu hỏi">
                  <SelectDropdown
                    id="quiz-count"
                    value={String(count)}
                    options={[5, 10, 15, 20].map((value) => ({
                      value: String(value),
                      label: `${value} câu`,
                    }))}
                    onValueChange={(v) => setCount(Number(v))}
                  />
                </Field>

                {engine === "AI" ? (
                  <>
                    <Field id="quiz-type" label="Dạng câu hỏi">
                      <SelectDropdown
                        id="quiz-type"
                        value={quizType}
                        options={[
                          { value: "MIXED", label: "Trộn nhiều dạng câu" },
                          { value: "MULTIPLE_CHOICE", label: "Trắc nghiệm nghĩa từ" },
                          { value: "LISTENING", label: "Luyện nghe âm thanh" },
                          { value: "MATCHING", label: "Nối từ với nghĩa" },
                          { value: "FILL_BLANK", label: "Điền vào chỗ trống (AI)" },
                        ]}
                        onValueChange={(v) => setQuizType(v)}
                      />
                    </Field>

                    <Field id="quiz-scope" label="Chế độ học">
                      <SelectDropdown
                        id="quiz-scope"
                        value={isSrsOnly ? "srs" : "all"}
                        options={[
                          { value: "all", label: "Tất cả các thẻ" },
                          { value: "srs", label: "Thẻ đến hạn SRS" },
                        ]}
                        onValueChange={(v) => setIsSrsOnly(v === "srs")}
                      />
                    </Field>
                  </>
                ) : null}
              </div>

              {error ? (
                <div className="mt-5">
                  <ErrorState message={error} />
                </div>
              ) : null}

              <div className="mt-6">
                <Button onClick={onGenerate}>
                  <Sparkle aria-hidden size={16} weight="fill" />
                  Bắt đầu làm bài
                </Button>
              </div>
            </div>
          ) : quiz.questions.length === 0 ? (
            <EmptyState
              title={isSrsOnly ? "Không có thẻ nào đến hạn ôn tập SRS hôm nay" : "Không tạo được câu hỏi nào"}
              body="Bộ thẻ có thể chưa có từ vựng hoặc bị lỗi. Hãy kiểm tra lại số lượng thẻ trong bộ nhé!"
              action={<Button onClick={onGenerate}>Thử lại</Button>}
            />
          ) : index >= quiz.questions.length ? (
            /* Results Screen */
            <div className="mx-auto max-w-xl text-center">
              <div className="rounded-card border border-line bg-surface p-8 shadow-sm">
                <div className="mx-auto mb-4 inline-flex items-center justify-center rounded-full bg-ok/10 p-3 text-ok">
                  <CheckCircle size={48} weight="fill" />
                </div>
                <h3 className="text-2xl font-bold tracking-tight">Hoàn Thành Bài Thi!</h3>
                <p className="mt-1 text-sm text-muted">Kết quả của bạn đã được ghi nhận vào hệ thống.</p>

                <div className="mt-6 grid grid-cols-2 gap-4 rounded-field bg-surface-2 p-5">
                  <div>
                    <p className="font-mono text-4xl font-extrabold text-foreground">
                      {correctCount}/{quiz.questions.length}
                    </p>
                    <p className="mt-1 text-xs text-muted">Số câu đúng</p>
                  </div>
                  <div>
                    <p className="font-mono text-4xl font-extrabold text-brand">
                      {Math.round((correctCount / quiz.questions.length) * 100)}%
                    </p>
                    <p className="mt-1 text-xs text-muted">Độ chính xác</p>
                  </div>
                </div>

                {submittedResult ? (
                  <div className="mt-4 space-y-2">
                    <div className="rounded-field bg-ok/10 border border-ok/20 p-3.5 text-xs text-ok font-medium flex items-center justify-center gap-2">
                      <CheckCircle size={18} weight="fill" />
                      <span>Đã lưu kết quả thi (+{submittedResult.xpEarned ?? submittedResult.score} XP) & Cập nhật Streak thành công!</span>
                    </div>

                    {submittedResult.isPerfectScore ? (
                      <div className="rounded-field bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-600 font-bold flex items-center justify-center gap-2">
                        <Trophy size={20} weight="fill" className="text-amber-500" />
                        <span>🎉 Thưởng +50 XP Điểm Tuyệt Đối 100%!</span>
                      </div>
                    ) : null}
                  </div>
                ) : submitting ? (
                  <p className="mt-4 text-xs text-muted animate-pulse">Đang lưu kết quả bài thi vào cơ sở dữ liệu...</p>
                ) : null}

                <div className="mt-6 flex justify-center gap-3">
                  <Button onClick={onGenerate}>Làm bài mới</Button>
                  <Button variant="secondary" onClick={() => setActiveTab("HISTORY")}>Xem Lịch Sử Thi</Button>
                </div>
              </div>
            </div>
          ) : (
            /* Active Question Screen */
            (() => {
              const question = quiz.questions[index];
              const shape = shapeOf(question);
              const isListeningMode = quizType === "LISTENING" || question.questionType === "LISTENING";

              const typeLabelMap: Record<string, string> = {
                MULTIPLE_CHOICE: "Trắc nghiệm nghĩa",
                LISTENING: "Luyện nghe phát âm",
                MATCHING: "Bài tập Nối từ",
                FILL_BLANK: "Điền vào chỗ trống",
              };

              const currentTypeLabel = isListeningMode ? "Luyện nghe phát âm" : (typeLabelMap[question.questionType] ?? question.questionType);

              const isNextDisabled =
                shape === "choice"
                  ? picked === null
                  : shape === "matching"
                  ? !matchingSubmitted
                  : false;

              const targetWordForAudio = (() => {
                if (question.questionText) {
                  const match = question.questionText.match(/^"([^"]+)"/);
                  if (match && match[1]) return match[1];
                }
                if (question.word) {
                  return question.word;
                }
                if (question.correctIndex !== undefined && question.choices?.[question.correctIndex]) {
                  return question.choices[question.correctIndex];
                }
                return question.questionText;
              })();

              return (
                <div className="mx-auto max-w-xl">
                  <div className="flex items-center justify-between text-sm text-muted">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">
                        Câu {index + 1} / {quiz.questions.length}
                      </span>
                      <span className="rounded-tag border border-line px-2 py-0.5 text-xs font-medium">
                        {currentTypeLabel}
                      </span>
                      {question.engine === "LOCAL" ? (
                        <span className="rounded-tag border border-line bg-surface-2 px-2 py-0.5 text-xs text-brand font-medium">
                          Tạo từ bộ thẻ
                        </span>
                      ) : question.engine === "AI" ? (
                        <span className="rounded-tag border border-line bg-surface-2 px-2 py-0.5 text-xs text-brand">
                          AI sinh
                        </span>
                      ) : null}
                    </div>
                    <span>Đúng {correctCount}</span>
                  </div>

                  <div className="mt-4 rounded-card border border-line bg-surface p-6">
                    <p className="text-xl font-semibold tracking-tight">
                      {isListeningMode
                        ? "Nghe phát âm và chọn đáp án từ vựng đúng:"
                        : question.questionText}
                    </p>

                    {isListeningMode || question.audioUrl ? (
                      <div className="mt-4 rounded-field border border-line bg-surface-2 p-5 text-center">
                        <button
                          type="button"
                          onClick={() => playAudio(targetWordForAudio, question.audioUrl)}
                          className="inline-flex items-center justify-center gap-2 rounded-button bg-brand text-brand-contrast px-6 py-3 text-base font-semibold shadow-sm hover:opacity-90 transition-all active:scale-95"
                        >
                          <SpeakerHigh size={24} weight="bold" />
                          <span>Phát âm thanh bài nghe</span>
                        </button>
                        <p className="mt-2 text-xs text-muted">Nhấn nút trên để nghe phát âm tiếng Anh và chọn đáp án đúng bên dưới</p>
                      </div>
                    ) : null}

                    {shape === "unsupported" ? (
                      <p className="mt-4 text-base text-muted">
                        Dạng câu hỏi này chưa hiển thị được.
                      </p>
                    ) : null}

                    {shape === "choice" ? (
                      <ul className="mt-5 grid gap-2">
                        {question.choices.map((option, optionIndex) => {
                          const isPicked = picked === optionIndex;
                          const isCorrect = optionIndex === question.correctIndex;
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

                    {shape === "matching" && question.matching ? (
                      <div className="mt-5 grid gap-3">
                        <p className="text-sm font-semibold text-muted">Ghép từng từ ở bên trái với nghĩa đúng:</p>
                        {question.matching.map((pair, idx) => {
                          const userOption = matchingPicks[idx];
                          const isCorrect = userOption === pair.correct_option_index;
                          return (
                            <div
                              key={pair.card_id + "-" + idx}
                              className={cn(
                                "flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-field border px-4 py-3 transition-colors",
                                !matchingSubmitted && "border-line bg-surface-2",
                                matchingSubmitted && isCorrect && "border-ok bg-ok-soft",
                                matchingSubmitted && !isCorrect && "border-danger bg-danger-soft"
                              )}
                            >
                              <span className="font-semibold text-base">{pair.word}</span>
                              <SelectDropdown
                                id={`matching-${question.index}-${pair.word}`}
                                value={
                                  userOption !== undefined ? String(userOption) : ""
                                }
                                options={[
                                  { value: "", label: "-- Chọn nghĩa khớp --" },
                                  ...question.choices.map((opt, optIdx) => ({
                                    value: String(optIdx),
                                    label: opt,
                                  })),
                                ]}
                                placeholder="-- Chọn nghĩa khớp --"
                                onValueChange={(v) => {
                                  if (matchingSubmitted || v === "") return;
                                  setMatchingPicks((prev) => ({
                                    ...prev,
                                    [idx]: Number(v),
                                  }));
                                }}
                                disabled={matchingSubmitted}
                                className="sm:w-60"
                              />
                            </div>
                          );
                        })}

                        {!matchingSubmitted ? (
                          <Button
                            onClick={() => onSubmitMatching(question)}
                            disabled={Object.keys(matchingPicks).length < (question.matching?.length ?? 0)}
                            className="mt-2"
                          >
                            Xác nhận ghép từ
                          </Button>
                        ) : null}
                      </div>
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
                      disabled={isNextDisabled || submitting}
                    >
                      {index + 1 === quiz.questions.length ? (submitting ? "Đang lưu kết quả..." : "Xem kết quả") : "Câu tiếp"}
                    </Button>
                  </div>
                </div>
              );
            })()
          )}
        </div>
      )}
    </div>
  );
}
