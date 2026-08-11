export function orderedSelectionMatches(items, expectedIds) {
  if (items.length !== expectedIds.length) return false;
  const sorted = [...items].sort((left, right) => left.order - right.order);
  const orders = sorted.map(({ order }) => order);
  if (new Set(orders).size !== orders.length) return false;
  return sorted.every(
    ({ id, order }, index) => order === index + 1 && id === expectedIds[index],
  );
}
