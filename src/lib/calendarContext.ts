export type CalendarContext = {
  dayOfWeek: number;
  dayName: string;
  dayType: "weekday" | "weekend" | "holiday";
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName: string | null;
  timeBand:
    | "early_morning"
    | "morning"
    | "daytime"
    | "evening"
    | "night"
    | "late_night";
};

const dayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const tokyoTimeZone = "Asia/Tokyo";

export function buildCalendarContext(date = new Date()): CalendarContext {
  const tokyoDate = getTokyoDateParts(date);
  const dayOfWeek = tokyoDate.dayOfWeek;
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  return {
    dayOfWeek,
    dayName: dayNames[dayOfWeek],
    dayType: isWeekend ? "weekend" : "weekday",
    isWeekend,
    isHoliday: false,
    holidayName: null,
    timeBand: getTimeBand(tokyoDate.hour),
  };
}

function getTokyoDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tokyoTimeZone,
    weekday: "long",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const weekday =
    parts.find((part) => part.type === "weekday")?.value ?? "Sunday";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const dayOfWeek = dayNames.indexOf(
    weekday as (typeof dayNames)[number],
  );

  return {
    dayOfWeek: dayOfWeek >= 0 ? dayOfWeek : 0,
    hour,
  };
}

function getTimeBand(hour: number): CalendarContext["timeBand"] {
  if (hour >= 4 && hour <= 6) {
    return "early_morning";
  }

  if (hour >= 7 && hour <= 10) {
    return "morning";
  }

  if (hour >= 11 && hour <= 16) {
    return "daytime";
  }

  if (hour >= 17 && hour <= 19) {
    return "evening";
  }

  if (hour >= 20 && hour <= 23) {
    return "night";
  }

  return "late_night";
}
