/**
 * Utility untuk menghitung tingkat kemiripan (similarity score) antara dua teks (0 - 100%).
 * Mengombinasikan Jaccard token overlap, token containment, dan 2-gram (bigram) Dice coefficient.
 * Digunakan untuk mendeteksi kesamaan nama item baru terhadap item eksisting RAB/OE.
 */

export function calculateStringSimilarity(str1: string, str2: string): number {
  const s1 = (str1 || "").trim().toLowerCase();
  const s2 = (str2 || "").trim().toLowerCase();

  if (!s1 || !s2) return 0;
  if (s1 === s2) return 100;

  // Bersihkan karakter non-alphanumeric
  const clean = (s: string) =>
    s
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const c1 = clean(s1);
  const c2 = clean(s2);

  if (!c1 || !c2) return 0;
  if (c1 === c2) return 100;

  const t1 = c1.split(" ").filter(Boolean);
  const t2 = c2.split(" ").filter(Boolean);

  if (t1.length === 0 || t2.length === 0) return 0;

  const set1 = new Set(t1);
  const set2 = new Set(t2);

  let common = 0;
  for (const t of set1) {
    if (set2.has(t)) common++;
  }

  const unionSize = new Set([...t1, ...t2]).size;
  const jaccard = unionSize > 0 ? (common / unionSize) * 100 : 0;
  const containment = Math.min(set1.size, set2.size) > 0 ? (common / Math.min(set1.size, set2.size)) * 100 : 0;

  // Bigram Dice
  const getBigrams = (s: string) => {
    const bg = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) {
      bg.add(s.slice(i, i + 2));
    }
    return bg;
  };

  const bg1 = getBigrams(c1);
  const bg2 = getBigrams(c2);

  let bgCommon = 0;
  for (const b of bg1) {
    if (bg2.has(b)) bgCommon++;
  }

  const dice = bg1.size + bg2.size > 0 ? ((2 * bgCommon) / (bg1.size + bg2.size)) * 100 : 0;

  // Weighted combo: token overlap + bigram dice
  const tokenCombo = jaccard * 0.4 + containment * 0.6;
  const score = Math.max(dice, tokenCombo);

  return Math.round(score);
}
