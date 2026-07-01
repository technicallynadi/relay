// Dot-matrix persona avatars for the five jury judges. Each pattern is a 11×12 grid of
// '#' (lit) / '.' (off) cells that draws a distinct face; the accent tints the lit dots.
// Shared by the live jury panel (animated, JudgeAvatar) and the README strip (a static SVG
// generated from these same patterns), so the two never drift.

export interface JudgePersona {
  id: string;
  name: string;
  family: string;
  accent: string;
  pattern: string[];
}

export const JUDGE_ROSTER: JudgePersona[] = [
  {
    id: "matchmaker",
    name: "The Matchmaker",
    family: "OpenAI",
    accent: "#3df0ad",
    // perceptive, warm — round eyes, small smile
    pattern: [
      "....###....",
      "...#####...",
      "..#######..",
      ".#########.",
      "#..#...#..#",
      "#.........#",
      "#....#....#",
      "#.........#",
      "#...###...#",
      ".#########.",
      "..#######..",
      "...#####...",
    ],
  },
  {
    id: "operator",
    name: "The Operator",
    family: "Anthropic",
    accent: "#f0b04a",
    // pragmatic, focused — narrow eyes, flat mouth
    pattern: [
      "....###....",
      "...#####...",
      "..#######..",
      ".#########.",
      "#.##...##.#",
      "#.........#",
      "#....#....#",
      "#.........#",
      "#..#####..#",
      ".#########.",
      "..#######..",
      "...#####...",
    ],
  },
  {
    id: "closer",
    name: "The Closer",
    family: "Meta",
    accent: "#4fb4d8",
    // confident — asymmetric eyes, a smirk
    pattern: [
      "....###....",
      "...#####...",
      "..#######..",
      ".#########.",
      "#..#...##.#",
      "#.........#",
      "#....#....#",
      "#.........#",
      "#..####...#",
      ".#########.",
      "..#######..",
      "...#####...",
    ],
  },
  {
    id: "concierge",
    name: "The Concierge",
    family: "Anthropic",
    accent: "#e0785e",
    // warm, attentive — a wide upturned smile
    pattern: [
      "....###....",
      "...#####...",
      "..#######..",
      ".#########.",
      "#..#...#..#",
      "#.........#",
      "#....#....#",
      "#.#.....#.#",
      "#...###...#",
      ".#########.",
      "..#######..",
      "...#####...",
    ],
  },
  {
    id: "steward",
    name: "The Steward",
    family: "Google",
    accent: "#9b8cff",
    // careful, guarded — heavy brow, small firm mouth
    pattern: [
      "....###....",
      "...#####...",
      "..#######..",
      ".#########.",
      "#.#######.#",
      "#..#...#..#",
      "#....#....#",
      "#.........#",
      "#...###...#",
      ".#########.",
      "..#######..",
      "...#####...",
    ],
  },
];

export const PERSONA_BY_ID: Record<string, JudgePersona> = Object.fromEntries(
  JUDGE_ROSTER.map((p) => [p.id, p]),
);
