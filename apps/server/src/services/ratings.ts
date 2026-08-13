import type { BookRatingSummary, RatingDistributionRow } from "@novell-reader/shared";

const SCORES = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1] as const;

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function roundPercent(value: number): number {
  return Math.round(value * 10) / 10;
}

function allocateCounts(reviewCount: number, weightsByScore: Map<number, number>): RatingDistributionRow[] {
  const rows = SCORES.map((score) => {
    const rawCount = reviewCount * (weightsByScore.get(score) ?? 0);
    return {
      score,
      count: Math.floor(rawCount),
      fraction: rawCount - Math.floor(rawCount)
    };
  });
  let remaining = reviewCount - rows.reduce((sum, row) => sum + row.count, 0);

  [...rows].sort((a, b) => b.fraction - a.fraction).forEach((row) => {
    if (remaining <= 0) return;
    row.count += 1;
    remaining -= 1;
  });

  return rows.map(({ score, count }) => ({
    score,
    count,
    percent: roundPercent((count / reviewCount) * 100)
  }));
}

export function generateStaticBookRating(seed: string): BookRatingSummary {
  const hash = stableHash(seed);
  const averageScore = Math.round((8 + (hash % 201) / 100) * 100) / 100;
  const reviewCount = 1200 + ((hash >>> 8) % 10800);
  const lowShare = 0.02 + ((hash >>> 20) % 41) / 1000;
  const lowWeights = new Map<number, number>([
    [7, lowShare * 0.28],
    [6, lowShare * 0.22],
    [5, lowShare * 0.16],
    [4, lowShare * 0.13],
    [3, lowShare * 0.09],
    [2, lowShare * 0.05],
    [1, lowShare * 0.07]
  ]);
  const lowAverage = [...lowWeights].reduce((sum, [score, weight]) => sum + score * weight, 0);
  const topShare = 1 - lowShare;
  const topAverage = Math.min(10, Math.max(8, (averageScore - lowAverage) / topShare));
  const topWeights = new Map<number, number>();

  if (topAverage <= 9) {
    const nineShare = topAverage - 8;
    topWeights.set(8, topShare * (1 - nineShare));
    topWeights.set(9, topShare * nineShare);
    topWeights.set(10, 0);
  } else {
    const tenShare = topAverage - 9;
    topWeights.set(8, 0);
    topWeights.set(9, topShare * (1 - tenShare));
    topWeights.set(10, topShare * tenShare);
  }

  return {
    averageScore,
    reviewCount,
    distribution: allocateCounts(reviewCount, new Map([...topWeights, ...lowWeights]))
  };
}
