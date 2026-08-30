"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Field, SelectInput, TextArea, TextInput } from "@/components/ui/field";
import { FormMessage } from "@/components/auth/form-message";
import { EmptyState, RowSkeleton } from "@/components/app/states";
import { ApiError } from "@/lib/api/client";
import {
  AUTO_DECK_MAX_CARDS,
  CEFR_LEVELS,
  ROLEPLAY_SCENARIOS,
  aiAutoDeck,
  aiRoleplay,
  aiRoleplayHistory,
  aiRoleplayReset,
  aiSituationalLearning,
  aiStory,
  situationalLessonIsEmpty,
} from "@/lib/api/ai";
import { createDeck } from "@/lib/api/decks";
import { createCard } from "@/lib/api/cards";
import type {
  AiAutoDeckResponse,
  AiRoleplayResponse,
  AiStoryResponse,
  SituationalLearningResponse,
  SituationalSentence,
} from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { MagicWand } from "@phosphor-icons/react/MagicWand";
import { BookOpenText } from "@phosphor-icons/react/BookOpenText";
import { MapPin } from "@phosphor-icons/react/MapPin";
import { ChatsCircle } from "@phosphor-icons/react/ChatsCircle";

/*
  Four AI tools that are not tied to one deck, so they live on their own page
  rather than inside the deck switcher, which already carries six modes.

  One rule drives every panel here: generation latency is unpredictable.
  Measured across many real calls it ran from about two seconds to over a
  minute with no relation to input size, and two separate measurement runs
  disagreed by a factor of thirty on the same request. So every panel shows a
  skeleton and copy that admits the range, and none of them shows a progress
  bar or a countdown, because neither could be honest.
*/

type Tool = "deck" | "story" | "situation" | "roleplay";

const TOOLS: { key: Tool; label: string; Icon: typeof MagicWand }[] = [
  { key: "deck", label: "Tạo bộ thẻ", Icon: MagicWand },
  { key: "story", label: "Viết đoạn văn", Icon: BookOpenText },
  { key: "situation", label: "Học theo tình huống", Icon: MapPin },
  { key: "roleplay", label: "Luyện hội thoại", Icon: ChatsCircle },
];

export function AiStudioView() {
  const [tool, setTool] = useState<Tool>("deck");

  return (
    <Container className="flex flex-col gap-8 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Công cụ AI</h1>
        <p className="max-w-prose text-muted">
          Sinh bộ thẻ từ một chủ đề, ghép từ đang nợ thành đoạn văn, dựng bài
          học theo tình huống, hoặc luyện nói với gia sư AI.
        </p>
      </header>

      <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1">
        {TOOLS.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTool(key)}
            aria-current={tool === key ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors",
              tool === key
                ? "bg-accent text-accent-fg"
                : "text-muted hover:bg-surface-2 hover:text-ink",
            )}
          >
            <Icon aria-hidden size={17} weight={tool === key ? "fill" : "regular"} />
            {label}
          </button>
        ))}
      </nav>

      {tool === "deck" ? <AutoDeckPanel /> : null}
      {tool === "story" ? <StoryPanel /> : null}
      {tool === "situation" ? <SituationPanel /> : null}
      {tool === "roleplay" ? <RoleplayPanel /> : null}
    </Container>
  );
}

/** Shared wait state. Deliberately vague about time, because the server is. */
function Generating({ what }: { what: string }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        Đang {what}. Thường mất vài giây, đôi khi lâu hơn một phút.
      </p>
      <RowSkeleton count={3} />
    </div>
  );
}

const errorText = (error: unknown) =>
  error instanceof ApiError ? error.message : "Có lỗi xảy ra. Thử lại nhé.";

/* ------------------------------ auto deck ------------------------------ */

