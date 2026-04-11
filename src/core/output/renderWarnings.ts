import chalk from "chalk";

export function renderWarnings(warnings: string[]): string {
  if (warnings.length === 0) {
    return "";
  }

  return `${chalk.yellow.bold("Warnings")}\n${warnings.map((warning) => `- ${warning}`).join("\n")}`;
}
