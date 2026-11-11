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

// Respuestas ya guardadas en el servidor para una estación.
async function fetchAnswers(stationId) {
  const data = await fetchWithAuth(`/answers/station/${stationId}`);
  return Array.isArray(data) ? data : data.items || [];
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

// Organizaciones disponibles para filtrar las ECOEs.
export async function fetchOrganizations() {
  const data = await fetchWithAuth("/organizations");
  return Array.isArray(data) ? data : data.items || [];
}

// Identifica el ECOE y su organización para mostrarlos en el Toolbar.
export function getEcoeContext(ecoe, fallbackId, organizations = []) {
  const ecoeId = Number(ecoe?.id ?? fallbackId);

  const rawOrgId = ecoe?.id_organization;
  const organizationId =
    rawOrgId === null || rawOrgId === undefined || rawOrgId === ""
      ? null
      : Number(rawOrgId);

  const rawSessionOrgId = sessionStorage.getItem("user_org_id");
  const sessionOrgId = rawSessionOrgId ? Number(rawSessionOrgId) : null;
  const isOwnOrganization =
    organizationId !== null && organizationId === sessionOrgId;
  const organization = organizations.find(
    (item) => Number(item.id) === organizationId
  );

  return {
    ecoe_name: ecoe?.nombre || ecoe?.name || `ECOE ${ecoeId}`,
    organization_name:
      ecoe?.organization?.name ||
      ecoe?.organization_name ||
      organization?.name ||
      (isOwnOrganization ? sessionStorage.getItem("user_org_name") || "" : ""),
    organization_id: Number.isFinite(organizationId) ? organizationId : null
  };
}

/**
 * Descarga todo lo necesario para configurar un portátil:
 * bloque, preguntas de la estación, los 276 alumnos del ECOE,
 * usuarios, la planificación completa (turnos, rondas y planners)
 * y las respuestas ya guardadas en el servidor para esa estación.
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
    stations,
    answers,
    organizationsData
  ] = await Promise.all([
    fetchWithAuth(`/blocks?station_id=${stationId}&per_page=100`),
    fetchQuestions(stationId),
    fetchPaginated(`/students?ecoe_id=${ecoeId}`),
    fetchWithAuth("/users"),
    fetchPaginated(`/shifts?id_ecoe=${ecoeId}`),
    fetchWithAuth(`/rounds?ecoe_id=${ecoeId}`),
    fetchWithAuth(`/planners?ecoe_id=${ecoeId}`),
    fetchPaginated(`/stations?ecoe_id=${ecoeId}`),
    fetchAnswers(stationId).catch((error) => {
      // No bloquear la configuración del portátil si el endpoint de respuestas
      // falla en un servidor antiguo o no hay permisos.
      console.warn(
        "⚠️ No se pudieron descargar las respuestas del servidor:",
        error
      );
      return [];
    }),
    fetchOrganizations().catch((error) => {
      // El nombre de la organización es informativo: no bloquea la descarga.
      console.warn(
        "⚠️ No se pudieron descargar las organizaciones:",
        error
      );
      return [];
    })
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

  const organizations = Array.isArray(organizationsData)
    ? organizationsData
    : [];

  return {
    block,
    questions,
    students,
    users,
    shifts,
    rounds,
    planners,
    station,
    answers,
    organizations
  };
}
