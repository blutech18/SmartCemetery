import { describe, it, expect } from "vitest";
import { HistoryStack } from "@/lib/history-stack";

describe("HistoryStack", () => {
  it("undoes and redoes through pushed states", () => {
    const h = new HistoryStack();
    h.reset("a");
    h.push("b", 1000);
    h.push("c", 2000);
    expect(h.canUndo).toBe(true);
    expect(h.canRedo).toBe(false);
    expect(h.undo()).toBe("b");
    expect(h.undo()).toBe("a");
    expect(h.undo()).toBeNull();
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(true);
    expect(h.redo()).toBe("b");
    expect(h.redo()).toBe("c");
    expect(h.redo()).toBeNull();
  });

  it("discards the redo branch when pushing after an undo", () => {
    const h = new HistoryStack();
    h.reset("a");
    h.push("b", 1000);
    h.undo();
    h.push("c", 2000);
    expect(h.canRedo).toBe(false);
    expect(h.undo()).toBe("a");
    expect(h.redo()).toBe("c");
  });

  it("coalesces rapid pushes into one step", () => {
    const h = new HistoryStack({ coalesceMs: 300 });
    h.reset("a");
    h.push("b", 1000); // new step
    h.push("b2", 1100); // rapid: replaces "b"
    h.push("b3", 1200); // rapid: replaces again
    expect(h.undo()).toBe("a");
    expect(h.undo()).toBeNull();
    expect(h.redo()).toBe("b3");
  });

  it("does not leave a stale redo entry after a coalesced push", () => {
    const h = new HistoryStack({ coalesceMs: 300 });
    h.reset("a");
    h.push("b", 1000);
    h.push("c", 2000);
    h.undo(); // at b, redo -> c
    h.push("b2", 2050); // rapid push replaces b; old "c" branch must be gone
    expect(h.canRedo).toBe(false);
    expect(h.redo()).toBeNull();
  });

  it("caps history at the limit, dropping the oldest", () => {
    const h = new HistoryStack({ limit: 3 });
    h.reset(0);
    for (let i = 1; i <= 5; i += 1) h.push(i, i * 1000);
    expect(h.undo()).toBe(4);
    expect(h.undo()).toBe(3);
    expect(h.undo()).toBeNull();
  });

  it("clear() leaves nothing to undo or redo; reset() starts a new baseline", () => {
    const h = new HistoryStack();
    h.reset("a");
    h.push("b", 1000);
    h.clear();
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
    h.reset("x");
    expect(h.canUndo).toBe(false);
    expect(h.undo()).toBeNull();
  });
});
