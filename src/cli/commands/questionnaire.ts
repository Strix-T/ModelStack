import { describeLocalPreference } from "../../core/questionnaire/questions.js";
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
        ["Ease of running on this computer", describeLocalPreference(intent.localPreference)],
        ["Preferred Engine", intent.preferredEngine],
        ["Install Comfort", intent.installComfort],
        ["Format Preference", intent.formatPreference],
        ["Context Preference", intent.contextPreference],
        ["Quantization", intent.quantizationTolerance],
        ["Requires Embeddings", String(intent.requiresEmbeddings)],
        ["Requires Vision", String(intent.requiresVision)],
        ["Requires Image Generation", String(intent.requiresImageGeneration)],
        ["Requires Reranker", String(intent.requiresReranker)],
        ["Requires OCR", String(intent.requiresOCR)],
        ["Requires Tool Calling", String(intent.requiresToolCalling)],
        ["Requires Long Context", String(intent.requiresLongContext)],
        ["Requires Speech-to-Text", String(intent.requiresSpeechToText)],
        ["Requires TTS", String(intent.requiresSpeechSynthesis)],
      ])}\n`,
    );
}
