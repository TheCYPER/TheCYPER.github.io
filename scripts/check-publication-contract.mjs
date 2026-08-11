import { publicationStateMatchesDraft } from "./lib/publication-state.mjs";

const fixtures = [
  { name: "approved content is public", state: "approved-for-publication", draft: false, valid: true },
  { name: "planned content stays draft", state: "planned-after-claim-and-rights-review", draft: true, valid: true },
  { name: "planned content cannot publish", state: "planned-after-claim-and-rights-review", draft: false, valid: false },
  { name: "approved content cannot remain hidden", state: "approved-for-publication", draft: true, valid: false },
  { name: "unknown state is rejected", state: "unreviewed", draft: true, valid: false },
];

const failures = fixtures.filter(
  ({ state, draft, valid }) => publicationStateMatchesDraft(state, draft) !== valid,
);

if (failures.length > 0) {
  console.error("Publication-state contract fixtures failed:");
  for (const fixture of failures) console.error(`- ${fixture.name}`);
  process.exitCode = 1;
} else {
  console.log(`Publication-state contract passed: ${fixtures.length} positive and negative fixtures.`);
}
