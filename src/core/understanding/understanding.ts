export function calculateUnderstandingPercent(eventCount: number) {
  return Math.min(100, Math.max(0, eventCount * 5));
}

export function getUnderstandingMessage(percent: number) {
  if (percent === 0) {
    return "\u307e\u3060\u3053\u308c\u304b\u3089";
  }

  if (percent <= 30) {
    return "\u5c11\u3057\u305a\u3064\u308f\u304b\u3063\u3066\u304d\u307e\u3057\u305f";
  }

  if (percent <= 60) {
    return "\u3060\u3093\u3060\u3093\u50be\u5411\u304c\u898b\u3048\u3066\u304d\u307e\u3057\u305f";
  }

  if (percent <= 90) {
    return "\u304b\u306a\u308a\u7406\u89e3\u3067\u304d\u3066\u304d\u307e\u3057\u305f";
  }

  return "\u30df\u30b1\u306e\u3053\u3068\u3001\u304b\u306a\u308a\u898b\u3048\u3066\u304d\u307e\u3057\u305f";
}
