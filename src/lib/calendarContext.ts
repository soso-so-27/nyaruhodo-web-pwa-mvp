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

export function buildCalendarContext(date = new Date()): CalendarContext {
  const dayOfWeek = date.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  return {
    dayOfWeek,
    dayName: dayNames[dayOfWeek],
    dayType: isWeekend ? "weekend" : "weekday",
    isWeekend,
    isHoliday: false,
    holidayName: null,
    timeBand: getTimeBand(date),
  };
}

function getTimeBand(date: Date): CalendarContext["timeBand"] {
  const hour = date.getHours();

  if (hour >= 4 && hour <= 6) {
    return "early_morning";
  }

  if (hour >= 7 && hour <= 10) {
    return "morning";
  }

  if (hour >= 11 && hour <= 16) {
    return "daytime";
  }

  if (hour >= 17 && hour <= 20) {
    return "evening";
  }

  if (hour >= 21 && hour <= 23) {
    return "night";
  }

  return "late_night";
}
