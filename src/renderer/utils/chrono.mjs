// Reglas puras del cronómetro del servidor, separadas para poder probarlas.

export function formatChrono(seconds) {
  if (seconds === null || seconds === undefined) return "--:--";

  const value = Number(seconds);
  if (!Number.isFinite(value)) return "--:--";

  const total = Math.max(0, Math.ceil(value));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;

  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

// `tick` = { duration, t, receivedAt, paused }. `nowMs` viene de performance.now().
export function remainingForTick(tick, nowMs) {
  if (!tick) return null;

  const duration = Number(tick.duration);
  const elapsed = Number(tick.t);
  if (!Number.isFinite(duration) || !Number.isFinite(elapsed)) return null;

  const base = Math.max(0, duration - elapsed);
  if (tick.paused) return base;

  const sinceTick = Math.max(0, (nowMs - tick.receivedAt) / 1000);
  return Math.max(0, base - sinceTick);
}

// El Chrono manda target="0" para todos; si no, IDs de estación separados por coma.
export function eventTargetsStation(target, stationId) {
  if (target === null || target === undefined || target === "") return false;

  const targets = String(target)
    .split(",")
    .map((value) => value.trim());

  if (targets.includes("0")) return true;
  if (stationId === null || stationId === undefined) return false;

  return targets.includes(String(stationId));
}

export function chronoStatusLabel(status, stageName = "") {
  switch (status) {
    case "synced":
      return stageName || "Cronómetro";
    case "paused":
      return "Pausado";
    case "stale":
      return "Sin señal · estimado";
    case "connecting":
      return "Conectando...";
    case "finished":
      return "Tiempo terminado";
    case "aborted":
      return "Evaluación abortada";
    case "offline":
    case "idle":
    default:
      return "Sin cronómetro · usa el audio";
  }
}
