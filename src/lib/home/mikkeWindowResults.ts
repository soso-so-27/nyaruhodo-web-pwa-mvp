import { STORAGE_KEYS } from "../storage";
import { createBrowserSupabaseClient } from "../supabase/browser";
import type {
  MikkeWindow,
  MikkeWindowCount,
  MikkeWindowOption,
} from "./mikkeWindows";

type MikkeWindowCountRow = {
  answer_id: string;
  answer_label: string;
  answer_count: number;
};

export async function submitMikkeWindowAnswer({
  window: mikkeWindow,
  option,
  localCatId,
}: {
  window: MikkeWindow;
  option: MikkeWindowOption;
  localCatId: string;
}) {
  const supabase = createBrowserSupabaseClient();

  if (!supabase || typeof window === "undefined") {
    return;
  }

  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id ?? null;

  const { error } = await supabase.from("mikke_window_answers").insert({
    user_id: userId,
    anonymous_id: getOrCreateAnonymousId(),
    local_cat_id: localCatId,
    window_id: mikkeWindow.id,
    question_id: mikkeWindow.question.id,
    category: mikkeWindow.question.category,
    answer_id: option.id,
    answer_label: option.label,
    metadata: {
      source: "home_mikke_window",
    },
    answered_at: new Date().toISOString(),
  });

  if (error && error.code !== "23505") {
    throw new Error(error.message);
  }
}

export async function fetchMikkeWindowCounts(
  window: MikkeWindow,
): Promise<MikkeWindowCount[]> {
  const supabase = createBrowserSupabaseClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("mikke_window_answer_counts")
    .select("answer_id, answer_label, answer_count")
    .eq("window_id", window.id)
    .eq("question_id", window.question.id);

  if (error) {
    return [];
  }

  return ((data ?? []) as MikkeWindowCountRow[]).map((row) => ({
    answerId: row.answer_id,
    answerLabel: row.answer_label,
    count: row.answer_count,
  }));
}

function getOrCreateAnonymousId() {
  const existing = window.localStorage.getItem(STORAGE_KEYS.analyticsAnonymousId);
  if (existing) {
    return existing;
  }

  const nextId =
    window.crypto?.randomUUID?.() ??
    `anon-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(STORAGE_KEYS.analyticsAnonymousId, nextId);
  return nextId;
}
