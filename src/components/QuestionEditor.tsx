"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/LocaleProvider";
import type { Question } from "@/lib/game/types";

function isComplete(question: Question) {
  return Boolean(question.text.trim() && question.options.every((opt) => opt.trim()));
}

export function QuestionEditor({
  questions,
  timeLimitSec,
  busy,
  initialIndex = 0,
  lockedThrough = -1,
  onChange,
  onTimeLimit,
  onSave,
  spare,
  onSpare,
}: {
  questions: Question[];
  timeLimitSec: number;
  busy: boolean;
  initialIndex?: number;
  /** Indexes at or below this already ran and cannot be removed. */
  lockedThrough?: number;
  onChange: (questions: Question[]) => void;
  onTimeLimit: (seconds: number) => void;
  onSave: () => void;
  spare: Question;
  onSpare: (question: Question) => void;
}) {
  const { t } = useLocale();
  const [index, setIndex] = useState(() =>
    Math.min(Math.max(0, initialIndex), Math.max(0, questions.length - 1)),
  );
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const dragFromRef = useRef<number | null>(null);

  useEffect(() => {
    setIndex((current) =>
      Math.min(current, Math.max(0, questions.length - 1)),
    );
  }, [questions.length]);

  const question = questions[index];
  if (!question) return null;

  function update(next: Question) {
    onChange(questions.map((item, i) => (i === index ? next : item)));
  }

  function removeAt(target: number) {
    if (questions.length <= 1 || target <= lockedThrough) return;
    onChange(questions.filter((_, i) => i !== target));
    setIndex((current) => {
      if (target < current) return current - 1;
      if (target === current) return Math.min(current, questions.length - 2);
      return current;
    });
  }

  function pointToIndex(clientX: number, clientY: number) {
    const el = document.elementFromPoint(clientX, clientY);
    const row = el?.closest("[data-q-index]");
    if (!row) return null;
    const next = Number(row.getAttribute("data-q-index"));
    return Number.isNaN(next) ? null : next;
  }

  function reorder(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || to >= questions.length) return;
    const next = [...questions];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
    setIndex((current) => {
      if (current === from) return to;
      if (from < current && to >= current) return current - 1;
      if (from > current && to <= current) return current + 1;
      return current;
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[15rem_1fr]">
      <div className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
        <p className="hidden text-xs text-[var(--muted)] lg:block">
          {t("admin.dragToReorder")}
        </p>
        {questions.map((item, i) => {
          const selected = i === index;
          const label = item.text.trim() || t("admin.emptyQuestion");
          const canRemove = questions.length > 1 && i > lockedThrough;
          return (
            <div
              key={item.id}
              data-q-index={i}
              role="button"
              tabIndex={0}
              onClick={() => setIndex(i)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setIndex(i);
                }
              }}
              className={`flex min-w-52 shrink-0 gap-2 rounded-2xl px-2 py-2 text-left lg:min-w-0 ${
                selected
                  ? "bg-[var(--accent-soft)] ring-2 ring-[var(--accent)]"
                  : "bg-[var(--surface-2)]"
              } ${dragFrom === i ? "opacity-50" : ""} ${
                dragOver === i && dragFrom !== i ? "ring-2 ring-[var(--cream)]" : ""
              }`}
            >
              <span
                role="button"
                tabIndex={-1}
                aria-label={t("admin.dragToReorder")}
                className="grid w-8 shrink-0 cursor-grab touch-none place-items-center rounded-xl text-lg text-[var(--muted)] active:cursor-grabbing"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  dragFromRef.current = i;
                  setDragFrom(i);
                  setDragOver(i);
                }}
                onPointerMove={(event) => {
                  if (dragFromRef.current == null) return;
                  const over = pointToIndex(event.clientX, event.clientY);
                  if (over != null) setDragOver(over);
                }}
                onPointerUp={(event) => {
                  const over = pointToIndex(event.clientX, event.clientY);
                  const from = dragFromRef.current;
                  dragFromRef.current = null;
                  setDragFrom(null);
                  setDragOver(null);
                  if (from != null) reorder(from, over ?? from);
                }}
                onClick={(event) => event.stopPropagation()}
              >
                ⋮⋮
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2 text-xs text-[var(--muted)]">
                  {t("admin.questionN", { n: i + 1 })}
                  <span
                    className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${
                      selected
                        ? "bg-[var(--cream)] text-[var(--navy)]"
                        : "bg-[var(--surface)] text-[var(--text)]"
                    }`}
                  >
                    {String.fromCharCode(65 + item.correctIndex)}
                  </span>
                </span>
                <span
                  className={`mt-1 line-clamp-2 block text-sm ${
                    item.text.trim() ? "" : "text-[var(--muted)]"
                  }`}
                >
                  {label}
                </span>
                {!isComplete(item) && (
                  <span className="mt-1 block text-xs text-[var(--warning)]">
                    {t("admin.incomplete")}
                  </span>
                )}
              </span>
              {canRemove && (
                <button
                  type="button"
                  className="grid h-8 w-8 shrink-0 place-items-center self-start rounded-full text-lg text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--danger)]"
                  aria-label={t("admin.removeQuestion", { n: i + 1 })}
                  onClick={(event) => {
                    event.stopPropagation();
                    removeAt(i);
                  }}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
        <button
          type="button"
          className="btn btn-ghost shrink-0"
          onClick={() => {
            const added: Question = {
              id: crypto.randomUUID(),
              text: "",
              options: ["", "", "", ""],
              correctIndex: 0,
              timeLimitSec,
            };
            onChange([...questions, added]);
            setIndex(questions.length);
          }}
        >
          {t("admin.addQuestion")}
        </button>
      </div>

      <div className="space-y-4 rounded-2xl bg-[var(--surface-2)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-display text-xl">
            {t("admin.questionOf", {
              n: index + 1,
              total: questions.length,
            })}
          </p>
          <label className="flex items-center gap-2 text-sm whitespace-nowrap text-[var(--muted)]">
            {t("admin.seconds")}
            <input
              className="input max-w-24"
              type="number"
              min={5}
              max={180}
              value={timeLimitSec}
              onChange={(e) => onTimeLimit(Number(e.target.value) || 30)}
            />
          </label>
        </div>

        <textarea
          className="input min-h-24 resize-y text-lg"
          value={question.text}
          onChange={(e) => update({ ...question, text: e.target.value })}
        />

        <p className="text-sm text-[var(--muted)]">{t("admin.markCorrect")}</p>
        <div className="grid gap-2" role="radiogroup" aria-label={t("admin.markCorrect")}>
          {question.options.map((opt, optionIndex) => {
            const selected = question.correctIndex === optionIndex;
            const letter = String.fromCharCode(65 + optionIndex);
            return (
              <div
                key={optionIndex}
                className={`flex items-center gap-2 rounded-2xl p-2 ${
                  selected ? "bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]" : ""
                }`}
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-lg font-bold ${
                    selected
                      ? "bg-[var(--cream)] text-[var(--navy)]"
                      : "bg-[var(--surface)] text-[var(--text)]"
                  }`}
                  onClick={() =>
                    update({
                      ...question,
                      correctIndex: optionIndex as 0 | 1 | 2 | 3,
                    })
                  }
                >
                  {letter}
                </button>
                <input
                  className="input"
                  value={opt}
                  onChange={(e) => {
                    const options = [...question.options] as Question["options"];
                    options[optionIndex] = e.target.value;
                    update({ ...question, options });
                  }}
                />
              </div>
            );
          })}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={onSave}
          >
            {t("admin.saveQuestions")}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--line)] p-4 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-display text-xl">{t("admin.tiebreaker")}</p>
            <p className="text-sm text-[var(--muted)]">{t("admin.tiebreakerHint")}</p>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() =>
              onSpare({
                ...spare,
                text: "",
                options: ["", "", "", ""],
                correctIndex: 0,
              })
            }
          >
            {t("admin.clearTiebreaker")}
          </button>
        </div>
        <textarea
          className="input mt-3 min-h-20 resize-y"
          value={spare.text}
          placeholder={t("admin.tiebreakerPlaceholder")}
          onChange={(e) => onSpare({ ...spare, text: e.target.value })}
        />
        <div className="mt-3 grid gap-2">
          {spare.options.map((opt, optionIndex) => {
            const selected = spare.correctIndex === optionIndex;
            const letter = String.fromCharCode(65 + optionIndex);
            return (
              <div key={optionIndex} className="flex items-center gap-2">
                <button
                  type="button"
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-lg font-bold ${
                    selected
                      ? "bg-[var(--cream)] text-[var(--navy)]"
                      : "bg-[var(--surface)] text-[var(--text)]"
                  }`}
                  onClick={() =>
                    onSpare({
                      ...spare,
                      correctIndex: optionIndex as 0 | 1 | 2 | 3,
                    })
                  }
                >
                  {letter}
                </button>
                <input
                  className="input"
                  value={opt}
                  onChange={(e) => {
                    const options = [...spare.options] as Question["options"];
                    options[optionIndex] = e.target.value;
                    onSpare({ ...spare, options });
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
