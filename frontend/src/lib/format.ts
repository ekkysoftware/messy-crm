export function formatCurrency(value: number | string): string {
  return `$${Number(value).toLocaleString('en-US')}`
}

/** Up to two initials for the round avatars, e.g. "Ethan Wong" -> "EW". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) {
    return '?'
  }
  return words
    .slice(0, 2)
    .map((word) => Array.from(word)[0].toUpperCase())
    .join('')
}
