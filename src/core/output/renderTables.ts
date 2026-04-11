import Table from "cli-table3";

export function renderKeyValueTable(rows: Array<[string, string]>): string {
  const table = new Table({
    style: { head: [], border: [] },
    wordWrap: true,
    colWidths: [24, 72],
  });

  for (const [key, value] of rows) {
    table.push([key, value]);
  }

  return table.toString();
}
