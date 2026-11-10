// Reglas puras de rotación y puntuación, separadas para poder probarlas.
export function reorderStudentsForStation(studentsList, stationOrder) {
  const total = studentsList.length;
  if (total === 0) return studentsList;

  const order = Number(stationOrder) || 1;
  const start = ((order - 1) % total + total) % total;
  const ordered = [];

  for (let i = 0; i < total; i += 1) {
    ordered.push(studentsList[(start - i + total) % total]);
  }

  return ordered;
}

// Los puntos máximos salen de la rúbrica publicada. Si el servidor ya guardó
// un max_points positivo, tiene prioridad sobre la primera opción.
export function questionMaxPoints(question = {}) {
  const options = Array.isArray(question.question_schema?.options)
    ? question.question_schema.options
    : [];
  const fromOptions = options.length > 0 ? Number(options[0].points) : null;
  const stored = Number(question.max_points);
  const maxPoints =
    Number.isFinite(stored) && stored > 0
      ? stored
      : fromOptions ?? 0;

  return Number.isFinite(maxPoints) ? maxPoints : 0;
}

// Puntos de una respuesta de tipo checkbox. Desmarcado siempre vale 0.
export function pointsForToggle(question = {}, checked = false) {
  if (!checked) return 0;

  const options = Array.isArray(question.options) ? question.options : [];
  const selectedOption = options[0] || null;
  const optionPoints = Number(
    selectedOption?.points ?? question.max_points ?? 0
  );

  return Number.isFinite(optionPoints) ? optionPoints : 0;
}
