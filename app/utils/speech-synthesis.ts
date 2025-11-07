export function getVoiceForLanguage(langCode: string, voiceLocales: string[]): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();

  // Try to find exact match with preferred locales
  for (const locale of voiceLocales) {
    const voice = voices.find((v) => v.lang === locale && v.localService);
    if (voice) return voice;
  }

  // Try to find any local voice for the language
  for (const locale of voiceLocales) {
    const voice = voices.find((v) => v.lang === locale);
    if (voice) return voice;
  }

  // Fallback to any voice that starts with the language code
  const langPrefix = langCode.split("-")[0];
  const fallbackVoice = voices.find((v) => v.lang.startsWith(langPrefix));

  return fallbackVoice || null;
}

export function speakWord(word: string, langCode: string, voiceLocales: string[]): void {
  if (!window.speechSynthesis) return;

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(word);
  const voice = getVoiceForLanguage(langCode, voiceLocales);

  if (voice) {
    utterance.voice = voice;
  }

  utterance.lang = voiceLocales[0];
  utterance.rate = 0.85; // Slower for learning
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  window.speechSynthesis.speak(utterance);
}
