import type {
  Game,
  InitApi,
  RenderApi,
  UpdateApi,
} from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import {
  ACTIONS,
  BACK_LABEL,
  BINDINGS,
  BOARD_CX,
  BOARD_CY,
  CAMPAIGN_LENGTH,
  CELL_PITCH,
  CHANNELS,
  CLEAR_LABEL,
  CUES,
  GRID_MAX_COLS,
  GRID_MAX_ROWS,
  HUD_SOLVED_LABEL,
  HUD_TIER_LABEL,
  MAX_TIER,
  NODE_HIT_R,
  NODE_R,
  REFRACT_DEBUG_VERSION,
  SET_LABELS,
  SOLVED_ITEMS,
  SOLVED_TITLE_TEXT,
  STAGE_H,
  STAGE_W,
  TAGLINE_TEXT,
  TARGET_MIN_H,
  TIER_ADVANCE,
  TIERS,
  TITLE_ITEMS,
  TITLE_TEXT,
} from "./constants";
import { CAMPAIGN_BOARDS } from "./boards";

export type Screen =
  "title" | "howto" | "select" | "playing" | "solved" | "complete";
export type Mode = "campaign" | "cascade";
export type Channel = "triangle" | "square" | "diamond";
export type NodeKind = "emitter" | "lens" | "crystal";
export interface Cell {
  readonly col: number;
  readonly row: number;
}
export interface NodeState {
  readonly col: number;
  readonly row: number;
  readonly kind: NodeKind;
  readonly channel: Channel | null;
  readonly charges: number | null;
}
export interface BoardState {
  readonly cols: number;
  readonly rows: number;
  readonly nodes: readonly NodeState[];
}
export interface BeamState {
  readonly channel: Channel;
  readonly cells: readonly Cell[];
}
export interface TraceState {
  readonly channel: Channel;
}
export type PointerDevice = "mouse" | "pen" | "touch";
export interface PointerState {
  readonly x: number;
  readonly y: number;
  readonly down: boolean;
  readonly device: PointerDevice;
}
export interface RefractState {
  readonly screen: Screen;
  readonly mode: Mode;
  readonly menuIndex: number;
  readonly board: BoardState;
  readonly beams: readonly BeamState[];
  readonly tracing: TraceState | null;
  readonly boardIndex: number;
  readonly solvedBoards: readonly number[];
  readonly unlockedCount: number;
  readonly selectIndex: number;
  readonly solvedCount: number;
  readonly tier: number;
  readonly pointer: PointerState;
  readonly armedTarget: string | null;
  readonly simTime: number;
  readonly muted: boolean;
}
export interface Target {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}
export interface RefractDebugApi {
  readonly version: number;
  reset(s: DeepReadonly<RefractState>): RefractState;
  snapshot(s: DeepReadonly<RefractState>): ReturnType<typeof snapshot>;
  reconcile(s: DeepReadonly<RefractState>): RefractState;
  setMode(s: DeepReadonly<RefractState>, mode: Mode): RefractState;
  setScreen(s: DeepReadonly<RefractState>, screen: Screen): RefractState;
  setMenuIndex(s: DeepReadonly<RefractState>, index: number): RefractState;
  setSolvedCount(s: DeepReadonly<RefractState>, count: number): RefractState;
  setTier(s: DeepReadonly<RefractState>, tier: number): RefractState;
  generateBoard(s: DeepReadonly<RefractState>, tier: number): RefractState;
  loadBoard(
    s: DeepReadonly<RefractState>,
    board: readonly string[],
  ): RefractState;
  pointerDown(
    s: DeepReadonly<RefractState>,
    x: number,
    y: number,
    device?: PointerDevice,
  ): RefractState;
  pointerMove(
    s: DeepReadonly<RefractState>,
    x: number,
    y: number,
    device?: PointerDevice,
  ): RefractState;
  pointerUp(
    s: DeepReadonly<RefractState>,
    device?: PointerDevice,
  ): RefractState;
  clear(s: DeepReadonly<RefractState>): RefractState;
}
export const BACKGROUND = "#080e1b";
const HUES: Record<Channel, string> = {
  triangle: "#f5bf71",
  square: "#6de3db",
  diamond: "#b39aff",
};
const ink = "#e8edf5";
const mutedInk = "#8591a5";
const key = (c: Cell) => `${c.col},${c.row}`;
const same = (a: Cell, b: Cell) => a.col === b.col && a.row === b.row;
export const cellX = (col: number, cols: number) =>
  BOARD_CX - ((cols - 1) * CELL_PITCH) / 2 + col * CELL_PITCH;
export const cellY = (row: number, rows: number) =>
  BOARD_CY - ((rows - 1) * CELL_PITCH) / 2 + row * CELL_PITCH;
const nodeAt = (b: DeepReadonly<BoardState>, c: Cell) =>
  b.nodes.find((n) => same(n, c));
const beamOf = (s: DeepReadonly<RefractState>, ch: Channel) =>
  s.beams.find((b) => b.channel === ch);
