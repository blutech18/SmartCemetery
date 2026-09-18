import { beforeEach, describe, expect, it } from "vitest";

describe("use-body-scroll-lock", () => {
  let docMock;
  let winMock;
  let lockBodyScroll;
  let unlockBodyScroll;

  beforeEach(async () => {
    // Set up mock DOM
    const bodyClassList = new Set();
    const htmlClassList = new Set();

    docMock = {
      body: {
        classList: {
          add: (c) => bodyClassList.add(c),
          remove: (c) => bodyClassList.delete(c),
          contains: (c) => bodyClassList.has(c),
        },
        style: { overflow: "", paddingRight: "" },
      },
      documentElement: {
        classList: {
          add: (c) => htmlClassList.add(c),
          remove: (c) => htmlClassList.delete(c),
          contains: (c) => htmlClassList.has(c),
        },
        style: { overflow: "" },
        clientWidth: 1024,
      },
    };

    winMock = {
      innerWidth: 1040,
    };

    global.document = docMock;
    global.window = winMock;

    // Isolate module state per test
    const mod = await import("./use-body-scroll-lock");
    lockBodyScroll = mod.lockBodyScroll;
    unlockBodyScroll = mod.unlockBodyScroll;

    // Reset any active locks
    while (docMock.body.classList.contains("modal-open")) {
      unlockBodyScroll();
    }
  });

  it("locks body and html scroll when lockBodyScroll is called", () => {
    lockBodyScroll();
    expect(docMock.body.style.overflow).toBe("hidden");
    expect(docMock.documentElement.style.overflow).toBe("hidden");
    expect(docMock.body.classList.contains("modal-open")).toBe(true);
    expect(docMock.documentElement.classList.contains("modal-open")).toBe(true);
    expect(docMock.body.style.paddingRight).toBe("16px");

    unlockBodyScroll();
    expect(docMock.body.style.overflow).toBe("");
    expect(docMock.documentElement.style.overflow).toBe("");
    expect(docMock.body.classList.contains("modal-open")).toBe(false);
    expect(docMock.documentElement.classList.contains("modal-open")).toBe(false);
    expect(docMock.body.style.paddingRight).toBe("");
  });

  it("handles nested / stacked locks cleanly via reference counting", () => {
    lockBodyScroll(); // lock 1
    lockBodyScroll(); // lock 2
    expect(docMock.body.style.overflow).toBe("hidden");

    unlockBodyScroll(); // unlock 2
    expect(docMock.body.style.overflow).toBe("hidden");
    expect(docMock.body.classList.contains("modal-open")).toBe(true);

    unlockBodyScroll(); // unlock 1
    expect(docMock.body.style.overflow).toBe("");
    expect(docMock.body.classList.contains("modal-open")).toBe(false);
  });
});
