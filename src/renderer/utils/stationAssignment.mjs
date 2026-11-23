// Un evaluador solo puede usar la estación configurada si la plataforma se la
// asignó al descargar los datos. Los administradores se dejan pasar para poder
// configurar o revisar el portátil.
export function isEvaluatorAssigned({ isAdmin, email, id, evaluators }) {
  if (isAdmin) return true;

  const lista = Array.isArray(evaluators) ? evaluators : [];
  if (lista.length === 0) return false;

  const emailBuscado = String(email || "").trim().toLowerCase();
  const idBuscado = Number(id);

  return lista.some((evaluador) => {
    if (typeof evaluador === "string") {
      return evaluador.trim().toLowerCase() === emailBuscado;
    }

    const emailAsignado = String(evaluador?.email || "")
      .trim()
      .toLowerCase();
    if (emailBuscado && emailAsignado && emailAsignado === emailBuscado) {
      return true;
    }

    return (
      Number.isFinite(idBuscado) && Number(evaluador?.id) === idBuscado
    );
  });
}