const last = <T>(a: readonly T[]): T | undefined => a[a.length - 1];

export function parseBoard(rows: readonly string[]): BoardState {
  if (
    !rows.length ||
    rows.length > GRID_MAX_ROWS ||
    !rows[0]?.length ||
    rows[0].length > GRID_MAX_COLS ||
    rows.some((r) => r.length !== rows[0].length)
  )
    throw new Error("Invalid board dimensions");
  const nodes: NodeState[] = [];
  rows.forEach((line, row) =>
    [...line].forEach((char, col) => {
      if (char === ".") return;
      if ("TSDtsd".includes(char)) {
        const channel = ({ t: "triangle", s: "square", d: "diamond" } as const)[
          char.toLowerCase() as "t" | "s" | "d"
        ];
        nodes.push({
          col,
          row,
          kind: char === char.toUpperCase() ? "emitter" : "lens",
          channel,
          charges: null,
        });
      } else if ("123".includes(char))
        nodes.push({
          col,
          row,
          kind: "crystal",
          channel: null,
          charges: Number(char),
        });
      else throw new Error(`Invalid board notation: ${char}`);
    }),
  );
  return { cols: rows[0].length, rows: rows.length, nodes };
}
const beamsFor = (b: BoardState): BeamState[] =>
  CHANNELS.filter((ch) => b.nodes.some((n) => n.channel === ch)).map(
    (channel) => ({ channel, cells: [] }),
  );
const withBeam = (
  s: DeepReadonly<RefractState>,
  ch: Channel,
  cells: readonly Cell[],
): RefractState => ({
  ...s,
  beams: s.beams.map((b) =>
    b.channel === ch
      ? { channel: ch, cells: cells.map((c) => ({ ...c })) }
      : { channel: b.channel, cells: b.cells.map((c) => ({ ...c })) },
  ),
});
const spent = (s: DeepReadonly<RefractState>, c: Cell) =>
  s.beams.reduce((n, b) => n + b.cells.filter((p) => same(p, c)).length, 0);
export function complete(
  s: DeepReadonly<RefractState>,
  b: DeepReadonly<BeamState>,
): boolean {
  const cells = b.cells;
  if (cells.length < 2) return false;
  const ends = s.board.nodes.filter(
    (n) => n.kind === "emitter" && n.channel === b.channel,
  );
  if (
    ends.length !== 2 ||
    !ends.some((n) => same(n, cells[0])) ||
    !ends.some((n) => same(n, cells[cells.length - 1])) ||
    same(cells[0], cells[cells.length - 1])
  )
    return false;
  return s.board.nodes
    .filter((n) => n.kind === "lens" && n.channel === b.channel)
    .every(
      (n) =>
        cells.filter((c) => same(c, n)).length === 1 &&
        !same(n, cells[0]) &&
        !same(n, cells[cells.length - 1]),
    );
}
export function solved(s: DeepReadonly<RefractState>): boolean {
  return (
    s.beams.length > 0 &&
    s.beams.every((b) => complete(s, b)) &&
    s.board.nodes
      .filter((n) => n.kind === "crystal")
      .every(
        (n) =>
          spent(s, n) === n.charges &&
          s.beams.every(
            (b) =>
              !same(last(b.cells) ?? { col: -1, row: -1 }, n) &&
              !same(b.cells[0] ?? { col: -1, row: -1 }, n),
          ),
      )
  );
}
const segmentKey = (a: Cell, b: Cell) => [key(a), key(b)].sort().join("|");
function canExtend(
  s: DeepReadonly<RefractState>,
  ch: Channel,
  to: Cell,
): boolean {
  const b = beamOf(s, ch);
  const from = b && last(b.cells);
  const n = nodeAt(s.board, to);
  if (
    !from ||
    !n ||
    same(from, to) ||
    Math.abs(from.col - to.col) > 1 ||
    Math.abs(from.row - to.row) > 1
  )
    return false;
  if (n.channel && n.channel !== ch) return false;
  const origin = nodeAt(s.board, from);
  if (origin?.kind === "emitter" && b!.cells.length > 1) return false;
  if (
    n.kind === "emitter" &&
    (b!.cells.some((c) => same(c, to)) || b!.cells.length < 1)
  )
    return false;
  if (n.kind === "lens" && b!.cells.some((c) => same(c, to))) return false;
  if (n.kind === "crystal" && spent(s, to) >= (n.charges ?? 0)) return false;
  const proposed = segmentKey(from, to);
  const crossing =
    from.col !== to.col && from.row !== to.row
      ? segmentKey(
          { col: from.col, row: to.row },
          { col: to.col, row: from.row },
        )
      : null;
  for (const beam of s.beams)
    for (let i = 1; i < beam.cells.length; i++) {
      const existing = segmentKey(beam.cells[i - 1], beam.cells[i]);
      if (existing === proposed || existing === crossing) return false;
    }
  return true;
}
function poseBoard(
  s: DeepReadonly<RefractState>,
  board: BoardState,
): RefractState {
  return {
    ...s,
    screen: "playing",
    board,
    beams: beamsFor(board),
    tracing: null,
    armedTarget: null,
  };
}
const transpose = (rows: readonly string[]): string[] =>
  Array.from({ length: rows[0].length }, (_, col) =>
    rows.map((r) => r[col]).join(""),
  );
