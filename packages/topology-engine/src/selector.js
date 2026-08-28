export function labelsMatch(selector = {}, labels = {}) {
  const entries = Object.entries(selector);

  if (entries.length === 0) {
    return false;
  }

  return entries.every(([key, value]) => labels[key] === value);
}
