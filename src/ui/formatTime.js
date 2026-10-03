// Shared time formatter for "Dodge the FUD" UI screens.
// Formats a millisecond duration as mm:ss.cs (centiseconds).

export function formatTime(ms) {
  const total = Number.isFinite(ms) && ms > 0 ? ms : 0;
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const centis = Math.floor((total % 1000) / 10);
  const pad = (n, w = 2) => String(n).padStart(w, "0");
  return `${pad(minutes)}:${pad(seconds)}.${pad(centis)}`;
}

// Convenience wrapper for callers holding seconds (float) instead of ms.
export function formatSeconds(seconds) {
  return formatTime((Number.isFinite(seconds) ? seconds : 0) * 1000);
}