const padRight = (rows: readonly string[]): string[] =>
  rows.map((r) => `${r}.`);
const padBottom = (rows: readonly string[]): string[] => [
  ...rows,
  ".".repeat(rows[0].length),
];
/** Vetted seeds. Reflection and empty border padding preserve their solutions. */
const cascadePools: readonly (readonly (readonly string[])[])[] = [
  [...CAMPAIGN_BOARDS.slice(0, 6), transpose(CAMPAIGN_BOARDS[2])],
  CAMPAIGN_BOARDS.slice(6, 10),
  [
    [".t.s", "tT2s", "tS2S", ".Tss"],
    CAMPAIGN_BOARDS[10],
    CAMPAIGN_BOARDS[11],
    transpose(CAMPAIGN_BOARDS[10]),
    padBottom(CAMPAIGN_BOARDS[10]),
  ],
  [
    ["1tttT", "DT2s.", "dd2SS", "dD.s."],
    padRight(["1tttT", "DT2s.", "dd2SS", "dD.s."]),
    CAMPAIGN_BOARDS[13],
    CAMPAIGN_BOARDS[14],
    CAMPAIGN_BOARDS[16],
  ],
  [
    CAMPAIGN_BOARDS[20],
    padRight(CAMPAIGN_BOARDS[20]),
    padBottom(CAMPAIGN_BOARDS[20]),
    ["s2SST..", "s232.t.", "stTsttt", "..t.t.t", "d22ttdD", "dD2dddd"],
  ],
];
function generate(s: DeepReadonly<RefractState>, tier: number): RefractState {
  if (!Number.isInteger(tier) || tier < 1 || tier > MAX_TIER)
    throw new Error(`Invalid tier: ${tier}`);
  const limits = TIERS[tier - 1];
  const cols =
    limits.minCols +
    Math.floor(Math.random() * (limits.maxCols - limits.minCols + 1));
  const rowsCount =
    limits.minRows +
    Math.floor(Math.random() * (limits.maxRows - limits.minRows + 1));
  const candidates = cascadePools[tier - 1].filter(
    (rows) => rows.length === rowsCount && rows[0].length === cols,
  );
  if (!candidates.length)
    throw new Error(`No boards for tier ${tier}: ${cols}x${rowsCount}`);
  let rows = [...candidates[Math.floor(Math.random() * candidates.length)]];
  if (Math.random() < 0.5) rows = rows.map((r) => [...r].reverse().join(""));
  if (Math.random() < 0.5) rows.reverse();
  return poseBoard(s, parseBoard(rows));
}
function initial(muted = false): RefractState {
  return {
    screen: "title",
    mode: "campaign",
    menuIndex: 0,
    board: { cols: 0, rows: 0, nodes: [] },
    beams: [],
    tracing: null,
    boardIndex: 0,
    solvedBoards: [],
    unlockedCount: 1,
    selectIndex: 0,
    solvedCount: 0,
    tier: 1,
    pointer: { x: 0, y: 0, down: false, device: "mouse" },
    armedTarget: null,
    simTime: 0,
    muted,
  };
}
function enterCampaignBoard(
  s: DeepReadonly<RefractState>,
  index: number,
): RefractState {
  return {
    ...poseBoard(s, parseBoard(CAMPAIGN_BOARDS[index])),
    boardIndex: index,
    selectIndex: index,
    menuIndex: 0,
  };
}
function finish(s: DeepReadonly<RefractState>): RefractState {
  if (s.mode === "cascade") {
    const solvedCount = s.solvedCount + 1;
    return {
      ...s,
      screen: "solved",
      tracing: null,
      menuIndex: 0,
      solvedCount,
      tier: Math.min(Math.floor(solvedCount / TIER_ADVANCE) + 1, MAX_TIER),
    };
  }
  const solvedBoards = [...new Set([...s.solvedBoards, s.boardIndex])].sort(
    (a, b) => a - b,
  );
  return {
    ...s,
    screen: solvedBoards.length === CAMPAIGN_LENGTH ? "complete" : "solved",
    tracing: null,
    menuIndex: 0,
    solvedBoards,
    unlockedCount: Math.min(
      CAMPAIGN_LENGTH,
      Math.max(s.unlockedCount, s.boardIndex + 2),
    ),
    selectIndex: s.boardIndex,
  };
}
function clear(s: DeepReadonly<RefractState>): RefractState {
  return {
    ...s,
    beams: s.beams.map((b) => ({ channel: b.channel, cells: [] })),
    tracing: null,
  };
}
function menuLabels(s: DeepReadonly<RefractState>): readonly string[] {
  if (s.screen === "title") return TITLE_ITEMS;
  if (s.screen === "complete") return ["BACK TO SELECT", "BACK TO TITLE"];
  if (s.screen === "solved")
    return s.mode === "cascade"
      ? SOLVED_ITEMS
      : s.boardIndex === CAMPAIGN_LENGTH - 1
        ? ["REPLAY", "BACK TO SELECT"]
        : ["NEXT BOARD", "REPLAY", "BACK TO SELECT"];
  return [];
}
export function targets(s: DeepReadonly<RefractState>): Target[] {
  if (s.screen === "title")
    return TITLE_ITEMS.map((_, i) => ({
      id: `menu-${i}`,
      x: 432,
      y: 412 + 80 * i,
      w: 416,
      h: TARGET_MIN_H,
    }));
  if (s.screen === "howto")
    return [{ id: "back", x: 1050, y: 540, w: 142, h: TARGET_MIN_H }];
  if (s.screen === "select")
    return [
      ...Array.from({ length: CAMPAIGN_LENGTH }, (_, i) => ({
        id: `board-${i + 1}`,
        x: 265 + (i % 6) * 130,
        y: 181 + Math.floor(i / 6) * 110,
        w: 108,
        h: 86,
      })),
      { id: "back", x: 1060, y: 380, w: 142, h: TARGET_MIN_H },
    ];
  if (s.screen === "playing")
    return [
      { id: "clear", x: 1008, y: 344, w: 136, h: TARGET_MIN_H },
      { id: "back", x: 40, y: 344, w: 136, h: TARGET_MIN_H },
    ];
  return menuLabels(s).map((_, i) => ({
    id: `menu-${i}`,
    x: 46,
    y: 278 + i * 86,
    w: 248,
    h: TARGET_MIN_H,
  }));
}
function targetAt(
  s: DeepReadonly<RefractState>,
  x: number,
  y: number,
): Target | undefined {
  return targets(s).find(
    (t) => x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h,
  );
}
function nodeNear(
  s: DeepReadonly<RefractState>,
  x: number,
  y: number,
): NodeState | undefined {
  return s.board.nodes.find(
    (n) =>
      Math.hypot(
        cellX(n.col, s.board.cols) - x,
        cellY(n.row, s.board.rows) - y,
      ) <= NODE_HIT_R,
  );
}
function choose(s: DeepReadonly<RefractState>): RefractState {
  if (s.screen === "title") {
    if (s.menuIndex === 0)
      return {
        ...s,
        screen: "select",
        mode: "campaign",
        menuIndex: 0,
        armedTarget: null,
      };
    if (s.menuIndex === 1)
      return generate(
        { ...s, mode: "cascade", solvedCount: 0, tier: 1, menuIndex: 0 },
        1,
      );
    return { ...s, screen: "howto", menuIndex: 0, armedTarget: null };
  }
  if (s.screen === "select")
    return s.selectIndex < s.unlockedCount
      ? enterCampaignBoard(s, s.selectIndex)
      : { ...s };
  if (s.screen === "solved") {
    if (s.mode === "cascade")
      return s.menuIndex === 0
        ? generate({ ...s, menuIndex: 0 }, s.tier)
        : generate({ ...s, solvedCount: 0, tier: 1, menuIndex: 0 }, 1);
    if (s.boardIndex < CAMPAIGN_LENGTH - 1 && s.menuIndex === 0)
      return enterCampaignBoard(s, s.boardIndex + 1);
    if (s.menuIndex === (s.boardIndex === CAMPAIGN_LENGTH - 1 ? 0 : 1))
      return enterCampaignBoard(s, s.boardIndex);
    return { ...s, screen: "select", menuIndex: 0, armedTarget: null };
  }
  if (s.screen === "complete")
    return s.menuIndex === 0
      ? { ...s, screen: "select", armedTarget: null }
      : { ...s, screen: "title", menuIndex: 0, armedTarget: null };
  return { ...s };
}
function goBack(s: DeepReadonly<RefractState>): RefractState {
  if (s.screen === "howto")
    return { ...s, screen: "title", menuIndex: 2, armedTarget: null };
  if (s.screen === "select")
    return { ...s, screen: "title", menuIndex: 0, armedTarget: null };
  if (
    s.screen === "playing" ||
    s.screen === "solved" ||
    s.screen === "complete"
  )
    return s.mode === "campaign"
      ? {
          ...s,
          screen: "select",
          beams:
            s.screen === "playing"
              ? s.beams.map((b) => ({ channel: b.channel, cells: [] }))
              : s.beams,
          tracing: null,
          armedTarget: null,
        }
      : {
          ...s,
          screen: "title",
          menuIndex: 1,
          tracing: null,
          armedTarget: null,
        };
  return { ...s };
}
function takeTarget(s: DeepReadonly<RefractState>, id: string): RefractState {
  if (id === "back") return goBack(s);
  if (id === "clear") return clear(s);
  if (id.startsWith("board-")) {
    const selectIndex = Number(id.slice(6)) - 1;
    return choose({ ...s, selectIndex });
  }
  if (id.startsWith("menu-"))
    return choose({ ...s, menuIndex: Number(id.slice(5)) });
  return { ...s };
}
function pointerEvent(
  s: DeepReadonly<RefractState>,
  type: "down" | "move" | "up",
  x: number,
  y: number,
  device: PointerDevice,
): RefractState {
  let next: RefractState = {
    ...s,
    pointer: {
      x,
      y,
      down: type === "down" ? true : type === "up" ? false : s.pointer.down,
      device,
    },
  };
  if (type === "up") {
    const armed = s.armedTarget;
    next = {
      ...next,
      armedTarget: null,
      tracing: null,
      beams: next.beams.map((b) => ({
        channel: b.channel,
        cells: b.cells.length === 1 ? [] : b.cells.map((c) => ({ ...c })),
      })),
    };
    return armed && targetAt(s, x, y)?.id === armed
      ? takeTarget(next, armed)
      : next;
  }
  const target = targetAt(next, x, y);
  if (type === "down") {
    if (target) {
      next = { ...next, armedTarget: target.id };
      if (target.id.startsWith("menu-"))
        next = { ...next, menuIndex: Number(target.id.slice(5)) };
      if (target.id.startsWith("board-"))
        next = { ...next, selectIndex: Number(target.id.slice(6)) - 1 };
      return next;
    }
    if (next.screen !== "playing") return next;
    const n = nodeNear(next, x, y);
    if (!n) return next;
    const c = { col: n.col, row: n.row };
    if (
      n.kind === "emitter" &&
      n.channel &&
      beamOf(next, n.channel)?.cells.length === 0
    )
      return {
        ...withBeam(next, n.channel, [c]),
        tracing: { channel: n.channel },
      };
    for (const b of next.beams)
      if (b.cells.length && (same(b.cells[0], c) || same(last(b.cells)!, c))) {
        const cells = same(b.cells[0], c) ? [...b.cells].reverse() : b.cells;
        return {
          ...withBeam(next, b.channel, cells),
          tracing: { channel: b.channel },
        };
      }
    const hits = next.beams.filter((b) => b.cells.some((c2) => same(c, c2)));
    if (hits.length === 1) {
      const b = hits[0];
      const index = b.cells
        .map((c2, i) => (same(c, c2) ? i : -1))
        .reduce((a, i) => Math.max(a, i), -1);
      return {
        ...withBeam(next, b.channel, b.cells.slice(0, index + 1)),
        tracing: { channel: b.channel },
      };
    }
    return next;
  }
  if (!next.pointer.down) {
    if (target?.id.startsWith("menu-"))
      return { ...next, menuIndex: Number(target.id.slice(5)) };
    if (target?.id.startsWith("board-"))
      return { ...next, selectIndex: Number(target.id.slice(6)) - 1 };
    return next;
  }
  if (next.screen !== "playing" || !next.tracing) return next;
  const n = nodeNear(next, x, y);
  if (!n) return next;
  const b = beamOf(next, next.tracing.channel)!;
  const c = { col: n.col, row: n.row };
  if (b.cells.length > 1 && same(b.cells[b.cells.length - 2], c))
    return withBeam(next, b.channel, b.cells.slice(0, -1));
  if (canExtend(next, b.channel, c)) {
    next = withBeam(next, b.channel, [...b.cells, c]);
    if (solved(next)) return finish(next);
  }
  return next;
}
function snapshot(s: DeepReadonly<RefractState>) {
  const beams: Partial<Record<Channel, { cells: Cell[]; complete: boolean }>> =
    {};
  s.beams.forEach((b) => {
    beams[b.channel] = {
      cells: b.cells.map((c) => ({ ...c })),
      complete: complete(s, b),
    };
  });
  return {
    version: REFRACT_DEBUG_VERSION,
    screen: s.screen,
    mode: s.mode,
    menuIndex: s.menuIndex,
    boardIndex: s.boardIndex,
    solvedBoards: [...s.solvedBoards],
    unlockedCount: s.unlockedCount,
    selectIndex: s.selectIndex,
    solvedCount: s.solvedCount,
    tier: s.tier,
    board: {
      cols: s.board.cols,
      rows: s.board.rows,
      nodes: s.board.nodes.map((n) => ({
        ...n,
        x: cellX(n.col, s.board.cols),
        y: cellY(n.row, s.board.rows),
        spent: n.kind === "crystal" ? spent(s, n) : null,
      })),
    },
    beams,
    solved: solved(s),
    tracing: s.tracing
      ? {
          channel: s.tracing.channel,
          live: { ...last(beamOf(s, s.tracing.channel)!.cells)! },
        }
      : null,
    pointer: { ...s.pointer },
    targets: targets(s),
    muted: s.muted,
    simTime: s.simTime,
  };
}
export const debugApi: RefractDebugApi = {
  version: REFRACT_DEBUG_VERSION,
  reset: (s) => initial(s.muted),
  snapshot,
  reconcile: (s) => ({ ...s }),
  setMode: (s, mode) => ({ ...s, mode }),
  setScreen: (s, screen) => ({ ...s, screen, armedTarget: null }),
  setMenuIndex: (s, menuIndex) => ({ ...s, menuIndex }),
  setSolvedCount: (s, solvedCount) => ({ ...s, solvedCount }),
  setTier: (s, tier) => ({ ...s, tier }),
  generateBoard: generate,
  loadBoard: (s, rows) => poseBoard(s, parseBoard(rows)),
  pointerDown: (s, x, y, device = "mouse") =>
    pointerEvent(s, "down", x, y, device),
  pointerMove: (s, x, y, device = "mouse") =>
    pointerEvent(s, "move", x, y, device),
  pointerUp: (s, device = "mouse") =>
    pointerEvent(s, "up", s.pointer.x, s.pointer.y, device),
  clear,
};

