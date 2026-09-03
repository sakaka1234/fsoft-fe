"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Field, TextArea, TextInput } from "@/components/ui/field";
import { SelectDropdown } from "@/components/ui/select-dropdown";
import { FormMessage } from "@/components/auth/form-message";
import { EmptyState, RowSkeleton } from "@/components/app/states";
import { ApiError } from "@/lib/api/client";
import {
  AUTO_DECK_MAX_CARDS,
  CEFR_LEVELS,
  ROLEPLAY_SCENARIOS,
  STORY_CONTEXT_TYPES,
  aiAutoDeck,
  aiRoleplay,
  aiRoleplayHistory,
  aiRoleplayReset,
  aiSituationalLearning,
  aiStory,
  situationalLessonIsEmpty,
} from "@/lib/api/ai";
import { createDeck, listMyDecks } from "@/lib/api/decks";
import { createCard, listCards } from "@/lib/api/cards";
import type {
  AiAutoDeckResponse,
  AiRoleplayResponse,
  AiStoryResponse,
  CardResponse,
  DeckResponse,
  ExtractedCard,
  SituationalLearningResponse,
  SituationalSentence,
  StoryContextType,
} from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { MagicWand } from "@phosphor-icons/react/MagicWand";
import { BookOpenText } from "@phosphor-icons/react/BookOpenText";
import { MapPin } from "@phosphor-icons/react/MapPin";
import { ChatsCircle } from "@phosphor-icons/react/ChatsCircle";
import { Cards } from "@phosphor-icons/react/Cards";
import { Check } from "@phosphor-icons/react/Check";
import { Copy } from "@phosphor-icons/react/Copy";
import { MagnifyingGlass } from "@phosphor-icons/react/MagnifyingGlass";
import { X } from "@phosphor-icons/react/X";
import { Trash } from "@phosphor-icons/react/Trash";
import { PencilSimple } from "@phosphor-icons/react/PencilSimple";
import { Plus } from "@phosphor-icons/react/Plus";
import { CaretDown } from "@phosphor-icons/react/CaretDown";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

const STORY_CONTEXT_LABELS: Record<StoryContextType, string> = {
  BUSINESS_EMAIL: "Email công việc",
  DAILY_STORY: "Câu chuyện đời thường",
  DAILY_NEWS: "Bản tin hàng ngày",
  NEWS_ARTICLE: "Bài báo",
  CASUAL_CHAT: "Trò chuyện thân mật",
};

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

function CardFormInputs({
  card,
  onChange,
  onSave,
  onCancel,
  saveLabel = "Xong",
}: {
  card: ExtractedCard;
  onChange: (updated: ExtractedCard) => void;
  onSave: () => void;
  onCancel: () => void;
  saveLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="card-word" label="Từ vựng *">
          <TextInput
            id="card-word"
            value={card.word}
            placeholder="vd: deadline"
            onChange={(e) => onChange({ ...card, word: e.target.value })}
            className="h-10 text-sm rounded-lg"
          />
        </Field>
        <Field id="card-phonetic" label="Phiên âm (IPA)">
          <TextInput
            id="card-phonetic"
            value={card.phonetic ?? ""}
            placeholder="vd: /ˈded.laɪn/"
            onChange={(e) => onChange({ ...card, phonetic: e.target.value })}
            className="h-10 text-sm rounded-lg font-mono"
          />
        </Field>
        <Field id="card-pos" label="Từ loại">
          <TextInput
            id="card-pos"
            value={card.partOfSpeech ?? ""}
            placeholder="vd: noun, verb..."
            onChange={(e) => onChange({ ...card, partOfSpeech: e.target.value })}
            className="h-10 text-sm rounded-lg"
          />
        </Field>
      </div>

      <Field id="card-meaning" label="Nghĩa tiếng Việt *">
        <TextInput
          id="card-meaning"
          value={card.meaning}
          placeholder="vd: hạn chót hoàn thành công việc"
          onChange={(e) => onChange({ ...card, meaning: e.target.value })}
          className="h-10 text-sm rounded-lg"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="card-ex-sentence" label="Câu ví dụ (English)">
          <TextInput
            id="card-ex-sentence"
            value={card.exampleSentence ?? ""}
            placeholder="vd: We must meet the project deadline."
            onChange={(e) => onChange({ ...card, exampleSentence: e.target.value })}
            className="h-10 text-sm rounded-lg"
          />
        </Field>
        <Field id="card-ex-meaning" label="Dịch câu ví dụ (Tiếng Việt)">
          <TextInput
            id="card-ex-meaning"
            value={card.exampleMeaning ?? ""}
            placeholder="vd: Chúng ta phải hoàn thành đúng hạn dự án."
            onChange={(e) => onChange({ ...card, exampleMeaning: e.target.value })}
            className="h-10 text-sm rounded-lg"
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-line">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-4 text-sm font-medium text-ink transition-colors hover:bg-surface-2 active:scale-[0.98]"
        >
          <X size={15} />
          Huỷ
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!card.word.trim() || !card.meaning.trim()}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-accent px-5 text-sm font-semibold text-accent-fg shadow-xs transition-colors hover:bg-accent-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Check size={15} weight="bold" />
          {saveLabel}
        </button>
      </div>
    </div>
  );
}

