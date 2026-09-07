/**
 * Cosine similarity between two vectors — the standard "how alike are
 * these two embeddings" metric, in [-1, 1], unaffected by magnitude (only
 * direction matters, which is what makes it the right comparison for
 * embeddings rather than raw Euclidean distance).
 *
 * Returns `0` — never throws, never `NaN` — for the cases that would
 * otherwise be undefined: mismatched lengths (never expected in practice,
 * since every stored embedding comes from the same model, but a defensive
 * `0` beats a crash if that assumption is ever violated), an empty
 * vector, or a zero vector (magnitude 0, division by zero).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
