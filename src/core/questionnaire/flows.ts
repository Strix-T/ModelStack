import { checkbox, select } from "@inquirer/prompts";
import chalk from "chalk";

import { userIntentSchema } from "../shared/schemas.js";
import type { UserIntent } from "../shared/types.js";
import { normalizeAnswers } from "./normalizeAnswers.js";
import { INPUT_TYPE_OPTIONS, PDF_OPTIONS, PRIMARY_USE_CASE_OPTIONS } from "./questions.js";

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
    message: "Do you want everything fully local?",
    choices: [
      { value: "local_only", name: "Yes" },
      { value: "prefer_local", name: "Prefer local" },
      { value: "no_preference", name: "No preference" },
    ],
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
  });
}
