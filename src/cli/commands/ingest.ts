import path from "node:path";

import chalk from "chalk";

/**
 * Placeholder for document ingestion (chunk / embed / index). Planned for a later release.
 */
export async function runIngestCommand(options: { projectDir?: string }): Promise<void> {
  const dir = path.resolve(process.cwd(), options.projectDir ?? "modelstack-project");
  process.stdout.write(`\n${chalk.cyan.bold("Ingest documents")}\n\n`);
  process.stdout.write(
    `${chalk.yellow("This command is not implemented yet.")} It will eventually help you add files from ${chalk.bold(path.join(dir, "documents"))} into a local index.\n\n`,
  );
  process.stdout.write(
    `${chalk.gray("For now, use your stack's tools (e.g. Ollama + a RAG app), or run modelstack recommend for setup guidance.")}\n\n`,
  );
}
