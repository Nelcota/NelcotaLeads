import type { StateCode } from "@/lib/brazil-states";

export type StateLabel = {
  x: number;
  y: number;
  /** Where the text sits from the point: centered on it, or to its right or left. */
  side: "center" | "right" | "left";
  /** For a state too small to hold its code: the line from the state to the label. */
  guide: readonly [number, number, number, number] | null;
};

// Label points in the 613 × 639 map, from the v4 canvas.
const INSIDE: Partial<Record<StateCode, readonly [number, number]>> = {
  AC: [55, 227],
  AP: [344, 60],
  AM: [145, 147],
  BA: [504, 278],
  CE: [537, 161],
  GO: [372, 346],
  MA: [448, 161],
  MT: [283, 285],
  MS: [299, 405],
  MG: [452, 368],
  PA: [324, 147],
  PE: [550, 213],
  PI: [485, 197],
  PR: [350, 477],
  RS: [323, 566],
  RO: [174, 253],
  RR: [197, 50],
  SC: [367, 522],
  SP: [395, 437],
  TO: [401, 240],
};

// Small states: [inside x, inside y, label x, label y].
const OUTSIDE: Partial<Record<StateCode, readonly [number, number, number, number]>> = {
  RN: [583, 173, 624, 168],
  PB: [581, 193, 624, 194],
  AL: [584, 230, 624, 226],
  SE: [571, 247, 624, 254],
  ES: [521, 392, 556, 392],
  RJ: [489, 435, 520, 470],
  DF: [409, 330, 394, 316],
};

export function stateLabel(code: StateCode): StateLabel {
  const outside = OUTSIDE[code];
  if (outside) {
    const [fromX, , x, y] = outside;
    const side = x < fromX ? "left" : "right";
    return { x: x + (side === "left" ? -3 : 3), y, side, guide: outside };
  }
  const [x, y] = INSIDE[code] ?? [0, 0];
  return { x, y, side: "center", guide: null };
}

/** A point well inside the state, where its routes start. */
export function stateCenter(code: StateCode): readonly [number, number] {
  const outside = OUTSIDE[code];
  if (outside) return [outside[0], outside[1]];
  return INSIDE[code] ?? [0, 0];
}

const ROUTE_COUNT = 4;
// Uneven on purpose: some routes reach the border, others stop halfway; each bends differently.
const REACH = [190, 62, 190, 88];
const BEND = [58, -42, 34, -64];
const TILT = [0.18, -0.12, 0.26, -0.22];

function angleGap(a: number, b: number): number {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

/** Four directions far apart, turned a little per state so no two states look the same. */
function routeAngles(code: StateCode): number[] {
  const turn = ((code.charCodeAt(0) + code.charCodeAt(1)) % 8) * (Math.PI / 32);
  const candidates = Array.from(
    { length: 8 },
    (_, i) => -Math.PI + (i + 0.5) * (Math.PI / 4) + turn,
  );
  const angles: number[] = [];
  while (angles.length < ROUTE_COUNT) {
    const spread = (angle: number) => Math.min(Math.PI, ...angles.map((b) => angleGap(angle, b)));
    const next = candidates
      .filter((angle) => angles.every((b) => angleGap(angle, b) > Math.PI / 4))
      .toSorted((a, b) => spread(b) - spread(a))[0];
    if (next === undefined) break;
    angles.push(next);
  }
  return angles;
}

const point = (value: number) => value.toFixed(1);

/** Curved routes from the state's center toward its borders; the map clips them to the state. */
export function stateRoutes(code: StateCode): string[] {
  const [cx, cy] = stateCenter(code);
  return routeAngles(code).map((base, i) => {
    const angle = base + (TILT[i] ?? 0);
    const reach = REACH[i] ?? 120;
    const x0 = cx + Math.cos(angle) * 16;
    const y0 = cy + Math.sin(angle) * 16;
    const x1 = cx + Math.cos(angle) * reach;
    const y1 = cy + Math.sin(angle) * reach;
    const bend = (BEND[i] ?? 40) * (reach / 190 + 0.35);
    const qx = (x0 + x1) / 2 - Math.sin(angle) * bend;
    const qy = (y0 + y1) / 2 + Math.cos(angle) * bend;
    return `M${point(x0)} ${point(y0)} Q${point(qx)} ${point(qy)} ${point(x1)} ${point(y1)}`;
  });
}
