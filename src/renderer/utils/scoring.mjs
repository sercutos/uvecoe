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

// Puntos de una respuesta de tipo checkbox, tomados de la opción de la rúbrica.
// Desmarcado siempre vale 0.
export function pointsForToggle(question = {}, checked = false) {
  if (!checked) return 0;

  const options = Array.isArray(question.options) ? question.options : [];
  const selectedOption = options[0] || null;
  const optionPoints = Number(selectedOption?.points ?? 0);

  return Number.isFinite(optionPoints) ? optionPoints : 0;
}