function update(
  s: DeepReadonly<RefractState>,
  api: UpdateApi,
  dt: number,
): RefractState {
  let next: RefractState = { ...s, simTime: s.simTime + dt };
  const cues = new Set<string>();
  const segmentCount = (state: DeepReadonly<RefractState>) =>
    state.beams.reduce((n, b) => n + Math.max(0, b.cells.length - 1), 0);
  const record = (
    prior: DeepReadonly<RefractState>,
    current: DeepReadonly<RefractState>,
    clearing = false,
  ) => {
    const oldCount = segmentCount(prior),
      newCount = segmentCount(current);
    if (clearing && oldCount > 0 && newCount === 0) cues.add(CUES.clear);
    else if (newCount < oldCount) cues.add(CUES.retract);
    if (newCount > oldCount) cues.add(CUES.connect);
    if (
      current.beams.some(
        (b) =>
          complete(current, b) &&
          !complete(prior, beamOf(prior, b.channel) ?? b),
      )
    )
      cues.add(CUES.channelComplete);
    if (
      prior.screen === "playing" &&
      (current.screen === "solved" || current.screen === "complete") &&
      solved(current)
    )
      cues.add(CUES.solved);
  };
  const action = (name: string) => api.input.pressed(name);
  const up = action("up"),
    down = action("down"),
    left = action("left"),
    right = action("right"),
    confirm = action("confirm"),
    back = action("back"),
    clearPressed = action("clear"),
    mute = action("mute");
  if (mute) api.audio.setMuted(!api.audio.muted());
  next = { ...next, muted: api.audio.muted() };
  if (next.screen === "select") {
    const col = next.selectIndex % 6,
      row = Math.floor(next.selectIndex / 6);
    if (left) next = { ...next, selectIndex: row * 6 + ((col + 5) % 6) };
    if (right) next = { ...next, selectIndex: row * 6 + ((col + 1) % 6) };
    if (up) next = { ...next, selectIndex: ((row + 3) % 4) * 6 + col };
    if (down) next = { ...next, selectIndex: ((row + 1) % 4) * 6 + col };
  } else {
    const labels = menuLabels(next);
    if (labels.length) {
      if (up)
        next = {
          ...next,
          menuIndex: (next.menuIndex + labels.length - 1) % labels.length,
        };
      if (down)
        next = { ...next, menuIndex: (next.menuIndex + 1) % labels.length };
    }
  }
  if (back) next = goBack(next);
  else if (confirm) next = choose(next);
  if (clearPressed && next.screen === "playing") {
    const prior = next;
    next = clear(next);
    record(prior, next, true);
  }
  const samples = api.input.pointerSamples().filter((p) => p.primary);
  for (const p of samples) {
    const prior = next;
    next = pointerEvent(next, p.type, p.x, p.y, p.device);
    record(prior, next, p.type === "up" && prior.armedTarget === "clear");
  }
  const pointer = api.input.pointer();
  if (!samples.length)
    next = {
      ...next,
      pointer: {
        x: pointer.x,
        y: pointer.y,
        down: pointer.down,
        device: pointer.device,
      },
    };
  for (const cue of cues) api.audio.play(cue);
  return next;
}