function AutoDeckPanel() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [cardCount, setCardCount] = useState(15);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiAutoDeckResponse | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingCardData, setEditingCardData] = useState<ExtractedCard | null>(null);
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [newCard, setNewCard] = useState<ExtractedCard>({
    word: "",
    meaning: "",
    phonetic: "",
    partOfSpeech: "",
    definitionEn: "",
    exampleSentence: "",
    exampleMeaning: "",
    imageUrl: "",
    audioUrl: "",
    note: "",
    position: 0,
  });

  function generate() {
    setPending(true);
    setError(null);
    setResult(null);
    setEditingIndex(null);
    setIsAddingCard(false);
    aiAutoDeck({ topic, cardCount })
      .then((data) => setResult(data))
      .catch((e) => setError(errorText(e)))
      .finally(() => setPending(false));
  }

  function startEditCard(index: number) {
    if (!result) return;
    setEditingIndex(index);
    setEditingCardData({ ...result.cards[index] });
    setIsAddingCard(false);
  }

  function saveEditCard() {
    if (!result || editingIndex === null || !editingCardData) return;
    const nextCards = [...result.cards];
    nextCards[editingIndex] = editingCardData;
    setResult({ ...result, cards: nextCards });
    setEditingIndex(null);
    setEditingCardData(null);
  }

  function cancelEditCard() {
    setEditingIndex(null);
    setEditingCardData(null);
  }

  function deleteCard(index: number) {
    if (!result) return;
    const nextCards = result.cards.filter((_, i) => i !== index);
    setResult({ ...result, cards: nextCards });
    if (editingIndex === index) {
      setEditingIndex(null);
      setEditingCardData(null);
    }
  }

  function addCard() {
    if (!result) return;
    if (!newCard.word.trim() || !newCard.meaning.trim()) return;
    setResult({
      ...result,
      cards: [...result.cards, { ...newCard }],
    });
    setNewCard({
      word: "",
      meaning: "",
      phonetic: "",
      partOfSpeech: "",
      definitionEn: "",
      exampleSentence: "",
      exampleMeaning: "",
      imageUrl: "",
      audioUrl: "",
      note: "",
      position: 0,
    });
    setIsAddingCard(false);
  }

  /*
    The generator saves nothing, despite answering "Tạo bộ thẻ thành công" with
    body status 201. Persisting means creating a deck and then posting every
    card, which is what this does, reporting progress because it is N+1
    requests and can partly fail.
  */
  async function save() {
    if (!result || result.cards.length === 0) return;
    setError(null);
    setSaving("Đang tạo bộ thẻ…");
    try {
      const deck = await createDeck({
        title: result.title.trim() || "Bộ thẻ mới",
        description: result.description.trim(),
        sourceLanguage: result.sourceLanguage ?? "en",
        targetLanguage: result.targetLanguage ?? "vi",
        visibility: "PRIVATE",
        isOfficial: false,
      });
      let saved = 0;
      for (const card of result.cards) {
        setSaving(`Đang lưu thẻ ${saved + 1}/${result.cards.length}…`);
        await createCard(deck.id, {
          word: card.word.trim(),
          meaning: card.meaning.trim(),
          phonetic: card.phonetic?.trim() || undefined,
          partOfSpeech: card.partOfSpeech?.trim() || undefined,
          definitionEn: card.definitionEn?.trim() || undefined,
          exampleSentence: card.exampleSentence?.trim() || undefined,
          exampleMeaning: card.exampleMeaning?.trim() || undefined,
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
        <div className="flex flex-col gap-5 rounded-card border border-line bg-surface p-5 sm:p-6 shadow-sm">
          {/* Deck Metadata editable */}
          <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface-2 p-4">
            <Field id="deck-title-edit" label="Tiêu đề bộ bài">
              <TextInput
                id="deck-title-edit"
                value={result.title}
                onChange={(e) => setResult({ ...result, title: e.target.value })}
                disabled={saving !== null}
              />
            </Field>
            <Field id="deck-desc-edit" label="Mô tả bộ bài">
              <TextArea
                id="deck-desc-edit"
                rows={2}
                value={result.description}
                onChange={(e) => setResult({ ...result, description: e.target.value })}
                disabled={saving !== null}
              />
            </Field>
          </div>

          {/* Cards Header & Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
            <div>
              <h3 className="font-semibold text-ink">
                Danh sách thẻ ({result.cards.length} thẻ)
              </h3>
              <p className="text-xs text-muted">
                Bạn có thể thêm, sửa, hoặc xoá thẻ trước khi bấm lưu.
              </p>
            </div>
            {!isAddingCard ? (
              <button
                type="button"
                onClick={() => {
                  setIsAddingCard(true);
                  setEditingIndex(null);
                }}
                disabled={saving !== null}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 text-xs font-medium text-ink transition-colors hover:bg-surface-2 hover:border-ink/20 shadow-2xs shrink-0 active:scale-[0.98]"
              >
                <Plus size={14} weight="bold" />
                Thêm thẻ mới
              </button>
            ) : null}
          </div>

          {/* Add New Card Form */}
          {isAddingCard ? (
            <div className="flex flex-col gap-3 my-2">
              <span className="text-sm font-semibold text-accent-text flex items-center gap-1.5 px-1">
                <Plus size={16} weight="bold" />
                Thêm thẻ từ vựng mới
              </span>
              <CardFormInputs
                card={newCard}
                onChange={setNewCard}
                onSave={addCard}
                onCancel={() => setIsAddingCard(false)}
                saveLabel="Thêm vào bộ thẻ"
              />
            </div>
          ) : null}

          {/* Cards List */}
          {result.cards.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">
              Chưa có thẻ nào trong bộ. Hãy bấm &quot;Thêm thẻ mới&quot; hoặc sinh lại.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {result.cards.map((card, index) => (
                <li key={`card-${index}`} className="py-3">
                  {editingIndex === index && editingCardData ? (
                    <CardFormInputs
                      card={editingCardData}
                      onChange={setEditingCardData}
                      onSave={saveEditCard}
                      onCancel={cancelEditCard}
                      saveLabel="Lưu thay đổi"
                    />
                  ) : (
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-2xs font-mono font-medium text-muted">
                            #{index + 1}
                          </span>
                          <p className="font-semibold text-ink">{card.word}</p>
                          {card.phonetic ? (
                            <span className="font-mono text-xs text-muted">
                              {card.phonetic}
                            </span>
                          ) : null}
                          {card.partOfSpeech ? (
                            <span className="text-2xs uppercase tracking-wider text-muted font-medium">
                              ({card.partOfSpeech})
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm text-ink/80">{card.meaning}</p>
                        {card.exampleSentence ? (
                          <div className="mt-1.5 rounded-md bg-surface-2 p-2 text-xs">
                            <p className="italic text-muted font-medium">
                              &ldquo;{card.exampleSentence}&rdquo;
                            </p>
                            {card.exampleMeaning ? (
                              <p className="mt-0.5 text-muted/80">{card.exampleMeaning}</p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      {/* Action buttons */}
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => startEditCard(index)}
                          disabled={saving !== null}
                          className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-ink transition-colors"
                          title="Chỉnh sửa thẻ này"
                        >
                          <PencilSimple size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteCard(index)}
                          disabled={saving !== null}
                          className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-danger transition-colors"
                          title="Xoá thẻ này"
                        >
                          <Trash size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        {result ? (
          <Button
            onClick={save}
            disabled={saving !== null || result.cards.length === 0}
          >
            Lưu thành bộ thẻ ({result.cards.length} thẻ)
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

function highlightStoryWords(text: string, words: string[]): React.ReactNode {
  const cleanWords = words
    .map((w) => w.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  if (cleanWords.length === 0) return text;

  const escaped = cleanWords.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(\\b(?:${escaped.join("|")})(?:s|es|ed|ing|d)?\\b)`, "gi");

  const parts = text.split(regex);
  return parts.map((part, index) => {
    const isMatch = cleanWords.some((w) => {
      const p = part.toLowerCase();
      const target = w.toLowerCase();
      return p === target || p.startsWith(target) || target.startsWith(p);
    });

    if (isMatch && part.trim()) {
      return (
        <span
          key={index}
          className="font-semibold text-ink underline decoration-accent decoration-2 underline-offset-4 bg-accent-soft/30 px-1 py-0.5 rounded-xs transition-colors"
          title={`Từ mục tiêu: ${part}`}
        >
          {part}
        </span>
      );
    }
    return part;
  });
}

function StoryPanel() {
  const [inputTab, setInputTab] = useState<"deck" | "custom">("deck");
  const [decks, setDecks] = useState<DeckResponse[]>([]);
  const [decksLoading, setDecksLoading] = useState(true);
  const [selectedDeckId, setSelectedDeckId] = useState<number | null>(null);
  const [cards, setCards] = useState<CardResponse[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [cardSearch, setCardSearch] = useState("");
  const [selectedCards, setSelectedCards] = useState<CardResponse[]>([]);
  const [customWords, setCustomWords] = useState("");
  const [contextType, setContextType] = useState<StoryContextType>(
    STORY_CONTEXT_TYPES[0],
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiStoryResponse | null>(null);
  const [copied, setCopied] = useState<"story" | "translation" | null>(null);

  // Load saved decks on mount
  useEffect(() => {
    let active = true;
    setDecksLoading(true);
    listMyDecks(1, 100)
      .then((res) => {
        if (!active) return;
        setDecks(res.content);
        if (res.content.length > 0 && selectedDeckId === null) {
          setSelectedDeckId(res.content[0].id);
        }
      })
      .catch(() => {
        if (active) setDecks([]);
      })
      .finally(() => {
        if (active) setDecksLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Load cards when selected deck changes
  useEffect(() => {
    if (!selectedDeckId) {
      setCards([]);
      return;
    }
    let active = true;
    setCardsLoading(true);
    listCards(selectedDeckId, 0, 100)
      .then((res) => {
        if (!active) return;
        setCards(res.content);
      })
      .catch(() => {
        if (active) setCards([]);
      })
      .finally(() => {
        if (active) setCardsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedDeckId]);

  const filteredCards = useMemo(() => {
    const q = cardSearch.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter(
      (c) =>
        c.word.toLowerCase().includes(q) ||
        c.meaning.toLowerCase().includes(q) ||
        (c.phonetic && c.phonetic.toLowerCase().includes(q)),
    );
  }, [cards, cardSearch]);

  const manualWordList = useMemo(() => {
    return customWords
      .split(/[\n,]/)
      .map((w) => w.trim())
      .filter(Boolean);
  }, [customWords]);

  const allTargetWords = useMemo(() => {
    const cardWords = selectedCards.map((c) => c.word.trim());
    const unique = new Set([...cardWords, ...manualWordList]);
    return Array.from(unique).filter(Boolean);
  }, [selectedCards, manualWordList]);

  const toggleCard = useCallback((card: CardResponse) => {
    setSelectedCards((prev) => {
      const exists = prev.some((c) => c.id === card.id);
      if (exists) {
        return prev.filter((c) => c.id !== card.id);
      }
      return [...prev, card];
    });
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelectedCards((prev) => {
      const existingIds = new Set(prev.map((c) => c.id));
      const toAdd = filteredCards.filter((c) => !existingIds.has(c.id));
      return [...prev, ...toAdd];
    });
  }, [filteredCards]);

  const deselectAllVisible = useCallback(() => {
    setSelectedCards((prev) => {
      const visibleIds = new Set(filteredCards.map((c) => c.id));
      return prev.filter((c) => !visibleIds.has(c.id));
    });
  }, [filteredCards]);

  const removeCard = useCallback((cardId: number) => {
    setSelectedCards((prev) => prev.filter((c) => c.id !== cardId));
  }, []);

  const removeManualWord = useCallback((wordToRemove: string) => {
    setCustomWords((prev) =>
      prev
        .split(/[\n,]/)
        .map((w) => w.trim())
        .filter((w) => w && w !== wordToRemove)
        .join("\n"),
    );
  }, []);

  const clearAll = useCallback(() => {
    setSelectedCards([]);
    setCustomWords("");
  }, []);

  const copyToClipboard = (text: string, type: "story" | "translation") => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  function generate() {
    if (allTargetWords.length === 0) return;
    setPending(true);
    setError(null);
    setResult(null);

    const cardIds = selectedCards.map((c) => c.id);
    aiStory({
      words: allTargetWords,
      cardIds: cardIds.length > 0 ? cardIds : undefined,
      contextType,
    })
      .then((data) => setResult(data))
      .catch((e) => setError(errorText(e)))
      .finally(() => setPending(false));
  }

  const allVisibleSelected =
    filteredCards.length > 0 &&
    filteredCards.every((c) => selectedCards.some((sc) => sc.id === c.id));

  return (
    <div className="flex flex-col gap-6">
      {/* Source selection tabs */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 rounded-full border border-line bg-surface p-1">
            <button
              type="button"
              onClick={() => setInputTab("deck")}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                inputTab === "deck"
                  ? "bg-accent text-accent-fg shadow-sm"
                  : "text-muted hover:text-ink",
              )}
            >
              <Cards size={16} />
              Chọn từ bộ thẻ đã lưu
              {selectedCards.length > 0 ? (
                <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.2 text-xs">
                  {selectedCards.length}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => setInputTab("custom")}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                inputTab === "custom"
                  ? "bg-accent text-accent-fg shadow-sm"
                  : "text-muted hover:text-ink",
              )}
            >
              <PencilSimple size={16} />
              Nhập từ tự do
              {manualWordList.length > 0 ? (
                <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.2 text-xs">
                  {manualWordList.length}
                </span>
              ) : null}
            </button>
          </div>

          {allTargetWords.length > 0 ? (
            <button
              type="button"
              onClick={clearAll}
              disabled={pending}
              className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-danger transition-colors"
            >
              <Trash size={14} />
              Xoá tất cả ({allTargetWords.length} từ)
            </button>
          ) : null}
        </div>

        {/* Input card: tab content + context type */}
        <div className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4 sm:p-5">
          {inputTab === "deck" ? (
            decksLoading ? (
              <RowSkeleton count={2} />
            ) : decks.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm text-muted">
                  Bạn chưa có bộ thẻ nào đã lưu. Hãy tạo bộ thẻ trước hoặc dùng tab &quot;Nhập từ tự do&quot;.
                </p>
              </div>
            ) : (
              <>
                {/* Deck picker & search */}
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
                  <Field id="deck-picker" label="Chọn bộ thẻ">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          id="deck-picker"
                          type="button"
                          disabled={pending || cardsLoading || decks.length === 0}
                          className="flex h-11 w-full items-center justify-between gap-2 rounded-field border border-line bg-surface px-3.5 text-base text-ink transition-colors hover:border-ink/25 focus:outline-none focus:ring-2 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Cards size={18} className="shrink-0 text-accent" />
                            <span className="truncate font-medium">
                              {decks.find((d) => d.id === selectedDeckId)?.title ?? "Chọn một bộ thẻ..."}
                            </span>
                            {decks.find((d) => d.id === selectedDeckId)?.totalCards !== undefined ? (
                              <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">
                                {decks.find((d) => d.id === selectedDeckId)?.totalCards} thẻ
                              </span>
                            ) : null}
                          </div>
                          <CaretDown size={16} className="shrink-0 text-muted" />
                        </button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent
                        align="start"
                        className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-72 overflow-y-auto"
                      >
                        <DropdownMenuLabel>Bộ thẻ đã lưu ({decks.length})</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {decks.map((deck) => {
                          const isSelected = deck.id === selectedDeckId;
                          return (
                            <DropdownMenuItem
                              key={deck.id}
                              onClick={() => setSelectedDeckId(deck.id)}
                              className={cn(
                                "flex items-center justify-between py-2.5",
                                isSelected && "bg-accent-soft/40 font-medium text-accent-text",
                              )}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <Cards size={16} className={isSelected ? "text-accent" : "text-muted"} />
                                <span className="truncate">{deck.title}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs text-muted">
                                  {deck.totalCards ?? 0} thẻ
                                </span>
                                {isSelected ? (
                                  <Check size={14} weight="bold" className="text-accent" />
                                ) : null}
                              </div>
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </Field>

                  <Field id="card-search" label="Tìm thẻ trong bộ">
                    <div className="relative flex items-center">
                      <MagnifyingGlass
                        size={16}
                        className="pointer-events-none absolute left-3 text-muted"
                      />
                      <TextInput
                        id="card-search"
                        value={cardSearch}
                        placeholder="Tìm theo từ, phiên âm, nghĩa..."
                        onChange={(e) => setCardSearch(e.target.value)}
                        disabled={pending || cardsLoading || cards.length === 0}
                        className="pl-9"
                      />
                    </div>
                  </Field>
                </div>

                {/* Cards header & quick actions */}
                <div className="flex items-center justify-between border-t border-line pt-3 text-xs text-muted">
                  <span>
                    {cardsLoading
                      ? "Đang tải thẻ…"
                      : `Hiển thị ${filteredCards.length}/${cards.length} thẻ từ bộ đã chọn`}
                  </span>
                  {filteredCards.length > 0 && !cardsLoading ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={allVisibleSelected ? deselectAllVisible : selectAllVisible}
                        disabled={pending}
                        className="text-accent-text hover:underline font-medium"
                      >
                        {allVisibleSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                      </button>
                    </div>
                  ) : null}
                </div>

                {/* Cards List / Grid */}
                {cardsLoading ? (
                  <RowSkeleton count={3} />
                ) : cards.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted">
                    Bộ thẻ này chưa có thẻ từ vựng nào.
                  </p>
                ) : filteredCards.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted">
                    Không tìm thấy từ vựng khớp với từ khoá &quot;{cardSearch}&quot;.
                  </p>
                ) : (
                  <div className="grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                    {filteredCards.map((card) => {
                      const selected = selectedCards.some((c) => c.id === card.id);
                      return (
                        <button
                          key={card.id}
                          type="button"
                          onClick={() => toggleCard(card)}
                          disabled={pending}
                          className={cn(
                            "flex items-start gap-3 rounded-lg border p-3 text-left transition-all",
                            selected
                              ? "border-accent bg-accent-soft/30 shadow-xs"
                              : "border-line bg-surface hover:border-ink/20 hover:bg-surface-2",
                          )}
                        >
                          <div
                            className={cn(
                              "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                              selected
                                ? "border-accent bg-accent text-accent-fg"
                                : "border-line bg-surface",
                            )}
                          >
                            {selected ? <Check size={12} weight="bold" /> : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-1.5">
                              <span className="font-semibold text-ink">{card.word}</span>
                              {card.phonetic ? (
                                <span className="text-xs text-muted font-mono">{card.phonetic}</span>
                              ) : null}
                              {card.partOfSpeech ? (
                                <span className="text-2xs uppercase tracking-wider text-muted font-medium">
                                  ({card.partOfSpeech})
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-0.5 line-clamp-2 text-xs text-muted">
                              {card.meaning}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )
          ) : (
            /* Tab 2: Custom words textarea */
            <Field
              id="story-words"
              label="Từ cần ghép vào bài"
              hint="Mỗi dòng hoặc mỗi dấu phẩy một từ."
            >
              <TextArea
                id="story-words"
                rows={5}
                value={customWords}
                placeholder={"deadline\nproposal\nconsensus"}
                onChange={(event) => setCustomWords(event.target.value)}
                disabled={pending}
              />
            </Field>
          )}

          {/* Context type selector */}
          <div className="border-t border-line pt-4">
            <Field
              id="story-context-type"
              label="Loại văn bản"
              hint="Ngữ cảnh AI dùng để viết."
              className="sm:max-w-xs"
            >
              <SelectDropdown
                id="story-context-type"
                value={contextType}
                options={STORY_CONTEXT_TYPES.map((t) => ({
                  value: t,
                  label: STORY_CONTEXT_LABELS[t],
                }))}
                onValueChange={(v) => setContextType(v as StoryContextType)}
                disabled={pending}
              />
            </Field>
          </div>
        </div>
      </div>

      {/* Selected Words Tray / Summary */}
      {allTargetWords.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-card border border-line bg-surface-2 p-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-ink">
              Từ vựng đã chọn ({allTargetWords.length} từ):
            </span>
            <span className="text-muted">
              {selectedCards.length} từ bộ thẻ · {manualWordList.length} từ tự nhập
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
            {selectedCards.map((card) => (
              <span
                key={`card-${card.id}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent-soft px-3 py-1 text-xs font-medium text-ink shadow-2xs"
              >
                <span className="font-semibold">{card.word}</span>
                {card.meaning ? (
                  <span className="text-muted truncate max-w-[120px] font-normal">
                    · {card.meaning}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => removeCard(card.id)}
                  disabled={pending}
                  className="rounded-full p-0.5 hover:bg-black/10 transition-colors"
                  title="Bỏ từ này"
                >
                  <X size={12} />
                </button>
              </span>
            ))}

            {manualWordList.map((word, idx) => (
              <span
                key={`manual-${idx}-${word}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink shadow-2xs"
              >
                <span>{word}</span>
                <span className="text-muted text-2xs italic font-normal">(tự nhập)</span>
                <button
                  type="button"
                  onClick={() => removeManualWord(word)}
                  disabled={pending}
                  className="rounded-full p-0.5 hover:bg-black/10 transition-colors"
                  title="Bỏ từ này"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {error ? <FormMessage>{error}</FormMessage> : null}
      {pending ? <Generating what="viết đoạn văn" /> : null}

      {/* Generation Result */}
      {result ? (
        <article className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-xl font-semibold">{result.title}</h2>
            <Button
              variant="secondary"
              onClick={() => copyToClipboard(result.storyText, "story")}
              className="shrink-0 h-9 px-3.5 text-xs"
            >
              {copied === "story" ? (
                <>
                  <Check size={14} className="text-accent" />
                  Đã chép
                </>
              ) : (
                <>
                  <Copy size={14} />
                  Sao chép đoạn văn
                </>
              )}
            </Button>
          </div>

          <p className="whitespace-pre-line leading-relaxed text-ink/90 font-serif sm:text-lg">
            {highlightStoryWords(
              result.storyText,
              result.targetWords.length > 0 ? result.targetWords : allTargetWords,
            )}
          </p>

          <div className="border-t border-line pt-4 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-muted font-medium">
              <span>Bản dịch Tiếng Việt</span>
              <button
                type="button"
                onClick={() => copyToClipboard(result.translationText, "translation")}
                className="inline-flex items-center gap-1 hover:text-ink transition-colors"
              >
                {copied === "translation" ? (
                  <Check size={12} className="text-accent" />
                ) : (
                  <Copy size={12} />
                )}
                {copied === "translation" ? "Đã chép dịch" : "Chép dịch"}
              </button>
            </div>
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted">
              {result.translationText}
            </p>
          </div>

          {result.targetWords.length > 0 ? (
            <div className="border-t border-line pt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted">
              <span>Đã lồng ghép thành công:</span>
              {result.targetWords.map((word) => (
                <span
                  key={word}
                  className="rounded-md bg-accent-soft px-2 py-0.5 font-medium text-accent-text"
                >
                  {word}
                </span>
              ))}
            </div>
          ) : null}
        </article>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button
          onClick={generate}
          disabled={pending || allTargetWords.length === 0}
        >
          {result ? "Viết lại" : `Viết đoạn văn (${allTargetWords.length} từ)`}
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
            <p className="font-medium text-ink">{item.english}</p>
            <p className="text-sm text-muted">{item.vietnamese}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SituationPanel() {
  const router = useRouter();
  const [context, setContext] = useState("");
  const [level, setLevel] = useState<string>("B1");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SituationalLearningResponse | null>(null);
  const [empty, setEmpty] = useState(false);

  // Vocabulary deck & cards state
  const [deckTitle, setDeckTitle] = useState("");
  const [deckDesc, setDeckDesc] = useState("");
  const [vocabCards, setVocabCards] = useState<ExtractedCard[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingCardData, setEditingCardData] = useState<ExtractedCard | null>(null);
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [newCard, setNewCard] = useState<ExtractedCard>({
    word: "",
    meaning: "",
    phonetic: "",
    partOfSpeech: "",
    definitionEn: "",
    exampleSentence: "",
    exampleMeaning: "",
    imageUrl: "",
    audioUrl: "",
    note: "",
    position: 0,
  });

  // Saving destination state
  const [saveMode, setSaveMode] = useState<"NEW" | "EXISTING">("NEW");
  const [decks, setDecks] = useState<DeckResponse[]>([]);
  const [decksLoading, setDecksLoading] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState<number | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  // Load saved decks for "Save to existing deck"
  useEffect(() => {
    let active = true;
    setDecksLoading(true);
    listMyDecks(1, 100)
      .then((res) => {
        if (!active) return;
        setDecks(res.content);
        if (res.content.length > 0 && selectedDeckId === null) {
          setSelectedDeckId(res.content[0].id);
        }
      })
      .catch(() => {
        if (active) setDecks([]);
      })
      .finally(() => {
        if (active) setDecksLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function generate() {
    setPending(true);
    setError(null);
    setResult(null);
    setEmpty(false);
    setEditingIndex(null);
    setIsAddingCard(false);
    aiSituationalLearning({ context, cefrLevel: level })
      .then((data) => {
        if (situationalLessonIsEmpty(data)) {
          setEmpty(true);
        } else {
          setResult(data);
          setDeckTitle(`Từ vựng tình huống: ${context.trim()}`);
          setDeckDesc(`Bộ từ vựng tiếng Anh theo tình huống: ${context.trim()} (${level})`);
          // Map vocabularies (ExtractedCard[]) directly into editable draft cards
          const initialCards: ExtractedCard[] = (data.vocabularies ?? []).map((item, idx) => ({
            word: item.word?.trim() ?? "",
            meaning: item.meaning?.trim() ?? "",
            phonetic: item.phonetic ?? "",
            partOfSpeech: item.partOfSpeech ?? "",
            definitionEn: item.definitionEn ?? "",
            exampleSentence: item.exampleSentence ?? "",
            exampleMeaning: item.exampleMeaning ?? "",
            imageUrl: item.imageUrl ?? "",
            audioUrl: item.audioUrl ?? "",
            note: item.note ?? "Từ vựng tình huống",
            position: item.position ?? idx + 1,
          }));
          setVocabCards(initialCards);
        }
      })
      .catch((e) => setError(errorText(e)))
      .finally(() => setPending(false));
  }

  function startEditCard(index: number) {
    setEditingIndex(index);
    setEditingCardData({ ...vocabCards[index] });
    setIsAddingCard(false);
  }

  function saveEditCard() {
    if (editingIndex === null || !editingCardData) return;
    const next = [...vocabCards];
    next[editingIndex] = editingCardData;
    setVocabCards(next);
    setEditingIndex(null);
    setEditingCardData(null);
  }

  function cancelEditCard() {
    setEditingIndex(null);
    setEditingCardData(null);
  }

  function deleteCard(index: number) {
    const next = vocabCards.filter((_, i) => i !== index);
    setVocabCards(next);
    if (editingIndex === index) {
      setEditingIndex(null);
      setEditingCardData(null);
    }
  }

  function addCard() {
    if (!newCard.word.trim() || !newCard.meaning.trim()) return;
    setVocabCards((prev) => [...prev, { ...newCard, position: prev.length + 1 }]);
    setNewCard({
      word: "",
      meaning: "",
      phonetic: "",
      partOfSpeech: "",
      definitionEn: "",
      exampleSentence: "",
      exampleMeaning: "",
      imageUrl: "",
      audioUrl: "",
      note: "",
      position: 0,
    });
    setIsAddingCard(false);
  }

  async function saveDeck() {
    if (vocabCards.length === 0) return;
    setError(null);
    try {
      let targetDeckId = selectedDeckId;
      if (saveMode === "NEW" || !targetDeckId) {
        setSaving("Đang tạo bộ thẻ mới…");
        const created = await createDeck({
          title: deckTitle.trim() || `Từ vựng: ${context}`,
          description: deckDesc.trim() || `Tình huống ${level}`,
          sourceLanguage: "en",
          targetLanguage: "vi",
          visibility: "PRIVATE",
          isOfficial: false,
        });
        targetDeckId = created.id;
      }

      let saved = 0;
      for (const card of vocabCards) {
        setSaving(`Đang lưu thẻ ${saved + 1}/${vocabCards.length}…`);
        await createCard(targetDeckId, {
          word: card.word.trim(),
          meaning: card.meaning.trim(),
          phonetic: card.phonetic?.trim() || undefined,
          partOfSpeech: card.partOfSpeech?.trim() || undefined,
          definitionEn: card.definitionEn?.trim() || undefined,
          exampleSentence: card.exampleSentence?.trim() || undefined,
          exampleMeaning: card.exampleMeaning?.trim() || undefined,
          note: card.note?.trim() || undefined,
          position: saved + 1,
        });
        saved += 1;
      }

      setSaving(null);
      router.push(`/decks/${targetDeckId}`);
    } catch (e) {
      setSaving(null);
      setError(errorText(e));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <Field id="sit-context" label="Tình huống">
          <TextInput
            id="sit-context"
            value={context}
            placeholder="ví dụ: đi phỏng vấn vị trí Java Developer"
            onChange={(event) => setContext(event.target.value)}
            disabled={pending || saving !== null}
          />
        </Field>
        <Field id="sit-level" label="Trình độ" className="sm:w-40">
          <SelectDropdown
            id="sit-level"
            value={level}
            options={CEFR_LEVELS.map((l) => ({ value: l, label: l }))}
            onValueChange={(v) => setLevel(v)}
            disabled={pending || saving !== null}
          />
        </Field>
      </div>

      {error ? <FormMessage>{error}</FormMessage> : null}
      {pending ? <Generating what="dựng bài học tình huống" /> : null}
      {saving ? <p className="text-sm text-muted">{saving}</p> : null}

      {empty ? (
        <EmptyState
          title="Không dựng được bài học"
          body="Máy chủ báo thành công nhưng không trả về nội dung nào. Thử mô tả tình huống cụ thể hơn, hoặc thử lại."
        />
      ) : null}

      {result ? (
        <div className="flex flex-col gap-6">
          {/* 1. Situational Lesson Dialogue & Actions */}
          <div className="flex flex-col gap-6 rounded-card border border-line bg-surface p-6 shadow-sm">
            <h3 className="font-semibold text-ink text-base">
              Nội dung bài học tình huống
            </h3>
            <div className="grid gap-6 sm:grid-cols-2">
              <SentenceList title="Hành động chính" items={result.mainActions} />
              <SentenceList title="Câu giao tiếp" items={result.interactions} />
              <SentenceList title="Cảm xúc" items={result.emotions} />
              <SentenceList title="Câu ngắn" items={result.shortCaptions} />
            </div>
          </div>

          {/* 2. Vocabulary Deck Builder (Cards Editable, Addable, Deletable) */}
          <div className="flex flex-col gap-5 rounded-card border border-line bg-surface p-6 shadow-sm">
            {/* Header & Add Card Action */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
              <div>
                <h3 className="font-semibold text-ink text-base flex items-center gap-2">
                  <Cards size={18} className="text-accent" />
                  Bộ thẻ từ vựng tình huống ({vocabCards.length} thẻ)
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Các từ vựng cốt lõi trích xuất từ tình huống. Bạn có thể chỉnh sửa, xóa hoặc bổ sung thẻ trước khi lưu.
                </p>
              </div>

              {!isAddingCard ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingCard(true);
                    setEditingIndex(null);
                  }}
                  disabled={saving !== null}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 text-xs font-medium text-ink transition-colors hover:bg-surface-2 hover:border-ink/20 shadow-2xs shrink-0 active:scale-[0.98]"
                >
                  <Plus size={14} weight="bold" />
                  Thêm thẻ mới
                </button>
              ) : null}
            </div>

            {/* Add New Card Form */}
            {isAddingCard ? (
              <div className="flex flex-col gap-3 my-2">
                <span className="text-sm font-semibold text-accent-text flex items-center gap-1.5 px-1">
                  <Plus size={16} weight="bold" />
                  Thêm thẻ từ vựng mới vào bộ
                </span>
                <CardFormInputs
                  card={newCard}
                  onChange={setNewCard}
                  onSave={addCard}
                  onCancel={() => setIsAddingCard(false)}
                  saveLabel="Thêm vào bộ thẻ"
                />
              </div>
            ) : null}

            {/* Vocabulary Cards List */}
            {vocabCards.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">
                Chưa có thẻ từ vựng nào. Hãy bấm &quot;Thêm thẻ mới&quot;.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {vocabCards.map((card, index) => (
                  <li key={`vocab-card-${index}`} className="py-3">
                    {editingIndex === index && editingCardData ? (
                      <CardFormInputs
                        card={editingCardData}
                        onChange={setEditingCardData}
                        onSave={saveEditCard}
                        onCancel={cancelEditCard}
                        saveLabel="Lưu thay đổi"
                      />
                    ) : (
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-2xs font-mono font-medium text-muted">
                              #{index + 1}
                            </span>
                            <p className="font-semibold text-ink">{card.word}</p>
                            {card.phonetic ? (
                              <span className="font-mono text-xs text-muted">
                                {card.phonetic}
                              </span>
                            ) : null}
                            {card.partOfSpeech ? (
                              <span className="text-2xs uppercase tracking-wider text-muted font-medium">
                                ({card.partOfSpeech})
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm text-ink/90">{card.meaning}</p>
                          {card.exampleSentence ? (
                            <div className="mt-1.5 rounded-md bg-surface-2/60 p-2 text-xs">
                              <p className="text-ink/80 italic font-serif">
                                &quot;{card.exampleSentence}&quot;
                              </p>
                              {card.exampleMeaning ? (
                                <p className="mt-0.5 text-muted">
                                  {card.exampleMeaning}
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                        </div>

                        {/* Action buttons */}
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => startEditCard(index)}
                            disabled={saving !== null}
                            className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-ink transition-colors"
                            title="Chỉnh sửa thẻ này"
                          >
                            <PencilSimple size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteCard(index)}
                            disabled={saving !== null}
                            className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-danger transition-colors"
                            title="Xoá thẻ này"
                          >
                            <Trash size={16} />
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {/* Destination Deck Options */}
            <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface-2 p-4 mt-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Tùy chọn lưu bộ thẻ:
                </span>

                <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setSaveMode("NEW")}
                    className={cn(
                      "rounded-md px-2.5 py-1 font-medium transition-colors",
                      saveMode === "NEW"
                        ? "bg-accent text-accent-fg shadow-2xs"
                        : "text-muted hover:text-ink",
                    )}
                  >
                    Tạo bộ thẻ mới
                  </button>
                  <button
                    type="button"
                    onClick={() => setSaveMode("EXISTING")}
                    disabled={decks.length === 0}
                    className={cn(
                      "rounded-md px-2.5 py-1 font-medium transition-colors disabled:opacity-50",
                      saveMode === "EXISTING"
                        ? "bg-accent text-accent-fg shadow-2xs"
                        : "text-muted hover:text-ink",
                    )}
                  >
                    Lưu vào bộ đã có ({decks.length})
                  </button>
                </div>
              </div>

              {saveMode === "NEW" ? (
                <div className="grid gap-3 sm:grid-cols-[1fr_1.5fr]">
                  <Field id="sit-deck-title" label="Tên bộ thẻ">
                    <TextInput
                      id="sit-deck-title"
                      value={deckTitle}
                      onChange={(e) => setDeckTitle(e.target.value)}
                      disabled={saving !== null}
                      className="h-9 text-sm"
                    />
                  </Field>
                  <Field id="sit-deck-desc" label="Mô tả">
                    <TextInput
                      id="sit-deck-desc"
                      value={deckDesc}
                      onChange={(e) => setDeckDesc(e.target.value)}
                      disabled={saving !== null}
                      className="h-9 text-sm"
                    />
                  </Field>
                </div>
              ) : (
                <Field id="sit-deck-select" label="Chọn bộ thẻ đã lưu">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        id="sit-deck-select"
                        type="button"
                        disabled={saving !== null || decksLoading || decks.length === 0}
                        className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3.5 text-sm text-ink transition-colors hover:border-ink/25"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Cards size={16} className="shrink-0 text-accent" />
                          <span className="truncate font-medium">
                            {decks.find((d) => d.id === selectedDeckId)?.title ?? "Chọn một bộ thẻ..."}
                          </span>
                          {decks.find((d) => d.id === selectedDeckId)?.totalCards !== undefined ? (
                            <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-2xs text-muted">
                              {decks.find((d) => d.id === selectedDeckId)?.totalCards} thẻ
                            </span>
                          ) : null}
                        </div>
                        <CaretDown size={14} className="shrink-0 text-muted" />
                      </button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent
                      align="start"
                      className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-64 overflow-y-auto"
                    >
                      <DropdownMenuLabel>Bộ thẻ đã lưu ({decks.length})</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {decks.map((deck) => {
                        const isSelected = deck.id === selectedDeckId;
                        return (
                          <DropdownMenuItem
                            key={deck.id}
                            onClick={() => setSelectedDeckId(deck.id)}
                            className={cn(
                              "flex items-center justify-between py-2",
                              isSelected && "bg-accent-soft/40 font-medium text-accent-text",
                            )}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <Cards size={15} className={isSelected ? "text-accent" : "text-muted"} />
                              <span className="truncate">{deck.title}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs text-muted">
                                {deck.totalCards ?? 0} thẻ
                              </span>
                              {isSelected ? (
                                <Check size={13} weight="bold" className="text-accent" />
                              ) : null}
                            </div>
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </Field>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2.5">
        {result ? (
          <Button
            onClick={saveDeck}
            disabled={saving !== null || vocabCards.length === 0}
          >
            Lưu thành bộ thẻ ({vocabCards.length} thẻ)
          </Button>
        ) : null}
        <Button
          variant={result || empty ? "secondary" : "primary"}
          onClick={generate}
          disabled={pending || !context.trim() || saving !== null}
        >
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
          <SelectDropdown
            id="rp-scenario"
            value={scenario}
            options={ROLEPLAY_SCENARIOS.map((s) => ({
              value: s,
              label: s.replace(/_/g, " ").toLowerCase(),
            }))}
            onValueChange={(v) => setScenario(v)}
            disabled={pending}
          />
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
