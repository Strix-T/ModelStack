import boxen from "boxen";
import chalk from "chalk";

export function renderHeader(title: string, subtitle?: string): string {
  const body = subtitle ? `${chalk.bold(title)}\n${chalk.gray(subtitle)}` : chalk.bold(title);
  return boxen(body, {
    borderStyle: "round",
    borderColor: "cyan",
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
  });
}