function line(
  ctx: CanvasRenderingContext2D,
  a: Cell,
  b: Cell,
  board: DeepReadonly<BoardState>,
  color: string,
  width: number,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cellX(a.col, board.cols), cellY(a.row, board.rows));
  ctx.lineTo(cellX(b.col, board.cols), cellY(b.row, board.rows));
  ctx.stroke();
}
function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size: number,
  color = ink,
  align: CanvasTextAlign = "left",
  weight = 500,
) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(value, x, y);
}
function round(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
  stroke?: string,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}
function symbol(
  ctx: CanvasRenderingContext2D,
  ch: Channel,
  x: number,
  y: number,
  r: number,
  fill: boolean,
) {
  ctx.beginPath();
  if (ch === "triangle") {
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r * 0.9, y + r * 0.72);
    ctx.lineTo(x - r * 0.9, y + r * 0.72);
    ctx.closePath();
  }
  if (ch === "square") ctx.rect(x - r * 0.78, y - r * 0.78, r * 1.56, r * 1.56);
  if (ch === "diamond") {
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r, y);
    ctx.closePath();
  }
  ctx.lineWidth = 3;
  ctx.strokeStyle = HUES[ch];
  ctx.fillStyle = HUES[ch];
  if (fill) ctx.fill();
  else ctx.stroke();
}
function drawBoard(
  ctx: CanvasRenderingContext2D,
  s: DeepReadonly<RefractState>,
) {
  const b = s.board;
  if (!b.cols) return;
  for (let row = 0; row < b.rows; row++)
    for (let col = 0; col < b.cols; col++) {
      const x = cellX(col, b.cols),
        y = cellY(row, b.rows);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#243149";
      ctx.fill();
    }
  for (const beam of s.beams)
    for (let i = 1; i < beam.cells.length; i++) {
      line(
        ctx,
        beam.cells[i - 1],
        beam.cells[i],
        b,
        HUES[beam.channel] + "35",
        24,
      );
      line(ctx, beam.cells[i - 1], beam.cells[i], b, HUES[beam.channel], 8);
    }
  for (const n of b.nodes) {
    const x = cellX(n.col, b.cols),
      y = cellY(n.row, b.rows);
    ctx.beginPath();
    ctx.arc(x, y, NODE_R + 5, 0, Math.PI * 2);
    ctx.fillStyle = "#111c2e";
    ctx.fill();
    ctx.strokeStyle = "#32415a";
    ctx.lineWidth = 1;
    ctx.stroke();
    if (n.kind === "crystal") {
      ctx.beginPath();
      ctx.moveTo(x, y - 26);
      ctx.lineTo(x + 21, y);
      ctx.lineTo(x, y + 26);
      ctx.lineTo(x - 21, y);
      ctx.closePath();
      ctx.fillStyle = "#32405a";
      ctx.fill();
      ctx.strokeStyle = "#e7f1ff";
      ctx.lineWidth = 2;
      ctx.stroke();
      const count = spent(s, n);
      text(ctx, `${count}/${n.charges}`, x, y, 17, ink, "center", 700);
    } else symbol(ctx, n.channel!, x, y, 22, n.kind === "lens");
  }
}
function drawTarget(
  ctx: CanvasRenderingContext2D,
  t: Target,
  label: string,
  selected = false,
) {
  round(
    ctx,
    t.x,
    t.y,
    t.w,
    t.h,
    14,
    selected ? "#193c4d" : "#152237",
    selected ? "#6de3db" : "#33445e",
  );
  text(
    ctx,
    label,
    t.x + t.w / 2,
    t.y + t.h / 2,
    20,
    selected ? ink : mutedInk,
    "center",
    700,
  );
}
function render(s: DeepReadonly<RefractState>, api: RenderApi): void {
  const ctx = api.ctx;
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, STAGE_W, STAGE_H);
  ctx.strokeStyle = "#17253b";
  ctx.lineWidth = 1;
  for (let x = 32; x < STAGE_W; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, STAGE_H);
    ctx.stroke();
  }
  for (let y = 24; y < STAGE_H; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(STAGE_W, y);
    ctx.stroke();
  }
  round(ctx, 22, 18, 1236, 684, 25, "#0c1627", "#24344c");
  if (s.screen === "title") {
    text(ctx, TITLE_TEXT, 640, 211, 100, ink, "center", 800);
    text(ctx, TAGLINE_TEXT, 640, 294, 22, HUES.square, "center", 700);
    text(ctx, "A light-tracing puzzle", 640, 353, 19, mutedInk, "center");
    targets(s).forEach((t, i) =>
      drawTarget(ctx, t, TITLE_ITEMS[i], s.menuIndex === i),
    );
    text(
      ctx,
      "TRACE  /  THINK  /  REFRACT",
      640,
      676,
      14,
      mutedInk,
      "center",
      700,
    );
    return;
  }
  if (s.screen === "howto") {
    text(ctx, "HOW TO PLAY", 70, 86, 44, ink, "left", 800);
    const lines = [
      "Draw a beam from one outlined emitter to its matching partner.",
      "Drag from node to neighboring node, including diagonals. Release to keep your path.",
      "Fill every solid lens of the beam’s shape along the way.",
      "Any beam may pass through a crystal. Spend every charge shown inside it.",
      "A beam cannot enter another shape’s nodes or reuse a segment.",
      "Diagonal beams cannot cross. A forbidden step simply leaves your beam in place.",
      "Drag backward to unwind. Press a beam to resume or shorten it.",
      "Press R or CLEAR to start the board over. Esc returns to the menu.",
    ];
    lines.forEach((v, i) =>
      text(ctx, v, 72, 169 + i * 54, 20, i % 2 ? mutedInk : ink),
    );
    drawTarget(ctx, targets(s)[0], BACK_LABEL);
    return;
  }
  if (s.screen === "select") {
    text(ctx, "CAMPAIGN", 70, 76, 48, ink, "left", 800);
    text(ctx, "Choose a board", 72, 120, 20, mutedInk);
    targets(s).forEach((t, i) => {
      if (i === 24) {
        drawTarget(ctx, t, BACK_LABEL);
        return;
      }
      const status = s.solvedBoards.includes(i)
        ? "✓"
        : i < s.unlockedCount
          ? "◆"
          : "·";
      drawTarget(
        ctx,
        t,
        `${status} ${String(i + 1).padStart(2, "0")}`,
        s.selectIndex === i,
      );
    });
    SET_LABELS.forEach((v, i) =>
      text(ctx, v, 75, 222 + i * 110, 20, HUES.square, "left", 700),
    );
    return;
  }
  drawBoard(ctx, s);
  if (s.screen === "playing") {
    text(
      ctx,
      s.mode === "campaign"
        ? `BOARD ${String(s.boardIndex + 1).padStart(2, "0")} / ${CAMPAIGN_LENGTH}`
        : "CASCADE",
      70,
      70,
      34,
      ink,
      "left",
      800,
    );
    if (s.mode === "cascade") {
      text(ctx, `${HUD_SOLVED_LABEL} ${s.solvedCount}`, 440, 72, 22, ink);
      text(ctx, `${HUD_TIER_LABEL} ${s.tier}`, 700, 72, 22, ink);
    }
    s.beams.forEach((b, i) => {
      symbol(ctx, b.channel, 970 + i * 90, 93, 12, complete(s, b));
      text(
        ctx,
        complete(s, b) ? "✓" : "○",
        970 + i * 90,
        128,
        17,
        HUES[b.channel],
        "center",
        700,
      );
    });
    const ts = targets(s);
    drawTarget(ctx, ts[0], CLEAR_LABEL);
    drawTarget(ctx, ts[1], BACK_LABEL);
    text(ctx, "R TO CLEAR", 1076, 432, 16, mutedInk, "center");
    return;
  }
  round(ctx, 24, 206, 292, 356, 24, "#101e33e8", "#4a617e");
  text(
    ctx,
    s.screen === "complete"
      ? "CAMPAIGN COMPLETE"
      : s.mode === "cascade"
        ? SOLVED_TITLE_TEXT
        : `BOARD ${s.boardIndex + 1} SOLVED`,
    170,
    243,
    28,
    ink,
    "center",
    800,
  );
  if (s.screen === "complete")
    text(
      ctx,
      `${CAMPAIGN_LENGTH} boards solved`,
      170,
      270,
      17,
      mutedInk,
      "center",
    );
  else if (s.mode === "cascade")
    text(
      ctx,
      `${s.solvedCount} solved · tier ${s.tier}`,
      170,
      270,
      17,
      mutedInk,
      "center",
    );
  targets(s).forEach((t, i) =>
    drawTarget(ctx, t, menuLabels(s)[i], s.menuIndex === i),
  );
}
export const game: Game<RefractState, RefractDebugApi> = {
  initialize(api: InitApi<RefractState>) {
    ACTIONS.forEach((a) => api.input.register(a, { keys: [...BINDINGS[a]] }));
    api.audio.define(CUES.connect, {
      freq: 440,
      freqTo: 590,
      durationMs: 90,
      gain: 0.11,
    });
    api.audio.define(CUES.retract, {
      freq: 350,
      freqTo: 250,
      durationMs: 90,
      gain: 0.11,
    });
    api.audio.define(CUES.channelComplete, {
      wave: "triangle",
      freq: 650,
      freqTo: 900,
      durationMs: 240,
      gain: 0.13,
    });
    api.audio.define(CUES.solved, {
      wave: "sine",
      freq: 540,
      freqTo: 1040,
      durationMs: 400,
      gain: 0.17,
    });
    api.audio.define(CUES.clear, {
      wave: "square",
      freq: 250,
      freqTo: 120,
      durationMs: 160,
      gain: 0.07,
    });
    api.diagnostics.register("screen", (s) => s.screen);
    api.diagnostics.register("mode", (s) => s.mode);
    api.diagnostics.register("board", (s) => `${s.board.cols}x${s.board.rows}`);
    CHANNELS.forEach((ch) =>
      api.diagnostics.register(ch, (s) => {
        const b = beamOf(s, ch);
        return b
          ? `${Math.max(0, b.cells.length - 1)} / ${complete(s, b) ? "complete" : "open"}`
          : "-";
      }),
    );
    api.diagnostics.register(
      "crystals",
      (s) =>
        s.board.nodes
          .filter((n) => n.kind === "crystal")
          .map((n) => `${spent(s, n)}/${n.charges}`)
          .join(" ") || "-",
    );
    api.diagnostics.register("solved", solved);
    api.diagnostics.register(
      "pointer",
      (s) =>
        `${s.pointer.x.toFixed(0)},${s.pointer.y.toFixed(0)} ${s.pointer.device}`,
    );
    return [initial(), debugApi];
  },
  update,
  render,
};
