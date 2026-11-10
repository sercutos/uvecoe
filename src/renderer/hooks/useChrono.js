import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

import { getChronoBaseUrl } from "../utils/apiConfig";
import { playChronoAudio } from "../utils/chronoAudio";
import {
  chronoStatusLabel,
  eventTargetsStation,
  formatChrono,
  remainingForTick
} from "../utils/chrono.mjs";

export default function useChrono({ roundId, stationId, enabled = true }) {
  const [status, setStatus] = useState("idle");
  const [remaining, setRemaining] = useState(null);
  const [stageName, setStageName] = useState("");
  const [event, setEvent] = useState(null);

  const tickRef = useRef(null);

  useEffect(() => {
    tickRef.current = null;
    setRemaining(null);
    setStageName("");
    setEvent(null);

    if (!enabled || !roundId || !stationId) {
      setStatus("idle");
      return;
    }

    // El Chrono emite en el namespace por defecto con eventos
    // `*_round_<id>`; el namespace /round<id> rechaza conexiones.
    const socket = io(getChronoBaseUrl(), {
      reconnection: true,
      reconnectionDelayMax: 2000,
      timeout: 5000
    });
    const suffix = `_round_${roundId}`;

    setStatus("connecting");

    let idleTimer = null;
    const armIdleTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (!tickRef.current) setStatus("offline");
      }, 5000);
    };

    socket.on("connect", () => {
      setStatus(tickRef.current ? "synced" : "connecting");
      armIdleTimer();
    });

    socket.on("disconnect", () => {
      clearTimeout(idleTimer);
      setStatus(tickRef.current ? "stale" : "offline");
    });

    socket.on("connect_error", (error) => {
      console.warn("[CHRONO] No se pudo conectar:", error.message);
      clearTimeout(idleTimer);
      setStatus(tickRef.current ? "stale" : "offline");
    });

    socket.on(`tic_tac${suffix}`, (msg) => {
      const duration = Number(msg?.stage?.duration);
      const elapsed = Number(msg?.t);
      if (!Number.isFinite(duration) || !Number.isFinite(elapsed)) return;

      clearTimeout(idleTimer);
      const isPaused = msg.stopped === "S" || msg.state === "PAUSED";
      tickRef.current = {
        duration,
        t: elapsed,
        receivedAt: performance.now(),
        paused: isPaused
      };

      setRemaining(Math.max(0, duration - elapsed));
      setStageName(msg.stage?.name || "");

      if (msg.state === "ABORTED") {
        setStatus("aborted");
      } else if (
        msg.state === "FINISHED" ||
        duration - elapsed <= 0
      ) {
        setStatus("finished");
      } else if (isPaused) {
        setStatus("paused");
      } else {
        setStatus("synced");
      }
    });

    socket.on(`init_stage${suffix}`, () => {
      tickRef.current = null;
      setRemaining(null);
      setStageName("");
      setEvent(null);
      setStatus("synced");
      armIdleTimer();
    });

    socket.on(`evento${suffix}`, (msg) => {
      if (!eventTargetsStation(msg?.target, stationId)) return;

      const mensaje = msg?.data || "Aviso del cronómetro";
      setEvent({ message: mensaje, sound: msg?.sound || null });

      if (msg?.sound) {
        playChronoAudio(msg.sound);
      }
    });

    socket.on("end_round", (msg) => {
      if (Number(msg?.id) !== Number(roundId)) return;

      tickRef.current = null;
      setRemaining(0);
      setStageName("");
      setStatus("finished");
    });

    socket.on(`aborted${suffix}`, () => {
      tickRef.current = null;
      setRemaining(0);
      setStatus("aborted");
    });

    const interval = setInterval(() => {
      const tick = tickRef.current;
      if (!tick) return;

      const now = performance.now();
      const next = remainingForTick(tick, now);
      const silentFor = now - tick.receivedAt;
      setRemaining(next);

      if (next <= 0) {
        setStatus("finished");
      } else if (!socket.connected || (!tick.paused && silentFor > 5000)) {
        setStatus("stale");
      } else if (tick.paused) {
        setStatus("paused");
      } else {
        setStatus("synced");
      }
    }, 250);

    return () => {
      clearInterval(interval);
      clearTimeout(idleTimer);
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [enabled, roundId, stationId]);

  return {
    status,
    formatted: formatChrono(remaining),
    label: chronoStatusLabel(status, stageName),
    event,
    clearEvent: () => setEvent(null)
  };
}
