import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { orderedSelectionMatches } from "./lib/selection-contract.mjs";
import { walkFiles } from "./lib/files.mjs";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const expectedWork = ["kimodo-capability-boundaries", "animgen-runtime-pose-generation"];
const expectedQuestions = [
  "hardware-agent-harness",
  "kimodo-martial-arts-adapter",
  "agent-native-zero-people-company",
];
const failures = [];

const fixtureBase = expectedWork.map((id, index) => ({ id, order: index + 1 }));
const fixtures = [
  { name: "baseline", items: fixtureBase, valid: true },
  { name: "missing", items: fixtureBase.slice(0, 1), valid: false },
  { name: "extra", items: [...fixtureBase, { id: "unexpected", order: 3 }], valid: false },
  { name: "swapped", items: [fixtureBase[1], fixtureBase[0]], valid: true },
  { name: "wrong identity order", items: [{ ...fixtureBase[0], order: 2 }, { ...fixtureBase[1], order: 1 }], valid: false },
  { name: "duplicate order", items: [{ ...fixtureBase[0] }, { ...fixtureBase[1], order: 1 }], valid: false },
];

for (const fixture of fixtures) {
  if (orderedSelectionMatches(fixture.items, expectedWork) !== fixture.valid) {
    failures.push(`negative fixture failed: ${fixture.name}`);
  }
}

const longformFiles = await walkFiles(path.join(projectRoot, "src", "content"), {
  include: (file) => [".md", ".mdx"].includes(path.extname(file).toLowerCase()),
});
const selectedWork = [];
for (const file of longformFiles) {
  const source = await readFile(file, "utf8");
  const order = source.match(/^homepage:\s*\r?\n\s+order:\s*(\d+)\s*$/m)?.[1];
  const isDraft = /^draft:\s*true\s*$/m.test(source);
  if (order && !isDraft) {
    selectedWork.push({ id: path.basename(file, path.extname(file)), order: Number(order) });
  }
}
if (!orderedSelectionMatches(selectedWork, expectedWork)) {
  failures.push(`current homepage work selection is invalid: ${JSON.stringify(selectedWork)}`);
}

const questionFiles = await walkFiles(path.join(projectRoot, "src", "content", "research-questions"), {
  include: (file) => [".yaml", ".yml", ".json"].includes(path.extname(file).toLowerCase()),
});
const selectedQuestions = [];
for (const file of questionFiles) {
  const source = await readFile(file, "utf8");
  if (/^homepage:\s*true\s*$/m.test(source) && /^status:\s*active\s*$/m.test(source)) {
    const order = Number(source.match(/^order:\s*(\d+)\s*$/m)?.[1]);
    selectedQuestions.push({ id: path.basename(file, path.extname(file)), order });
  }
}
if (!orderedSelectionMatches(selectedQuestions, expectedQuestions)) {
  failures.push(`current homepage question selection is invalid: ${JSON.stringify(selectedQuestions)}`);
}

if (failures.length > 0) {
  console.error("Homepage contract failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Homepage contract passed: exact ${selectedQuestions.length} questions and ${selectedWork.length} work entries.`);
}
