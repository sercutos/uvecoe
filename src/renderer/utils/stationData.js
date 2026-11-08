import { fetchWithAuth } from "./api";

// Descarga todas las páginas de un endpoint paginado tipo { items, total }.
async function fetchPaginated(path) {
  const todos = [];
  let page = 1;
  let total = Infinity;
  const perPage = 200;

  while (todos.length < total) {
    const sep = path.includes("?") ? "&" : "?";
    const data = await fetchWithAuth(
      `${path}${sep}per_page=${perPage}&page=${page}`
    );

    // Algunos endpoints devuelven un array plano.
    if (Array.isArray(data)) {
      todos.push(...data);
      break;
    }

    const items = data.items || [];
    todos.push(...items);

    total = typeof data.total === "number" ? data.total : todos.length;

    if (items.length === 0) break;
    page += 1;
  }

  return todos;
}

// Las preguntas devuelven un array plano, pero aceptan page/per_page.
async function fetchQuestions(stationId) {
  const todas = [];
  const perPage = 200;

  for (let page = 1; ; page += 1) {
    const data = await fetchWithAuth(
      `/questions?station_id=${stationId}&per_page=${perPage}&page=${page}`
    );

    const items = Array.isArray(data) ? data : data.items || [];
    todas.push(...items);

    if (items.length < perPage) break;
  }

  return todas;
}

/**
 * Descarga todo lo necesario para configurar un portátil:
 * bloque, preguntas de la estación, los 276 alumnos del ECOE,
 * usuarios y la planificación completa (turnos, rondas y planners).
 */
export async function fetchStationData({ ecoeId, stationId }) {
  const [
    blocksData,
    questions,
    students,
    usersData,
    shifts,
    roundsData,
    plannersData,
    stations
  ] = await Promise.all([
    fetchWithAuth(`/blocks?station_id=${stationId}&per_page=100`),
    fetchQuestions(stationId),
    fetchPaginated(`/students?ecoe_id=${ecoeId}`),
    fetchWithAuth("/users"),
    fetchPaginated(`/shifts?id_ecoe=${ecoeId}`),
    fetchWithAuth(`/rounds?ecoe_id=${ecoeId}`),
    fetchWithAuth(`/planners?ecoe_id=${ecoeId}`),
    fetchPaginated(`/stations?ecoe_id=${ecoeId}`)
  ]);

  const block = (blocksData.items || blocksData)[0];
  if (!block?.id) {
    throw new Error(
      "La estación seleccionada no tiene ningún bloque configurado en el servidor."
    );
  }

  const rounds = Array.isArray(roundsData)
    ? roundsData
    : roundsData.items || [];
  const planners = Array.isArray(plannersData)
    ? plannersData
    : plannersData.items || [];
  const users = Array.isArray(usersData) ? usersData : usersData.items || [];

  const station =
    stations.find((s) => Number(s.id) === Number(stationId)) || null;

  return {
    block,
    questions,
    students,
    users,
    shifts,
    rounds,
    planners,
    station
  };
}
