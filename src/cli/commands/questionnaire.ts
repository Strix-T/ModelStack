import { runQuestionnaire } from "../../core/questionnaire/flows.js";
import { renderHeader } from "../../core/output/renderHeader.js";
import { renderKeyValueTable } from "../../core/output/renderTables.js";

export async function runQuestionnaireCommand(options: { json?: boolean }): Promise<void> {
  const intent = await runQuestionnaire();

  if (options.json) {
    process.stdout.write(`${JSON.stringify(intent, null, 2)}\n`);
    return;
  }

  process.stdout.write(
    `${renderHeader("Questionnaire", "Captured user intent")}\n\n${renderKeyValueTable([
      ["Use Cases", intent.primaryUseCases.join(", ")],
      ["Input Types", intent.inputTypes.join(", ")],
      ["Priority", intent.priority],
      ["Local Preference", intent.localPreference],
      ["Requires Embeddings", String(intent.requiresEmbeddings)],
      ["Requires Vision", String(intent.requiresVision)],
      ["Requires Image Generation", String(intent.requiresImageGeneration)],
    ])}\n`,
  );
}
