function parseJson(value) {
  if (!value) return {};
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function optionPoints(schema) {
  if (!Array.isArray(schema.options) || schema.options.length === 0) {
    return null;
  }

  const points = Number(schema.options[0].points);
  return Number.isFinite(points) ? points : null;
}

exports.up = async function (knex) {
  const hasMaxPoints = await knex.schema.hasColumn("questions", "max_points");

  if (!hasMaxPoints) {
    await knex.schema.alterTable("questions", (table) => {
      table.float("max_points").defaultTo(0);
    });
  }

  // 1. Rellenar max_points desde la rúbrica publicada por el servidor.
  const questions = await knex("questions").select(
    "id",
    "question_schema",
    "max_points"
  );

  for (const question of questions) {
    const schema = parseJson(question.question_schema);
    const fromOptions = optionPoints(schema);
    const storedMaxPoints = Number(question.max_points);
    const maxPoints =
      Number.isFinite(storedMaxPoints) && storedMaxPoints > 0
        ? storedMaxPoints
        : fromOptions ?? 0;
    const finalMaxPoints = Number.isFinite(maxPoints) ? maxPoints : 0;

    if (Number(question.max_points) !== finalMaxPoints) {
      await knex("questions")
        .where({ id: question.id })
        .update({ max_points: finalMaxPoints });
    }
  }

  // 2. Corregir resultados antiguos que se guardaron con points=1 fijo.
  const results = await knex("resultados").select(
    "id",
    "id_question",
    "answer_schema",
    "points",
    "sincronizado"
  );

  for (const result of results) {
    const question = await knex("questions")
      .where({ id: result.id_question })
      .first();

    if (!question) continue;

    const questionSchema = parseJson(question.question_schema);
    const answerSchema = parseJson(result.answer_schema);
    const options = Array.isArray(questionSchema.options)
      ? questionSchema.options
      : [];
    const selected = Array.isArray(answerSchema.selected)
      ? answerSchema.selected
      : [];

    let points;

    if (selected.length === 0) {
      points = 0;
    } else if (options.length > 0) {
      points = selected.reduce((sum, selection) => {
        const option = options.find(
          (candidate) =>
            Number(candidate.id_option) === Number(selection.id_option)
        );

        return sum + (option ? Number(option.points) || 0 : 0);
      }, 0);
    } else {
      const fallback = Number(question.max_points);
      points = Number.isFinite(fallback)
        ? fallback
        : Number(result.points) || 0;
    }

    if (Number(result.points) !== points) {
      await knex("resultados")
        .where({ id: result.id })
        .update({
          points,
          sincronizado: false
        });
    }
  }
};

exports.down = async function (knex) {
  const hasMaxPoints = await knex.schema.hasColumn("questions", "max_points");

  if (hasMaxPoints) {
    await knex.schema.alterTable("questions", (table) => {
      table.dropColumn("max_points");
    });
  }
};
