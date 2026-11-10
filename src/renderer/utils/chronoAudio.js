import aviso3Min from "../assets/sounds/aviso_3_min.mp3";
import beepAlarm from "../assets/sounds/beep_alarm.mp3";
import campanillas from "../assets/sounds/campanillas.mp3";
import entrar from "../assets/sounds/entrar.mp3";
import entrenEstacion from "../assets/sounds/entren_en_la_estacion.mp3";
import faltan3Min from "../assets/sounds/Faltan_3_minutos.mp3";
import salganEstacion from "../assets/sounds/Salgan_de_la_estacion.mp3";
import salir from "../assets/sounds/salir.mp3";

const SOUNDS = {
  "aviso_3_min.mp3": aviso3Min,
  "beep_alarm.mp3": beepAlarm,
  "campanillas.mp3": campanillas,
  "entrar.mp3": entrar,
  "entren_en_la_estacion.mp3": entrenEstacion,
  "Faltan_3_minutos.mp3": faltan3Min,
  "Salgan_de_la_estacion.mp3": salganEstacion,
  "salir.mp3": salir
};

const cache = new Map();

export function playChronoAudio(sound) {
  if (!sound) return;

  const raw = String(sound).trim();
  const name = raw.split(/[\\/]/).pop();
  const src = SOUNDS[name] || (/^https?:\/\//i.test(raw) ? raw : null);

  if (!src) {
    console.warn("[CHRONO] Audio no encontrado:", sound);
    return;
  }

  try {
    let audio = cache.get(src);
    if (!audio) {
      audio = new Audio(src);
      cache.set(src, audio);
    }

    audio.currentTime = 0;
    audio.play().catch((error) => {
      console.warn("[CHRONO] No se pudo reproducir el audio:", error.message);
    });
  } catch (error) {
    console.warn("[CHRONO] Error preparando el audio:", error.message);
  }
}
