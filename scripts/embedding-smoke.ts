import assert from "node:assert/strict";
import { embedText, embedTexts, EMBEDDING_DIMENSIONS } from "../lib/ai/local-embeddings";

async function main() {
  const documents = await embedTexts([
    "I practised a software engineering interview and got a job offer.",
    "I baked sourdough bread with flour and water in the oven.",
  ]);
  const query = await embedText("How did my job interview go?");
  for (const vector of [...documents, query]) {
    assert.equal(vector.length, EMBEDDING_DIMENSIONS);
    assert(vector.every(Number.isFinite));
    assert(Math.abs(Math.hypot(...vector) - 1) < 1e-5);
  }
  const scores = documents.map(v => v.reduce((sum, n, i) => sum + n * query[i], 0));
  assert(scores[0] > scores[1], "Relevant document should rank above unrelated bread passage");
  console.log("Local inference passed: 384 finite normalized dimensions; relevant passage ranks first.", scores);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
