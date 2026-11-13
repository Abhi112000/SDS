function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function editDistanceWithin(left, right, limit) {
  if (Math.abs(left.length - right.length) > limit) return limit + 1;

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    let rowMinimum = row;
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      current[column] = Math.min(
        previous[column] + 1,
        current[column - 1] + 1,
        previous[column - 1] + cost
      );
      rowMinimum = Math.min(rowMinimum, current[column]);
    }
    if (rowMinimum > limit) return limit + 1;
    previous = current;
  }
  return previous[right.length];
}

export function getFuzzyMatchScore(query, ...values) {
  const normalizedQuery = normalizeSearchText(query);
  const queryTokens = normalizedQuery.split(' ').filter(Boolean);
  if (!queryTokens.length) return null;

  const normalizedValues = values.map(normalizeSearchText).filter(Boolean);
  if (!normalizedValues.length) return null;
  const combinedText = normalizedValues.join(' ');
  if (combinedText.includes(normalizedQuery)) return 0;

  const candidateTokens = Array.from(new Set(combinedText.split(' ').filter(Boolean)));
  let totalScore = 0;

  for (const queryToken of queryTokens) {
    let bestScore = Infinity;
    for (const candidate of candidateTokens) {
      if (candidate.includes(queryToken)) {
        bestScore = 0;
        break;
      }

      if (queryToken.length < 3) continue;
      const maxDistance = queryToken.length < 7 ? 1 : 2;
      const distance = editDistanceWithin(queryToken, candidate, maxDistance);
      bestScore = Math.min(bestScore, distance);
    }

    if (!Number.isFinite(bestScore) || bestScore > (queryToken.length < 7 ? 1 : 2)) return null;
    totalScore += bestScore;
  }

  return totalScore;
}
