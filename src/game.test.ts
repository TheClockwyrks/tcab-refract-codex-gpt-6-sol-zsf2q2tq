import { describe, expect, it, vi } from "vitest";
import { BOARD_CX, BOARD_CY, CELL_PITCH, TIERS } from "./constants";
import { debugApi, parseBoard, solved, type RefractState } from "./game";

const fresh = (): RefractState =>
  debugApi.reset({
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
    muted: false,
  });
const at = (s: RefractState, col: number, row: number) => ({
  x: BOARD_CX - ((s.board.cols - 1) * CELL_PITCH) / 2 + col * CELL_PITCH,
  y: BOARD_CY - ((s.board.rows - 1) * CELL_PITCH) / 2 + row * CELL_PITCH,
});
const drag = (s: RefractState, points: [number, number][]) => {
  let next = debugApi.pointerDown(
    s,
    ...(Object.values(at(s, ...points[0])) as [number, number]),
  );
  for (const [col, row] of points.slice(1)) {
    const p = at(next, col, row);
    next = debugApi.pointerMove(next, p.x, p.y);
  }
  return debugApi.pointerUp(next);
};

describe("beam simulation", () => {
  it("requires every lens and solves on the last segment", () => {
    const s = debugApi.loadBoard(fresh(), ["TtT"]);
    const partial = drag(s, [
      [0, 0],
      [1, 0],
    ]);
    expect(partial.screen).toBe("playing");
    expect(partial.beams[0].cells).toHaveLength(2);
    const done = drag(partial, [
      [1, 0],
      [2, 0],
    ]);
    expect(done.screen).toBe("solved");
    expect(done.beams[0].cells).toHaveLength(3);
    expect(s.beams[0].cells).toHaveLength(0);
  });
  it("refuses a segment that crosses an existing diagonal", () => {
    let s = debugApi.loadBoard(fresh(), ["TS", "ST"]);
    s = drag(s, [
      [0, 0],
      [1, 1],
    ]);
    const p = at(s, 1, 0);
    s = debugApi.pointerDown(s, p.x, p.y);
    const q = at(s, 0, 1);
    s = debugApi.pointerMove(s, q.x, q.y);
    expect(s.beams[1].cells).toHaveLength(1);
  });
  it("spends a crystal on entry and clears all beams", () => {
    let s = debugApi.loadBoard(fresh(), ["T1T"]);
    s = drag(s, [
      [0, 0],
      [1, 0],
    ]);
    expect(debugApi.snapshot(s).board.nodes[1].spent).toBe(1);
    expect(solved(s)).toBe(false);
    s = debugApi.clear(s);
    expect(debugApi.snapshot(s).board.nodes[1].spent).toBe(0);
    expect(s.beams[0].cells).toHaveLength(0);
  });
  it("draws each grid size independently within every tier", () => {
    for (const tier of TIERS)
      for (const colDraw of [0, 0.999])
        for (const rowDraw of [0, 0.999]) {
          const random = vi
            .spyOn(Math, "random")
            .mockReturnValueOnce(colDraw)
            .mockReturnValueOnce(rowDraw)
            .mockReturnValue(0);
          const s = debugApi.generateBoard(fresh(), tier.tier);
          random.mockRestore();
          const crystals = s.board.nodes.filter((n) => n.kind === "crystal");
          expect(s.board.cols).toBe(
            colDraw === 0 ? tier.minCols : tier.maxCols,
          );
          expect(s.board.rows).toBe(
            rowDraw === 0 ? tier.minRows : tier.maxRows,
          );
          expect(crystals.length).toBeGreaterThanOrEqual(tier.minCrystals);
          expect(crystals.length).toBeLessThanOrEqual(tier.maxCrystals);
          expect(
            s.board.cols * s.board.rows - s.board.nodes.length,
          ).toBeLessThanOrEqual(tier.maxEmptyCells);
          expect(
            crystals.every(
              (n) =>
                n.charges! >= tier.minCharges && n.charges! <= tier.maxCharges,
            ),
          ).toBe(true);
          expect(s.beams).toHaveLength(tier.channels);
        }
  });
  it("keeps unrelated progress when a debug pose loads a board", () => {
    const current = { ...fresh(), menuIndex: 2, solvedCount: 9, tier: 3 };
    const loaded = debugApi.loadBoard(current, ["TtT"]);
    expect(loaded.menuIndex).toBe(2);
    expect(loaded.solvedCount).toBe(9);
    expect(loaded.tier).toBe(3);
    expect(current.screen).toBe("title");
  });
  it("parses notation and rejects unknown nodes", () => {
    expect(parseBoard(["T.S", "1.s", "T.S"]).nodes).toHaveLength(6);
    expect(() => parseBoard(["X"])).toThrow();
  });
});