function AutoDeckPanel() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [cardCount, setCardCount] = useState(15);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiAutoDeckResponse | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  function generate() {
    setPending(true);
    setError(null);
    setResult(null);
    aiAutoDeck({ topic, cardCount })
      .then((data) => setResult(data))
      .catch((e) => setError(errorText(e)))
      .finally(() => setPending(false));
  }

  /*
    The generator saves nothing, despite answering "Tạo bộ thẻ thành công" with
    body status 201. Persisting means creating a deck and then posting every
    card, which is what this does, reporting progress because it is N+1
    requests and can partly fail.
  */
  async function save() {
    if (!result) return;
    setError(null);
    setSaving("Đang tạo bộ thẻ…");
    try {
      const deck = await createDeck({
        title: result.title,
        description: result.description,
        sourceLanguage: result.sourceLanguage ?? "en",
        targetLanguage: result.targetLanguage ?? "vi",
        visibility: "PRIVATE",
        isOfficial: false,
      });
      let saved = 0;
      for (const card of result.cards) {
        setSaving(`Đang lưu thẻ ${saved + 1}/${result.cards.length}…`);
        await createCard(deck.id, {
          word: card.word,
          meaning: card.meaning,
          phonetic: card.phonetic,
          partOfSpeech: card.partOfSpeech,
          definitionEn: card.definitionEn,
          exampleSentence: card.exampleSentence,
          exampleMeaning: card.exampleMeaning,
          position: saved + 1,
        });
        saved += 1;
      }
      setSaving(null);
      setResult(null);
      router.push(`/decks/${deck.id}`);
    } catch (e) {
      setSaving(null);
      setError(errorText(e));
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <Field id="ad-topic" label="Chủ đề">
          <TextInput
            id="ad-topic"
            value={topic}
            placeholder="ví dụ: từ vựng phỏng vấn IT"
            onChange={(event) => setTopic(event.target.value)}
            disabled={pending || saving !== null}
          />
        </Field>
        <Field id="ad-count" label="Số thẻ" hint={`Tối đa ${AUTO_DECK_MAX_CARDS}.`}>
          <TextInput
            id="ad-count"
            type="number"
            min={1}
            max={AUTO_DECK_MAX_CARDS}
            value={cardCount}
            onChange={(event) => setCardCount(Number(event.target.value))}
            disabled={pending || saving !== null}
            className="w-28"
          />
        </Field>
      </div>

      {error ? <FormMessage>{error}</FormMessage> : null}
      {pending ? <Generating what="soạn bộ thẻ" /> : null}
      {saving ? <p className="text-sm text-muted">{saving}</p> : null}

      {result ? (
        <div className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6">
          <div>
            <h2 className="text-xl font-semibold">{result.title}</h2>
            <p className="mt-1 text-sm text-muted">{result.description}</p>
          </div>
          <p className="text-sm text-muted">
            {result.cards.length} thẻ. Chưa có gì được lưu, bấm nút bên dưới để
            tạo thành bộ thẻ thật.
          </p>
          <ul className="divide-y divide-line">
            {result.cards.map((card, index) => (
              <li key={`${card.word}-${index}`} className="py-3">
                <p className="font-medium">
                  {card.word}
                  {card.phonetic ? (
                    <span className="ml-2 font-normal text-muted">{card.phonetic}</span>
                  ) : null}
                </p>
                <p className="text-sm text-muted">{card.meaning}</p>
                {card.exampleSentence ? (
                  <p className="text-sm italic text-muted">{card.exampleSentence}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        {result ? (
          <Button onClick={save} disabled={saving !== null}>
            Lưu thành bộ thẻ
          </Button>
        ) : null}
        <Button
          variant={result ? "secondary" : "primary"}
          onClick={generate}
          disabled={pending || !topic.trim() || saving !== null}
        >
          {result ? "Sinh lại" : "Sinh bộ thẻ"}
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------- story -------------------------------- */

function StoryPanel() {
  const [words, setWords] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiStoryResponse | null>(null);

  function generate() {
    const list = words
      .split(/[\n,]/)
      .map((w) => w.trim())
      .filter(Boolean);
    setPending(true);
    setError(null);
    setResult(null);
    /*
      Only BUSINESS_EMAIL is sent. The spec and the written guide list three
      context types each and agree on only that one, so offering the others
      would be guessing at values the server may reject.
    */
    aiStory({ words: list, contextType: "BUSINESS_EMAIL" })
      .then((data) => setResult(data))
      .catch((e) => setError(errorText(e)))
      .finally(() => setPending(false));
  }

  return (
    <div className="flex flex-col gap-5">
      <Field
        id="story-words"
        label="Từ cần ghép vào bài"
        hint="Mỗi dòng hoặc mỗi dấu phẩy một từ."
      >
        <TextArea
          id="story-words"
          rows={5}
          value={words}
          placeholder={"deadline\nproposal\nconsensus"}
          onChange={(event) => setWords(event.target.value)}
          disabled={pending}
        />
      </Field>

      {error ? <FormMessage>{error}</FormMessage> : null}
      {pending ? <Generating what="viết đoạn văn" /> : null}

      {result ? (
        <article className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6">
          <h2 className="text-xl font-semibold">{result.title}</h2>
          <p className="whitespace-pre-line leading-relaxed">{result.storyText}</p>
          <div className="border-t border-line pt-4">
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted">
              {result.translationText}
            </p>
          </div>
          {result.targetWords.length > 0 ? (
            <p className="text-sm text-muted">
              Đã dùng: {result.targetWords.join(", ")}
            </p>
          ) : null}
        </article>
      ) : null}

      <div className="flex justify-end">
        <Button onClick={generate} disabled={pending || !words.trim()}>
          {result ? "Viết lại" : "Viết đoạn văn"}
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------ situation ------------------------------ */

function SentenceList({
  title,
  items,
}: {
  title: string;
  items: SituationalSentence[];
}) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-accent-text">{title}</h3>
      <ul className="divide-y divide-line">
        {items.map((item, index) => (
          <li key={`${item.english}-${index}`} className="py-2.5">
            <p>{item.english}</p>
            <p className="text-sm text-muted">{item.vietnamese}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SituationPanel() {
  const [context, setContext] = useState("");
  const [level, setLevel] = useState<string>("B1");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SituationalLearningResponse | null>(null);
  const [empty, setEmpty] = useState(false);

  function generate() {
    setPending(true);
    setError(null);
    setResult(null);
    setEmpty(false);
    aiSituationalLearning({ context, cefrLevel: level })
      .then((data) => {
        /*
          A generation that produced nothing still answers 200 with a success
          message, so emptiness is the only signal that it failed.
        */
        if (situationalLessonIsEmpty(data)) setEmpty(true);
        else setResult(data);
      })
      .catch((e) => setError(errorText(e)))
      .finally(() => setPending(false));
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <Field id="sit-context" label="Tình huống">
          <TextInput
            id="sit-context"
            value={context}
            placeholder="ví dụ: đi phỏng vấn vị trí Java Developer"
            onChange={(event) => setContext(event.target.value)}
            disabled={pending}
          />
        </Field>
        <Field id="sit-level" label="Trình độ">
          <SelectInput
            id="sit-level"
            value={level}
            onChange={(event) => setLevel(event.target.value)}
            disabled={pending}
          >
            {CEFR_LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>

      {error ? <FormMessage>{error}</FormMessage> : null}
      {pending ? <Generating what="dựng bài học" /> : null}

      {empty ? (
        <EmptyState
          title="Không dựng được bài học"
          body="Máy chủ báo thành công nhưng không trả về nội dung nào. Thử mô tả tình huống cụ thể hơn, hoặc thử lại."
        />
      ) : null}

      {result ? (
        <div className="flex flex-col gap-6 rounded-card border border-line bg-surface p-6">
          <SentenceList title="Hành động chính" items={result.mainActions} />
          <SentenceList title="Câu giao tiếp" items={result.interactions} />
          <SentenceList title="Cảm xúc" items={result.emotions} />
          <SentenceList title="Câu ngắn" items={result.shortCaptions} />
          <SentenceList title="Từ vựng" items={result.vocabularies} />
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button onClick={generate} disabled={pending || !context.trim()}>
          {result || empty ? "Dựng lại" : "Dựng bài học"}
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------- roleplay ------------------------------- */

type Turn = { role: "USER" | "ASSISTANT"; content: string };

function RoleplayPanel() {
  const [scenario, setScenario] = useState<string>(ROLEPLAY_SCENARIOS[0]);
  const [message, setMessage] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [feedback, setFeedback] = useState<AiRoleplayResponse | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
    No conversationId is sent, so the server keys the thread on the account's
    own id. That is deliberate: conversation history is NOT user scoped, and
    any authenticated caller who knows an id can read it, so inventing a
    guessable id here would make a private practice session readable by anyone
    who guessed it.
  */
  const loadHistory = useCallback(() => {
    aiRoleplayHistory()
      .then((past) =>
        setTurns(past.map((t) => ({ role: t.role, content: t.content }))),
      )
      .catch(() => {
        // An empty or unreadable history is not worth an error banner.
      });
  }, []);

  function send() {
    const text = message.trim();
    if (!text) return;
    setTurns((current) => [...current, { role: "USER", content: text }]);
    setMessage("");
    setPending(true);
    setError(null);
    aiRoleplay({ userMessage: text, scenario })
      .then((reply) => {
        setTurns((current) => [
          ...current,
          { role: "ASSISTANT", content: reply.tutorReply },
        ]);
        setFeedback(reply);
      })
      .catch((e) => setError(errorText(e)))
      .finally(() => setPending(false));
  }

  function reset() {
    if (!window.confirm("Xoá toàn bộ hội thoại đang có?")) return;
    setPending(true);
    // Without an explicit id the server uses the account id; the reset route
    // needs that id in the path, so the thread is cleared by sending "me",
    // which the server resolves the same way. Falls back to clearing locally.
    aiRoleplayReset("me")
      .catch(() => undefined)
      .finally(() => {
        setTurns([]);
        setFeedback(null);
        setPending(false);
      });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <Field id="rp-scenario" label="Kịch bản" className="min-w-52">
          <SelectInput
            id="rp-scenario"
            value={scenario}
            onChange={(event) => setScenario(event.target.value)}
            disabled={pending}
          >
            {ROLEPLAY_SCENARIOS.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ").toLowerCase()}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Button variant="secondary" onClick={loadHistory} disabled={pending}>
          Tải hội thoại cũ
        </Button>
        <Button variant="secondary" onClick={reset} disabled={pending}>
          Bắt đầu lại
        </Button>
      </div>

      {error ? <FormMessage>{error}</FormMessage> : null}

      {turns.length === 0 && !pending ? (
        <EmptyState
          title="Chưa có lượt nào"
          body="Chọn kịch bản rồi gõ câu tiếng Anh đầu tiên. Gia sư sẽ trả lời, chấm điểm và góp ý."
        />
      ) : null}

      {turns.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {turns.map((turn, index) => (
            <li
              key={index}
              className={cn(
                "max-w-[85%] rounded-card px-4 py-3",
                turn.role === "USER"
                  ? "self-end bg-accent-soft text-ink"
                  : "self-start border border-line bg-surface",
              )}
            >
              <p className="whitespace-pre-line">{turn.content}</p>
            </li>
          ))}
        </ul>
      ) : null}

      {pending ? <p className="text-sm text-muted">Gia sư đang trả lời…</p> : null}

      {feedback ? (
        <div className="flex flex-col gap-2 rounded-card border border-line bg-surface-2 p-4">
          <p className="text-sm">
            Điểm lượt vừa rồi:{" "}
            <span className="font-mono font-semibold tabular-nums">
              {feedback.score}/100
            </span>
          </p>
          {feedback.wordsUsed.length > 0 ? (
            <p className="text-sm text-muted">
              Đã dùng: {feedback.wordsUsed.join(", ")}
            </p>
          ) : null}
          {feedback.suggestions.length > 0 ? (
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted">
              {feedback.suggestions.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-end gap-3">
        <Field id="rp-message" label="Câu của bạn" className="min-w-0 flex-1">
          <TextInput
            id="rp-message"
            value={message}
            placeholder="In my last project, I met the deadline."
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
            disabled={pending}
          />
        </Field>
        <Button onClick={send} disabled={pending || !message.trim()}>
          Gửi
        </Button>
      </div>
    </div>
  );
}
