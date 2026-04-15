import { checkbox, select } from "@inquirer/prompts";
import chalk from "chalk";

import { userIntentSchema } from "../shared/schemas.js";
import type { UserIntent } from "../shared/types.js";
import { normalizeAnswers } from "./normalizeAnswers.js";
import {
  CONTEXT_PREFERENCE_OPTIONS,
  FORMAT_PREFERENCE_OPTIONS,
  INPUT_TYPE_OPTIONS,
  INSTALL_COMFORT_OPTIONS,
  LOCAL_PREFERENCE_OPTIONS,
  PDF_OPTIONS,
  PREFERRED_ENGINE_OPTIONS,
  PRIMARY_USE_CASE_OPTIONS,
  QUANTIZATION_TOLERANCE_OPTIONS,
} from "./questions.js";

export type QuestionnairePromptApi = {
  checkbox: typeof checkbox;
  select: typeof select;
};

const defaultPrompts: QuestionnairePromptApi = { checkbox, select };

function renderQuestionnaireLegend(): string {
  return [
    chalk.cyan.bold("Questionnaire Controls"),
    `${chalk.bold("Arrow keys")}: move`,
    `${chalk.bold("Spacebar")}: select or deselect choices`,
    `${chalk.bold("Enter")}: submit the current prompt`,
    "",
    "",
  ].join("\n");
}

export async function runQuestionnaire(promptApi: QuestionnairePromptApi = defaultPrompts): Promise<UserIntent> {
  const envIntent = process.env.MODELSTACK_INTENT_JSON;
  if (envIntent) {
    return userIntentSchema.parse(JSON.parse(envIntent));
  }

  process.stdout.write(renderQuestionnaireLegend());

  const primaryUseCases = await promptApi.checkbox({
    message: "What do you mainly want to use AI for?",
    choices: PRIMARY_USE_CASE_OPTIONS.map((option) => ({
      value: option.value,
      name: option.label,
      checked: option.value === "general_chat",
    })),
    required: true,
  });

  const rawInputTypes = await promptApi.checkbox({
    message: "What kinds of files will the AI work with?",
    choices: INPUT_TYPE_OPTIONS.map((option) => ({
      value: option.value,
      name: option.label,
    })),
    required: true,
  });

  const inputTypes: Array<"text" | "pdf_text" | "pdf_scanned" | "screenshots" | "photos" | "code"> = [];
  for (const item of rawInputTypes) {
    if (item === "mixed") {
      inputTypes.push("text", "pdf_text", "screenshots", "code");
      continue;
    }

    inputTypes.push(item);
  }

  if (inputTypes.includes("pdf_text") || primaryUseCases.includes("documents")) {
    const pdfType = await promptApi.select({
      message: "Are your PDFs mostly selectable text or scanned pages?",
      choices: PDF_OPTIONS.map((option) => ({
        value: option.value,
        name: option.label,
      })),
    });

    if (pdfType === "both") {
      inputTypes.push("pdf_scanned");
    } else if (pdfType === "pdf_scanned") {
      const textIndex = inputTypes.indexOf("pdf_text");
      if (textIndex >= 0) {
        inputTypes.splice(textIndex, 1);
      }
      inputTypes.push("pdf_scanned");
    }
  }

  const priority = await promptApi.select<UserIntent["priority"]>({
    message: "What matters most?",
    choices: [
      { value: "speed", name: "Fast responses" },
      { value: "quality", name: "Best quality" },
      { value: "balanced", name: "Balanced" },
    ],
  });

  const localPreference = await promptApi.select<UserIntent["localPreference"]>({
    message:
      "How strict should we be about easy, on-your-computer setups?\nSome models need more RAM or a trickier install — this tells us how much to avoid that.",
    choices: LOCAL_PREFERENCE_OPTIONS.map((option) => ({
      value: option.value,
      name: `${option.label} — ${option.hint}`,
    })),
  });

  const preferredEngine = await promptApi.select<UserIntent["preferredEngine"]>({
    message: "Which runtime do you want to prioritize?",
    choices: PREFERRED_ENGINE_OPTIONS.map((option) => ({
      value: option.value,
      name: option.label,
    })),
  });

  const installComfort = await promptApi.select<UserIntent["installComfort"]>({
    message: "How much setup complexity is OK?",
    choices: INSTALL_COMFORT_OPTIONS.map((option) => ({
      value: option.value,
      name: option.label,
    })),
  });

  const formatPreference = await promptApi.select<UserIntent["formatPreference"]>({
    message: "Preferred model weight format?",
    choices: FORMAT_PREFERENCE_OPTIONS.map((option) => ({
      value: option.value,
      name: option.label,
    })),
  });

  const contextPreference = await promptApi.select<UserIntent["contextPreference"]>({
    message: "How large are typical prompts or documents?",
    choices: CONTEXT_PREFERENCE_OPTIONS.map((option) => ({
      value: option.value,
      name: option.label,
    })),
  });

  const quantizationTolerance = await promptApi.select<UserIntent["quantizationTolerance"]>({
    message: "Quantization vs quality tradeoff?",
    choices: QUANTIZATION_TOLERANCE_OPTIONS.map((option) => ({
      value: option.value,
      name: option.label,
    })),
  });

  const allowsSlowSmart = await promptApi.select<boolean>({
    message: "Are you okay with slower models if they are smarter?",
    choices: [
      { value: true, name: "Yes" },
      { value: false, name: "No" },
    ],
  });

  let finalPrimaryUseCases = [...primaryUseCases];
  if (!primaryUseCases.includes("image_generation")) {
    const wantsImageGeneration = await promptApi.select<boolean>({
      message: "Will you want image generation too?",
      choices: [
        { value: false, name: "No" },
        { value: true, name: "Yes" },
      ],
    });

    if (wantsImageGeneration) {
      finalPrimaryUseCases = [...finalPrimaryUseCases, "image_generation"];
    }
  }

  return normalizeAnswers({
    primaryUseCases: finalPrimaryUseCases,
    inputTypes: [...new Set(inputTypes)],
    priority,
    localPreference,
    allowsSlowSmart,
    preferredEngine,
    installComfort,
    formatPreference,
    contextPreference,
    quantizationTolerance,
  });
}
