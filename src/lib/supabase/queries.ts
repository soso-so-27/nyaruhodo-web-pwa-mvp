import { supabase } from "./client";
import type { CalendarContext } from "../calendarContext";

type InsertEventInput = {
  event_type: "current_state" | "concern";
  signal: string;
  label?: string;
  source?: "home";
  context?: Record<string, unknown>;
  calendarContext?: CalendarContext | null;
  localCatId?: string | null;
};

type InsertDiagnosisInput = {
  event_id?: string | null;
  input_signal: string;
  scores: Record<string, number>;
  selected_categories: string[];
  primary_category: string;
  secondary_category?: string | null;
  context?: Record<string, unknown>;
  calendarContext?: CalendarContext | null;
  localCatId?: string | null;
};

type InsertFeedbackInput = {
  diagnosis_id?: string | null;
  feedback: "resolved" | "unresolved";
  category?: string | null;
  localCatId?: string | null;
};

type InsertHintFeedbackInput = {
  localCatId?: string | null;
  hintType?: string;
  shownCategory?: string | null;
  shownSignal?: string | null;
  feedback: "accepted" | "rejected" | "dismissed" | string;
  understandingPercent?: number | null;
  sourceEventIds?: string[] | null;
  calendarContext?: CalendarContext | Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
};

export type RecentEvent = {
  id: string;
  event_type: string;
  signal: string;
  label: string | null;
  source: string;
  context: Record<string, unknown>;
  calendar_context: CalendarContext | null;
  local_cat_id: string | null;
  occurred_at: string;
  created_at: string;
};

export async function getRecentEvents(
  localCatId?: string | null,
): Promise<RecentEvent[]> {
  try {
    if (!supabase) {
      throw new Error("Supabase client is not configured");
    }

    let query = supabase
      .from("events")
      .select(
        "id,event_type,signal,label,source,context,calendar_context,local_cat_id,occurred_at,created_at",
      )
      .eq("source", "home")
      .order("occurred_at", { ascending: false })
      .limit(localCatId ? 20 : 100);

    if (localCatId) {
      query = query.eq("local_cat_id", localCatId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return (data ?? []) as RecentEvent[];
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function insertEvent(input: InsertEventInput) {
  try {
    if (!supabase) {
      throw new Error("Supabase client is not configured");
    }

    const id = crypto.randomUUID();
    const { error } = await supabase
      .from("events")
      .insert({
        id,
        event_type: input.event_type,
        signal: input.signal,
        label: input.label ?? null,
        source: input.source ?? "home",
        context: input.context ?? {},
        calendar_context: input.calendarContext ?? null,
        local_cat_id: input.localCatId ?? null,
      });

    if (error) {
      throw error;
    }

    console.log("event saved");
    return { id };
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function insertDiagnosis(input: InsertDiagnosisInput) {
  try {
    if (!supabase) {
      throw new Error("Supabase client is not configured");
    }

    const id = crypto.randomUUID();
    const { error } = await supabase
      .from("diagnoses")
      .insert({
        id,
        event_id: input.event_id ?? null,
        input_signal: input.input_signal,
        scores: input.scores,
        selected_categories: input.selected_categories,
        primary_category: input.primary_category,
        secondary_category: input.secondary_category ?? null,
        context: input.context ?? {},
        calendar_context: input.calendarContext ?? null,
        local_cat_id: input.localCatId ?? null,
      });

    if (error) {
      throw error;
    }

    console.log("diagnosis saved");
    return { id };
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function insertFeedback(input: InsertFeedbackInput) {
  try {
    if (!input.diagnosis_id) {
      return null;
    }

    if (!supabase) {
      throw new Error("Supabase client is not configured");
    }

    const id = crypto.randomUUID();
    const { error } = await supabase
      .from("feedbacks")
      .insert({
        id,
        diagnosis_id: input.diagnosis_id,
        feedback: input.feedback,
        category: input.category ?? null,
        local_cat_id: input.localCatId ?? null,
      });

    if (error) {
      throw error;
    }

    console.log("feedback saved");
    return { id };
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function insertHintFeedback(input: InsertHintFeedbackInput) {
  try {
    if (!supabase) {
      throw new Error("Supabase client is not configured");
    }

    const id = crypto.randomUUID();
    const { error } = await supabase
      .from("hint_feedbacks")
      .insert({
        id,
        local_cat_id: input.localCatId ?? null,
        hint_type: input.hintType ?? "current_cat",
        shown_category: input.shownCategory ?? null,
        shown_signal: input.shownSignal ?? null,
        feedback: input.feedback,
        understanding_percent: input.understandingPercent ?? null,
        source_event_ids: input.sourceEventIds ?? null,
        calendar_context: input.calendarContext ?? null,
        metadata: input.metadata ?? {},
      });

    if (error) {
      throw error;
    }

    console.log("hint feedback saved");
    return { id };
  } catch (error) {
    console.error(error);
    return null;
  }
}
