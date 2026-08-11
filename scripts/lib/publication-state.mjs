export const publicationStates = new Set([
  "approved-for-publication",
  "planned-after-claim-and-rights-review",
]);

export function publicationStateMatchesDraft(state = "approved-for-publication", draft = false) {
  if (!publicationStates.has(state)) return false;
  return state === "planned-after-claim-and-rights-review" ? draft === true : draft === false;
}
