export function summarizeText(text: string, maxSentences = 3): string {
  const sentences = text
    .replace(/([.!?])\s+/g, "$1|")
    .split("|")
    .filter((s) => s.trim().length > 20);

  if (sentences.length <= maxSentences) return sentences.join(" ").trim();

  // Simple extractive summarization: pick first, middle, and last sentences
  const picks = [sentences[0]];
  for (let i = 1; i < maxSentences - 1; i++) {
    const idx = Math.floor((sentences.length * i) / maxSentences);
    picks.push(sentences[idx]);
  }
  picks.push(sentences[sentences.length - 1]);

  return picks.join(" ").trim();
}

export function truncateToTokens(text: string, maxChars = 4000): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "...";
}
