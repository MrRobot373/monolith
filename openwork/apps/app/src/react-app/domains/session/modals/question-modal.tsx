/** @jsxImportSource react */
import { useEffect, useReducer } from "react";
import type { QuestionInfo } from "@opencode-ai/sdk/v2/client";
import { Check, ChevronRight, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { t } from "@/i18n";

export type QuestionPanelProps = {
  questions: QuestionInfo[];
  busy: boolean;
  onReply: (answers: string[][]) => void;
};

type QuestionState = {
  currentIndex: number;
  answers: string[][];
  currentSelection: string[];
  customInput: string;
  customAnswerActive: boolean;
  focusedOptionIndex: number;
};

type QuestionAction =
  | { type: "reset"; questionCount: number }
  | { type: "setCustomInput"; value: string }
  | { type: "setCustomAnswerActive"; value: boolean }
  | { type: "setFocusedOptionIndex"; value: number }
  | { type: "moveFocusedOption"; direction: 1 | -1; optionsCount: number }
  | { type: "toggleMultipleOption"; option: string }
  | { type: "selectOption"; option: string }
  | { type: "advance"; answers: string[][] }
  | { type: "setAnswers"; answers: string[][] };

const initialQuestionState: QuestionState = {
  currentIndex: 0,
  answers: [],
  currentSelection: [],
  customInput: "",
  customAnswerActive: false,
  focusedOptionIndex: 0,
};

function questionReducer(state: QuestionState, action: QuestionAction): QuestionState {
  switch (action.type) {
    case "reset":
      return {
        currentIndex: 0,
        answers: new Array(action.questionCount).fill([]),
        currentSelection: [],
        customInput: "",
        customAnswerActive: false,
        focusedOptionIndex: 0,
      };
    case "setCustomInput":
      return { ...state, customInput: action.value };
    case "setCustomAnswerActive":
      return { ...state, customAnswerActive: action.value };
    case "setFocusedOptionIndex":
      return { ...state, focusedOptionIndex: action.value };
    case "moveFocusedOption":
      if (action.optionsCount <= 0) return state;
      return {
        ...state,
        focusedOptionIndex:
          (state.focusedOptionIndex + action.direction + action.optionsCount) %
          action.optionsCount,
      };
    case "toggleMultipleOption": {
      const selected = state.currentSelection.includes(action.option)
        ? state.currentSelection.filter((option) => option !== action.option)
        : [...state.currentSelection, action.option];
      return { ...state, currentSelection: selected };
    }
    case "selectOption":
      return { ...state, currentSelection: [action.option] };
    case "advance":
      return {
        ...state,
        answers: action.answers,
        currentIndex: state.currentIndex + 1,
        currentSelection: [],
        customInput: "",
        customAnswerActive: false,
        focusedOptionIndex: 0,
      };
    case "setAnswers":
      return { ...state, answers: action.answers };
  }
}

export function QuestionPanel(props: QuestionPanelProps) {
  const [state, dispatch] = useReducer(questionReducer, initialQuestionState);

  useEffect(() => {
    dispatch({ type: "reset", questionCount: props.questions.length });
  }, [props.questions]);

  const currentQuestion = props.questions[state.currentIndex];
  const options = currentQuestion?.options ?? [];
  const isLastQuestion = state.currentIndex === props.questions.length - 1;
  const customAnswerEnabled = currentQuestion?.custom !== false;
  const customAnswerVisible =
    customAnswerEnabled &&
    (state.customAnswerActive || state.customInput.trim().length > 0);
  const canProceed = (() => {
    if (!currentQuestion) return false;
    if (customAnswerEnabled && state.customInput.trim().length > 0) return true;
    return state.currentSelection.length > 0;
  })();

  const handleNext = () => {
    if (!canProceed || !currentQuestion) return;
    const nextAnswer = [...state.currentSelection];
    if (customAnswerEnabled && state.customInput.trim()) {
      nextAnswer.push(state.customInput.trim());
    }
    const newAnswers = [...state.answers];
    newAnswers[state.currentIndex] = nextAnswer;
    if (isLastQuestion) {
      dispatch({ type: "setAnswers", answers: newAnswers });
      props.onReply(newAnswers);
    } else {
      dispatch({ type: "advance", answers: newAnswers });
    }
  };

  const toggleOption = (option: string) => {
    if (!currentQuestion || props.busy) return;
    if (currentQuestion.multiple) {
      dispatch({ type: "toggleMultipleOption", option });
      return;
    }
    dispatch({ type: "selectOption", option });
    setTimeout(() => {
      const newAnswers = [...state.answers];
      newAnswers[state.currentIndex] = [option];
      if (isLastQuestion) {
        dispatch({ type: "setAnswers", answers: newAnswers });
        props.onReply(newAnswers);
      } else {
        dispatch({ type: "advance", answers: newAnswers });
      }
    }, 150);
  };

  // MONOLITH: Cowork-style skip — answer the current question with nothing
  // and move on (or submit when it's the last one).
  const handleSkip = () => {
    if (!currentQuestion || props.busy) return;
    const newAnswers = [...state.answers];
    newAnswers[state.currentIndex] = [];
    if (isLastQuestion) {
      dispatch({ type: "setAnswers", answers: newAnswers });
      props.onReply(newAnswers);
    } else {
      dispatch({ type: "advance", answers: newAnswers });
    }
  };

  // MONOLITH: keyboard interaction (↑↓ navigate · Enter select · digits jump ·
  // Esc skip) — the reducer supported focus movement but nothing dispatched it.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (props.busy || !currentQuestion) return;
    const target = event.target as HTMLElement;
    const typingInInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA";
    if (event.key === "Escape") {
      event.preventDefault();
      handleSkip();
      return;
    }
    if (typingInInput) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      dispatch({
        type: "moveFocusedOption",
        direction: event.key === "ArrowDown" ? 1 : -1,
        optionsCount: options.length,
      });
      return;
    }
    if (event.key === "Enter") {
      const focused = options[state.focusedOptionIndex];
      if (focused) {
        event.preventDefault();
        toggleOption(focused.label);
      }
      return;
    }
    if (/^[1-9]$/.test(event.key)) {
      const index = Number(event.key) - 1;
      const option = options[index];
      if (option) {
        event.preventDefault();
        dispatch({ type: "setFocusedOptionIndex", value: index });
        toggleOption(option.label);
      }
    }
  };

  if (!currentQuestion) return null;

  return (
    <div
      className="overflow-hidden rounded-2xl border border-dls-border bg-dls-surface shadow-[var(--dls-card-shadow)]"
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-start justify-between gap-3 px-4 pb-2 pt-3.5">
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold leading-6 text-dls-text">
            {currentQuestion.question || currentQuestion.header || t("common.question")}
          </div>
          {currentQuestion.header && currentQuestion.question ? (
            <div className="mt-0.5 text-[12px] leading-4 text-dls-secondary">
              {currentQuestion.header}
            </div>
          ) : null}
        </div>
        {props.questions.length > 1 ? (
          <div className="shrink-0 pt-0.5 text-[12px] font-medium text-dls-secondary">
            {t("question_modal.question_counter", undefined, {
              current: state.currentIndex + 1,
              total: props.questions.length,
            })}
          </div>
        ) : null}
      </div>

      <div className="max-h-80 overflow-auto px-2 pb-1">
        {options.length > 0 ? (
          <div>
            {options.map((opt, idx) => {
              const isSelected = state.currentSelection.includes(opt.label);
              const isFocused = state.focusedOptionIndex === idx;
              return (
                <button
                  key={`${opt.label}:${idx}`}
                  type="button"
                  disabled={props.busy}
                  className={`group flex w-full items-start gap-3 border-b border-dls-border/60 px-2 py-2.5 text-left text-sm transition-colors last:border-b-0 disabled:cursor-not-allowed disabled:opacity-60 ${
                    isFocused ? "bg-dls-hover" : "hover:bg-dls-hover/60"
                  } rounded-lg`}
                  onClick={() => {
                    dispatch({ type: "setFocusedOptionIndex", value: idx });
                    toggleOption(opt.label);
                  }}
                >
                  <span
                    className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border text-[12px] font-semibold ${
                      isSelected
                        ? "border-dls-accent bg-dls-accent text-white"
                        : "border-dls-border bg-dls-surface-muted/60 text-dls-secondary"
                    }`}
                  >
                    {isSelected ? <Check size={13} strokeWidth={3} /> : idx + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium leading-5 text-dls-text">
                      {opt.label}
                    </span>
                    {opt.description && opt.description !== opt.label ? (
                      <span className="mt-0.5 block text-[12px] leading-5 text-dls-secondary">
                        {opt.description}
                      </span>
                    ) : null}
                  </span>
                  <ChevronRight
                    size={15}
                    className={`mt-1 shrink-0 text-dls-secondary transition-opacity ${
                      isFocused ? "opacity-100" : "opacity-0 group-hover:opacity-60"
                    }`}
                  />
                </button>
              );
            })}
          </div>
        ) : null}

        {customAnswerEnabled ? (
          <div className="flex items-center gap-2 border-t border-dls-border/60 px-2 py-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-dls-border bg-dls-surface-muted/60 text-dls-secondary">
              <Pencil size={12} />
            </span>
            <input
              type="text"
              value={state.customInput}
              onFocus={() => dispatch({ type: "setCustomAnswerActive", value: true })}
              onClick={() => dispatch({ type: "setCustomAnswerActive", value: true })}
              onChange={(event) =>
                dispatch({
                  type: "setCustomInput",
                  value: event.currentTarget.value,
                })
              }
              className="w-full bg-transparent py-1.5 text-[13px] text-dls-text outline-none placeholder:text-dls-secondary"
              placeholder={t("question_modal.custom_answer_placeholder")}
              disabled={props.busy}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  if (event.nativeEvent.isComposing || event.keyCode === 229)
                    return;
                  event.stopPropagation();
                  handleNext();
                }
              }}
            />
            {customAnswerVisible ? (
              <Button
                size="sm"
                onClick={handleNext}
                disabled={!state.customInput.trim() || props.busy}
              >
                {t("question_modal.custom_answer_send")}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-dls-border/60 px-4 py-2">
        <div className="hidden items-center gap-1 text-[11px] text-dls-secondary sm:flex">
          {props.busy ? t("monolith.question.submitting") : t("monolith.question.keys_hint")}
        </div>
        <div className="flex items-center gap-2">
          {currentQuestion.multiple ? (
            <Button size="sm" onClick={handleNext} disabled={!canProceed || props.busy}>
              {isLastQuestion ? t("common.submit") : t("common.next")}
              {!isLastQuestion ? <ChevronRight data-icon="inline-end" /> : null}
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={handleSkip} disabled={props.busy}>
            {t("monolith.question.skip")}
          </Button>
        </div>
      </div>
    </div>
  );
}
