export function getAlphabetForLanguage(langCode: string): string {
  switch (langCode) {
    case "fr":
    case "en":
    case "pt":
      return "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    case "th":
      return "กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ";
    default:
      return "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  }
}

export function selectRandomWords<T extends { word: string }>(words: T[], count: number, previousWords: string[]): T[] {
  // Filter out recently used words
  const availableWords = words.filter((w) => !previousWords.includes(w.word));

  // If we don't have enough available words, reset the history
  const wordsToUse = availableWords.length >= count ? availableWords : words;

  // Shuffle and take the required count
  const shuffled = [...wordsToUse].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
