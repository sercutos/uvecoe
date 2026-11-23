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

// El servidor publica las opciones como `options` o como `_options` según la
// versión; aceptamos ambas para no quedarnos sin puntos.
export function questionOptions(question = {}) {
  const options =
    question.options ??
    question.question_schema?.options ??
    question.question_schema?._options ??
    question._options;

  return Array.isArray(options) ? options : [];
}

// Puntos de una respuesta de tipo checkbox, tomados de la opción de la rúbrica.
// Desmarcado siempre vale 0.
export function pointsForToggle(question = {}, checked = false) {
  if (!checked) return 0;

  const selectedOption = questionOptions(question)[0] || null;
  const optionPoints = Number(selectedOption?.points ?? 0);

  return Number.isFinite(optionPoints) ? optionPoints : 0;
}

// Igual que el servidor: una respuesta está marcada si tiene puntos o si su
// answer_schema tiene opciones seleccionadas (puede haber 0 puntos marcados).
export function isAnswerMarked(points, answerSchema) {
  if (Number(points) > 0) return true;

  let schema = answerSchema;
  if (typeof schema === "string") {
    try {
      schema = JSON.parse(schema);
    } catch {
      return false;
    }
  }

  const selected = schema?.selected;
  return Array.isArray(selected) ? selected.length > 0 : Boolean(selected);
}
