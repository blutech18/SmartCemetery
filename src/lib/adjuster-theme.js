/**
 * Theme tokens for the map's plot-position adjuster HUD.
 *
 * Extracted from `PlotPositionAdjuster.js` (which is ~2.8k lines) so the
 * component only has to memoize a call to a pure function. Keeping the tokens
 * here also makes it explicit that they are presentation-only data.
 *
 * @param {boolean} isLight
 * @returns {Record<string, string | boolean>}
 */
export function getAdjusterTheme(isLight) {
  if (isLight) {
    return {
      isLight: true,
      // Panel
      panelBg: "rgba(255, 255, 255, 0.98)",
      panelBorder: "1px solid #cbd5e1",
      panelShadow: "0 16px 40px -8px rgba(0, 0, 0, 0.16), 0 0 0 1px rgba(0, 0, 0, 0.04)",
      textPrimary: "#0f172a",
      textSecondary: "#334155",
      textMuted: "#64748b",
      divider: "1px solid #e2e8f0",

      // Header buttons
      btnHeaderBg: "#f1f5f9",
      btnHeaderBorder: "1px solid #cbd5e1",
      btnHeaderColor: "#475569",
      btnHeaderGuideActiveBg: "rgba(59, 130, 246, 0.12)",
      btnHeaderGuideActiveBorder: "1px solid rgba(59, 130, 246, 0.35)",
      btnHeaderGuideActiveColor: "#2563eb",

      // Status tags
      alignedBg: "rgba(16, 185, 129, 0.12)",
      alignedColor: "#059669",
      alignedBorder: "1px solid rgba(16, 185, 129, 0.3)",
      pendingBg: "rgba(245, 158, 11, 0.15)",
      pendingColor: "#d97706",
      pendingBorder: "1px solid rgba(245, 158, 11, 0.35)",

      // Tabs
      tabTrackBg: "#f1f5f9",
      tabTrackBorder: "1px solid #e2e8f0",
      tabActiveBg: "#ffffff",
      tabActiveBorder: "1px solid #cbd5e1",
      tabActiveColor: "#0f172a",
      tabInactiveColor: "#64748b",

      // Target scope select
      selectBg: "#ffffff",
      selectColor: "#0f172a",
      selectBorder: "1px solid #cbd5e1",

      // Inner decks
      deckBg: "#f8fafc",
      deckBorder: "1px solid #e2e8f0",
      deckBoundaryBorder: "1px solid rgba(2, 132, 199, 0.3)",

      // Undo/Redo
      undoActiveBg: "#ffffff",
      undoActiveBorder: "1px solid rgba(2, 132, 199, 0.4)",
      undoActiveColor: "#0284c7",
      undoInactiveBg: "#f1f5f9",
      undoInactiveBorder: "1px solid #e2e8f0",
      undoInactiveColor: "rgba(100, 116, 139, 0.4)",
      kbdBg: "#f1f5f9",
      kbdColor: "#64748b",

      // Nudge
      nudgeBtnBg: "#ffffff",
      nudgeBtnBorder: "1px solid #cbd5e1",
      nudgeBtnColor: "#1e293b",
      nudgeCenterBg: "#f1f5f9",
      nudgeCenterBorder: "1px solid #e2e8f0",

      // Steps & Rotation & Spacing
      stepInactiveBg: "#ffffff",
      stepInactiveBorder: "1px solid #cbd5e1",
      stepInactiveColor: "#334155",
      stepActiveBg: "#2563eb",
      stepActiveBorder: "1px solid #1d4ed8",
      stepActiveColor: "#ffffff",

      rotBoxBg: "#ffffff",
      rotBoxBorder: "1px solid #cbd5e1",
      rotBtnBg: "#f1f5f9",
      rotBtnColor: "#334155",
      rotTextColor: "#0284c7",

      spacingBtnBg: "#ffffff",
      spacingBtnBorder: "1px solid #cbd5e1",
      spacingBtnColor: "#334155",

      doneBtnBg: "#f1f5f9",
      doneBtnBorder: "1px solid #cbd5e1",
      doneBtnColor: "#334155",

      // Boundary controls
      boundaryHandleActiveBg: "#0284c7",
      boundaryHandleActiveColor: "#ffffff",
      boundaryHandleActiveBorder: "1px solid #0284c7",
      boundaryHandleInactiveBg: "#ffffff",
      boundaryHandleInactiveColor: "#0284c7",
      boundaryHandleInactiveBorder: "1px solid rgba(2, 132, 199, 0.4)",

      boundaryBtnBg: "#ffffff",
      boundaryBtnBorder: "1px solid #cbd5e1",
      boundaryBtnColor: "#0284c7",

      // Directional cards
      edgeCardBg: "#ffffff",
      edgeCardBorder: "1px solid #e2e8f0",
      edgeCardText: "#0f172a",
      edgeCardSub: "#64748b",
      edgeCardBtnBg: "#f8fafc",
      edgeCardBtnBorder: "1px solid #e2e8f0",

      // Minimized pill
      pillBg: "rgba(255, 255, 255, 0.98)",
      pillBorder: "1px solid #cbd5e1",
      pillShadow: "0 10px 30px rgba(0, 0, 0, 0.12)",
      pillText: "#0f172a",
      pillBtnBg: "#f1f5f9",
      pillBtnBorder: "1px solid #cbd5e1",
      pillBtnColor: "#334155",

      // Guide
      guideBg: "#eff6ff",
      guideBorder: "1px solid #bfdbfe",
      guideBorderLeft: "3px solid #3b82f6",
      guideText: "#1e3a8a",
      guideTitle: "#1e3a8a",
    };
  }

  return {
    isLight: false,
    // Panel
    panelBg: "rgba(15, 23, 42, 0.96)",
    panelBorder: "1px solid rgba(255, 255, 255, 0.12)",
    panelShadow: "0 16px 40px -8px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.05)",
    textPrimary: "#f8fafc",
    textSecondary: "#cbd5e1",
    textMuted: "#94a3b8",
    divider: "1px solid rgba(255, 255, 255, 0.08)",

    // Header buttons
    btnHeaderBg: "rgba(255, 255, 255, 0.06)",
    btnHeaderBorder: "1px solid rgba(255, 255, 255, 0.1)",
    btnHeaderColor: "#cbd5e1",
    btnHeaderGuideActiveBg: "rgba(59, 130, 246, 0.2)",
    btnHeaderGuideActiveBorder: "1px solid rgba(59, 130, 246, 0.4)",
    btnHeaderGuideActiveColor: "#60a5fa",

    // Status tags
    alignedBg: "rgba(16, 185, 129, 0.12)",
    alignedColor: "#34d399",
    alignedBorder: "1px solid rgba(16, 185, 129, 0.25)",
    pendingBg: "rgba(245, 158, 11, 0.18)",
    pendingColor: "#fbbf24",
    pendingBorder: "1px solid rgba(245, 158, 11, 0.3)",

    // Tabs
    tabTrackBg: "rgba(0, 0, 0, 0.35)",
    tabTrackBorder: "1px solid rgba(255, 255, 255, 0.08)",
    tabActiveBg: "#1e293b",
    tabActiveBorder: "1px solid rgba(255, 255, 255, 0.15)",
    tabActiveColor: "#ffffff",
    tabInactiveColor: "#94a3b8",

    // Target scope select
    selectBg: "#0f172a",
    selectColor: "#f1f5f9",
    selectBorder: "1px solid rgba(255, 255, 255, 0.16)",

    // Inner decks
    deckBg: "rgba(15, 23, 42, 0.6)",
    deckBorder: "1px solid rgba(255, 255, 255, 0.08)",
    deckBoundaryBorder: "1px solid rgba(0, 229, 255, 0.25)",

    // Undo/Redo
    undoActiveBg: "rgba(30, 41, 59, 0.85)",
    undoActiveBorder: "1px solid rgba(56, 189, 248, 0.35)",
    undoActiveColor: "#38bdf8",
    undoInactiveBg: "rgba(15, 23, 42, 0.4)",
    undoInactiveBorder: "1px solid rgba(255, 255, 255, 0.06)",
    undoInactiveColor: "rgba(148, 163, 184, 0.3)",
    kbdBg: "rgba(0, 0, 0, 0.25)",
    kbdColor: "#94a3b8",

    // Nudge
    nudgeBtnBg: "#1e293b",
    nudgeBtnBorder: "1px solid rgba(255, 255, 255, 0.14)",
    nudgeBtnColor: "#e2e8f0",
    nudgeCenterBg: "rgba(0, 0, 0, 0.3)",
    nudgeCenterBorder: "1px solid rgba(255, 255, 255, 0.06)",

    // Steps & Rotation & Spacing
    stepInactiveBg: "#1e293b",
    stepInactiveBorder: "1px solid rgba(255, 255, 255, 0.1)",
    stepInactiveColor: "#cbd5e1",
    stepActiveBg: "#1d4ed8",
    stepActiveBorder: "1px solid #3b82f6",
    stepActiveColor: "#ffffff",

    rotBoxBg: "#0f172a",
    rotBoxBorder: "1px solid rgba(255, 255, 255, 0.12)",
    rotBtnBg: "#1e293b",
    rotBtnColor: "#cbd5e1",
    rotTextColor: "#38bdf8",

    spacingBtnBg: "#1e293b",
    spacingBtnBorder: "1px solid rgba(255, 255, 255, 0.12)",
    spacingBtnColor: "#cbd5e1",

    doneBtnBg: "rgba(255, 255, 255, 0.05)",
    doneBtnBorder: "1px solid rgba(255, 255, 255, 0.12)",
    doneBtnColor: "#cbd5e1",

    // Boundary controls
    boundaryHandleActiveBg: "rgba(0, 229, 255, 0.9)",
    boundaryHandleActiveColor: "#0f172a",
    boundaryHandleActiveBorder: "1px solid #00E5FF",
    boundaryHandleInactiveBg: "rgba(30, 41, 59, 0.8)",
    boundaryHandleInactiveColor: "#00E5FF",
    boundaryHandleInactiveBorder: "1px solid rgba(0, 229, 255, 0.4)",

    boundaryBtnBg: "#1e293b",
    boundaryBtnBorder: "1px solid rgba(255, 255, 255, 0.15)",
    boundaryBtnColor: "#38bdf8",

    // Directional cards
    edgeCardBg: "rgba(30, 41, 59, 0.6)",
    edgeCardBorder: "1px solid rgba(255, 255, 255, 0.08)",
    edgeCardText: "#f8fafc",
    edgeCardSub: "#94a3b8",
    edgeCardBtnBg: "#0f172a",
    edgeCardBtnBorder: "1px solid rgba(255, 255, 255, 0.12)",

    // Minimized pill
    pillBg: "rgba(15, 23, 42, 0.95)",
    pillBorder: "1px solid rgba(255, 255, 255, 0.15)",
    pillShadow: "0 10px 30px rgba(0, 0, 0, 0.6)",
    pillText: "#f8fafc",
    pillBtnBg: "rgba(255, 255, 255, 0.12)",
    pillBtnBorder: "1px solid rgba(255, 255, 255, 0.22)",
    pillBtnColor: "#ffffff",

    // Guide
    guideBg: "rgba(30, 58, 138, 0.25)",
    guideBorder: "1px solid rgba(59, 130, 246, 0.3)",
    guideBorderLeft: "3px solid #38bdf8",
    guideText: "#cbd5e1",
    guideTitle: "#f8fafc",
  };
}
