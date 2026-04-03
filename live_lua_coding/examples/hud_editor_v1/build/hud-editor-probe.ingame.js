// HUD Editor Probe - Lua Painter
// Project: D:\github\du-tobi\live_lua_coding\examples\hud_editor_v1
// Built: 2026-04-03T06:16:21Z

// Inlined CSS
(function injectCSS() {
  var existing = document.getElementById('hud-editor-styles');
  if (existing && existing.parentNode) {
    existing.parentNode.removeChild(existing);
  }
  var style = document.createElement('style');
  style.id = 'hud-editor-styles';
  style.textContent = "/* hud-editor.css - All HUD Editor styles\n   Project: D:\\\\github\\\\du-tobi\\\\live_lua_coding\\\\examples\\\\hud_editor_v1\n   Self-contained - does NOT use ModUiExtractor core styles\n*/\n\n/* ─── Root container ────────────────────────────────────────────────── */\n\n#hud-editor-root {\n  position: fixed;\n  top: 0;\n  left: 0;\n  width: 100vw;\n  height: 100vh;\n  z-index: 99999;\n  pointer-events: none;\n  font-family: 'Rajdhani', 'Segoe UI', Tahoma, sans-serif;\n  font-size: 14px;\n  color: #ccc;\n  background: rgba(0, 0, 0, 0.70);\n  display: none;\n  overflow: hidden;\n  user-select: none;\n  -webkit-user-select: none;\n  -moz-user-select: none;\n  -ms-user-select: none;\n}\n\n#hud-editor-root[style*=\"block\"] {\n  pointer-events: auto;\n}\n\n/* ─── Screens ────────────────────────────────────────────────────────── */\n\n.hud-screen {\n  display: none;\n  position: absolute;\n  top: 0;\n  left: 0;\n  width: 100vw;\n  height: 100vh;\n}\n\n.hud-screen.active {\n  display: flex;\n}\n\n/* ══════════════════════════════════════════════════════════════════════ */\n/*                           START SCREEN                                */\n/* ══════════════════════════════════════════════════════════════════════ */\n\n[data-screen=\"start\"] {\n  width: 80vw;\n  height: 80vh;\n  top: 10vh;\n  left: 10vw;\n  align-items: center;\n  justify-content: center;\n  background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%);\n  border: 1px solid rgba(255, 255, 255, 0.08);\n  border-radius: 18px;\n  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);\n  overflow: auto;\n}\n\n.start-container {\n  text-align: center;\n  max-width: 520px;\n  padding: 48px;\n}\n\n.start-header h1 {\n  font-size: 52px;\n  font-weight: 700;\n  color: #fff;\n  margin: 0 0 8px 0;\n  text-shadow: 0 0 30px rgba(14, 233, 231, 0.4);\n  letter-spacing: 1px;\n}\n\n.start-header .subtitle {\n  color: #777;\n  font-size: 18px;\n  margin: 0 0 48px 0;\n}\n\n.start-menu {\n  display: flex;\n  flex-direction: column;\n  gap: 14px;\n}\n\n.start-context-card {\n  display: flex;\n  flex-direction: column;\n  gap: 10px;\n  margin-bottom: 18px;\n  padding: 14px 16px;\n  background: rgba(255, 255, 255, 0.035);\n  border: 1px solid rgba(255, 255, 255, 0.07);\n  border-radius: 12px;\n}\n\n.start-context-title {\n  font-size: 12px;\n  font-weight: 700;\n  letter-spacing: 0.12em;\n  text-transform: uppercase;\n  color: #8a91a4;\n}\n\n.start-context-pill,\n.editor-context-pill {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  min-height: 28px;\n  padding: 0 12px;\n  border: 1px solid rgba(255, 255, 255, 0.08);\n  border-radius: 999px;\n  font-size: 12px;\n  font-weight: 700;\n  letter-spacing: 0.08em;\n  text-transform: uppercase;\n}\n\n.start-context-pill.is-online,\n.editor-context-pill.is-online {\n  background: rgba(14, 233, 231, 0.14);\n  border-color: rgba(14, 233, 231, 0.4);\n  color: #94fffd;\n}\n\n.start-context-pill.is-offline,\n.editor-context-pill.is-offline {\n  background: rgba(255, 196, 92, 0.12);\n  border-color: rgba(255, 196, 92, 0.28);\n  color: #ffcf7c;\n}\n\n.start-context-copy {\n  margin: 0;\n  font-size: 13px;\n  line-height: 1.45;\n  color: #8e96ab;\n}\n\n.menu-btn {\n  display: flex;\n  align-items: center;\n  width: 100%;\n  padding: 18px 24px;\n  background: rgba(255, 255, 255, 0.04);\n  border: 1px solid rgba(255, 255, 255, 0.08);\n  border-radius: 12px;\n  cursor: pointer;\n  transition: all 0.2s ease;\n  text-align: left;\n  color: inherit;\n  font-family: inherit;\n  font-size: 16px;\n}\n\n.menu-btn:hover {\n  background: rgba(14, 233, 231, 0.08);\n  border-color: rgba(14, 233, 231, 0.3);\n  transform: translateX(6px);\n}\n\n.menu-btn.primary {\n  background: rgba(14, 233, 231, 0.10);\n  border-color: rgba(14, 233, 231, 0.3);\n}\n\n.menu-btn.primary:hover {\n  background: rgba(14, 233, 231, 0.18);\n  border-color: rgba(14, 233, 231, 0.5);\n}\n\n.menu-btn:disabled,\n.status-btn:disabled,\n.btn:disabled {\n  cursor: not-allowed;\n  opacity: 0.48;\n  transform: none;\n  box-shadow: none;\n}\n\n.menu-btn:disabled:hover,\n.status-btn:disabled:hover,\n.btn:disabled:hover {\n  background: inherit;\n  border-color: inherit;\n  color: inherit;\n  transform: none;\n}\n\n.menu-btn .icon {\n  font-size: 26px;\n  margin-right: 18px;\n  width: 32px;\n  text-align: center;\n  flex-shrink: 0;\n}\n\n.menu-btn .label-group {\n  display: flex;\n  flex-direction: column;\n}\n\n.menu-btn .label {\n  color: #fff;\n  font-size: 20px;\n  font-weight: 600;\n}\n\n.menu-btn .desc {\n  color: #666;\n  font-size: 13px;\n  margin-top: 3px;\n}\n\n.start-footer {\n  margin-top: 40px;\n}\n\n.hint {\n  color: #444;\n  font-size: 13px;\n  font-style: italic;\n}\n\n/* ══════════════════════════════════════════════════════════════════════ */\n/*                           EDITOR SCREEN                               */\n/* ══════════════════════════════════════════════════════════════════════ */\n\n[data-screen=\"editor\"] {\n  top: 8vh;\n  left: 6vw;\n  width: 88vw;\n  height: 84vh;\n  flex-direction: column;\n  background: #12121a;\n  border: 1px solid rgba(255, 255, 255, 0.08);\n  border-radius: 18px;\n  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5);\n  overflow: hidden;\n}\n\n/* ─── Toolbar ────────────────────────────────────────────────────────── */\n\n#editor-toolbar {\n  display: flex;\n  align-items: center;\n  gap: 4px;\n  padding: 5px 10px;\n  background: linear-gradient(180deg, #1c1c28 0%, #16161e 100%);\n  border-bottom: 1px solid #0e0e14;\n  flex-shrink: 0;\n  height: 50px;\n}\n\n.toolbar-group {\n  display: flex;\n  align-items: center;\n  gap: 3px;\n}\n\n.toolbar-divider {\n  width: 1px;\n  height: 26px;\n  background: linear-gradient(180deg, transparent 0%, #2a2a3a 30%, #2a2a3a 70%, transparent 100%);\n  margin: 0 8px;\n}\n\n.toolbar-spacer {\n  flex: 1;\n}\n\n.toolbar-dropdown {\n  position: relative;\n}\n\n/* Tool & action buttons — bordered, recessed panel look */\n.tool-btn,\n.action-btn {\n  position: relative;\n  display: inline-flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  width: 46px;\n  height: 44px;\n  padding: 0;\n  border: 1px solid #2a2a36;\n  border-radius: 5px;\n  background: linear-gradient(180deg, #22222e 0%, #1a1a24 100%);\n  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.03);\n  color: #8f98ac;\n  cursor: pointer;\n  transition: all 0.12s ease;\n  font-family: inherit;\n}\n\n.tool-btn:hover,\n.action-btn:hover {\n  background: linear-gradient(180deg, #2a2a38 0%, #22222e 100%);\n  border-color: #3a3a4a;\n  color: #b0b8c8;\n}\n\n.tool-btn:active,\n.action-btn:active {\n  background: linear-gradient(180deg, #181822 0%, #1e1e28 100%);\n  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3);\n}\n\n.tool-btn.active {\n  background: linear-gradient(180deg, #162a2a 0%, #0e2222 100%);\n  border-color: rgba(14, 233, 231, 0.4);\n  color: #0ee9e7;\n  box-shadow: 0 0 8px rgba(14, 233, 231, 0.10), inset 0 1px 0 rgba(14, 233, 231, 0.08);\n}\n\n.toolbar-dropdown-trigger.active,\n.toolbar-dropdown.open .toolbar-dropdown-trigger {\n  background: linear-gradient(180deg, #162a2a 0%, #0e2222 100%);\n  border-color: rgba(14, 233, 231, 0.4);\n  color: #0ee9e7;\n  box-shadow: 0 0 8px rgba(14, 233, 231, 0.10), inset 0 1px 0 rgba(14, 233, 231, 0.08);\n}\n\n.toolbar-dropdown-caret {\n  position: absolute;\n  right: 4px;\n  bottom: 2px;\n  font-size: 10px;\n  line-height: 1;\n  color: currentColor;\n  opacity: 0.9;\n}\n\n.toolbar-dropdown-menu {\n  position: absolute;\n  top: calc(100% + 8px);\n  left: 0;\n  min-width: 188px;\n  padding: 6px;\n  border: 1px solid #2a2a3a;\n  border-radius: 10px;\n  background: linear-gradient(180deg, rgba(28, 30, 43, 0.98), rgba(16, 18, 27, 0.98));\n  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.42);\n  display: none;\n  flex-direction: column;\n  gap: 4px;\n  z-index: 320;\n}\n\n.toolbar-dropdown.open .toolbar-dropdown-menu {\n  display: flex;\n}\n\n.dropdown-tool-btn {\n  width: 100%;\n  min-height: 40px;\n  height: auto;\n  padding: 8px 10px;\n  flex-direction: row;\n  justify-content: flex-start;\n  gap: 10px;\n}\n\n.dropdown-tool-btn .tb-icon {\n  width: 22px;\n  height: 22px;\n  flex-shrink: 0;\n}\n\n.dropdown-tool-copy {\n  display: flex;\n  min-width: 0;\n  flex: 1;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n}\n\n.dropdown-tool-title {\n  font-size: 13px;\n  font-weight: 600;\n  color: #dce4f3;\n  white-space: nowrap;\n}\n\n.dropdown-tool-key {\n  font-size: 11px;\n  font-weight: 700;\n  letter-spacing: 0.08em;\n  color: #70809b;\n  text-transform: uppercase;\n}\n\n.dropdown-tool-btn.active .dropdown-tool-title,\n.dropdown-tool-btn.active .dropdown-tool-key {\n  color: inherit;\n}\n\n/* Icon shape — rendered via CSS */\n.tb-icon {\n  display: block;\n  width: 26px;\n  height: 26px;\n  position: relative;\n}\n\n/* Select tool — mouse pointer arrow */\n.tb-icon-select::before,\n.tb-icon-box::before,\n.tb-icon-rounded::before,\n.tb-icon-circle::before,\n.tb-icon-line::before,\n.tb-icon-text::before {\n  content: none;\n}\n\n.tb-icon-select::after {\n  content: none;\n}\n\n.tb-icon-glyph {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  font-weight: 700;\n  line-height: 1;\n  color: currentColor;\n  text-shadow: 0 0 8px rgba(255, 255, 255, 0.04);\n  font-family: \"Segoe UI Symbol\", \"Segoe UI\", Arial, sans-serif;\n}\n\n.tb-icon-glyph-select {\n  font-size: 24px;\n}\n\n.tb-icon-glyph-box,\n.tb-icon-glyph-rounded,\n.tb-icon-glyph-circle {\n  font-size: 23px;\n}\n\n.tb-icon-glyph-line {\n  font-size: 27px;\n  transform: translateY(-1px) scaleX(1.08);\n}\n\n.tb-icon-glyph-text {\n  font-size: 22px;\n  font-family: inherit;\n}\n\n.dropdown-tool-btn .tb-icon-glyph-line {\n  transform: translateY(-1px);\n}\n\n/* Alignment icons — bar + rectangle pattern */\n.tb-icon-align-left::before,\n.tb-icon-align-right::before,\n.tb-icon-align-center-h::before,\n.tb-icon-align-top::before,\n.tb-icon-align-bottom::before,\n.tb-icon-align-center-v::before {\n  content: \"\";\n  position: absolute;\n  background: currentColor;\n}\n\n.tb-icon-align-left::after,\n.tb-icon-align-right::after,\n.tb-icon-align-center-h::after,\n.tb-icon-align-top::after,\n.tb-icon-align-bottom::after,\n.tb-icon-align-center-v::after {\n  content: \"\";\n  position: absolute;\n  border: 2px solid currentColor;\n  border-radius: 1px;\n  box-sizing: border-box;\n}\n\n/* Align icons use a tighter centered draw box */\n.tb-icon-align-left::before  { left: 2px; top: 2px; width: 2px; height: 14px; }\n.tb-icon-align-left::after   { left: 7px; top: 50%; width: 10px; height: 7px; transform: translateY(-50%); }\n\n.tb-icon-align-right::before { right: 2px; top: 2px; width: 2px; height: 14px; }\n.tb-icon-align-right::after  { right: 7px; top: 50%; width: 10px; height: 7px; transform: translateY(-50%); }\n\n.tb-icon-align-center-h::before { left: 50%; top: 2px; width: 2px; height: 14px; transform: translateX(-50%); }\n.tb-icon-align-center-h::after  { left: 50%; top: 50%; width: 10px; height: 7px; transform: translate(-50%, -50%); }\n\n.tb-icon-align-top::before { top: 2px; left: 2px; height: 2px; width: 14px; }\n.tb-icon-align-top::after  { top: 7px; left: 50%; width: 7px; height: 10px; transform: translateX(-50%); }\n\n.tb-icon-align-bottom::before { bottom: 2px; left: 2px; height: 2px; width: 14px; }\n.tb-icon-align-bottom::after  { bottom: 7px; left: 50%; width: 7px; height: 10px; transform: translateX(-50%); }\n\n.tb-icon-align-center-v::before { top: 50%; left: 2px; height: 2px; width: 14px; transform: translateY(-50%); }\n.tb-icon-align-center-v::after  { top: 50%; left: 50%; width: 7px; height: 10px; transform: translate(-50%, -50%); }\n\n/* Clone tool — two overlapping rectangles with plus */\n.tb-icon-clone::before {\n  content: \"\";\n  position: absolute;\n  left: 2px;\n  top: 5px;\n  width: 7px;\n  height: 7px;\n  border: 1.5px solid currentColor;\n  border-radius: 1px;\n}\n.tb-icon-clone::after {\n  content: \"\";\n  position: absolute;\n  left: 7px;\n  top: 2px;\n  width: 7px;\n  height: 7px;\n  border: 1.5px solid currentColor;\n  border-radius: 1px;\n  background-image:\n    linear-gradient(currentColor, currentColor),\n    linear-gradient(currentColor, currentColor);\n  background-repeat: no-repeat;\n  background-size: 5px 1.5px, 1.5px 5px;\n  background-position: center center, center center;\n}\n\n/* Group tool — overlapping grouped rectangles */\n.tb-icon-group::before {\n  content: \"\";\n  position: absolute;\n  left: 2px;\n  top: 5px;\n  width: 7px;\n  height: 7px;\n  border: 1.5px solid currentColor;\n  border-radius: 1px;\n}\n.tb-icon-group::after {\n  content: \"\";\n  position: absolute;\n  left: 7px;\n  top: 2px;\n  width: 7px;\n  height: 7px;\n  border: 1.5px solid currentColor;\n  border-radius: 1px;\n  opacity: 0.9;\n}\n\n/* Ungroup tool — two separated rectangles */\n.tb-icon-ungroup::before {\n  content: \"\";\n  position: absolute;\n  left: 0;\n  bottom: 0;\n  width: 5px;\n  height: 5px;\n  border: 1.5px solid currentColor;\n  border-radius: 1px;\n}\n.tb-icon-ungroup::after {\n  content: \"\";\n  position: absolute;\n  right: 0;\n  top: 0;\n  width: 5px;\n  height: 5px;\n  border: 1.5px solid currentColor;\n  border-radius: 1px;\n}\n\n/* Keyboard hint */\n.tb-key {\n  display: none;\n}\n\n.tool-btn.active .tb-key {\n  opacity: 0.65;\n}\n\n/* Action buttons (undo/redo) */\n.action-btn {\n  width: 46px;\n  height: 44px;\n}\n\n.action-btn .tb-icon {\n  font-size: 20px;\n  width: 24px;\n  height: 24px;\n}\n\n/* ─── Color swatches ─────────────────────────────────────────────────── */\n\n.toolbar-group.colors {\n  gap: 12px;\n  margin: 0 10px 0 6px;\n  padding: 0 8px;\n}\n\n.swatch-pair {\n  display: flex;\n  align-items: center;\n  gap: 14px;\n  margin-right: 10px;\n  padding: 0 10px;\n}\n\n.swatch-pair:last-child {\n  margin-right: 0;\n}\n\n.swatch-label {\n  min-width: 40px;\n  font-size: 11px;\n  font-weight: 600;\n  color: #7e879c;\n  text-transform: uppercase;\n  letter-spacing: 0.7px;\n  text-align: right;\n  margin-right: 6px;\n}\n\n.color-swatch-btn,\n.prop-color-btn {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 34px;\n  height: 34px;\n  appearance: none;\n  -webkit-appearance: none;\n  border: 1px solid #2a2a36;\n  border-radius: 6px;\n  cursor: pointer;\n  background-color: #1b1b25;\n  background-image: linear-gradient(180deg, #232332 0%, #171721 100%);\n  padding: 3px;\n  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.03);\n  transition: border-color 0.12s ease, transform 0.12s ease;\n  flex-shrink: 0;\n  margin-left: 6px;\n}\n\n.color-swatch-btn:hover,\n.prop-color-btn:hover {\n  border-color: #4a4a5a;\n  transform: translateY(-1px);\n}\n\n.color-swatch-chip,\n.prop-color-chip {\n  width: 24px;\n  height: 24px;\n  display: block;\n  border-radius: 4px;\n  background: var(--swatch-color, #ffffff);\n  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.14);\n  flex: 0 0 auto;\n}\n\n.prop-color-btn {\n  width: 42px;\n  margin-left: auto;\n}\n\n.prop-color-chip {\n  width: 30px;\n  height: 30px;\n}\n\n.size-input {\n  width: 56px;\n  height: 36px;\n  background: #1a1a24;\n  border: 1px solid #3a3a4a;\n  border-radius: 6px;\n  color: #ccc;\n  font-size: 14px;\n  padding: 0 6px;\n  text-align: center;\n  font-family: inherit;\n}\n\n.size-input:focus {\n  border-color: rgba(14, 233, 231, 0.5);\n  outline: none;\n}\n\n/* ─── Canvas area ────────────────────────────────────────────────────── */\n\n#canvas-container {\n  flex: 1;\n  overflow: hidden;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  padding: 20px;\n  background: #0a0a10;\n  position: relative;\n}\n\n#canvas-preview {\n  position: relative;\n  background: #1a1a24;\n  border: 1px solid #3a3a4a;\n  border-radius: 8px;\n  box-shadow: 0 0 40px rgba(0, 0, 0, 0.5);\n  overflow: hidden;\n}\n\n/* Canvas elements (rendered from document.elements) */\n.canvas-element {\n  position: absolute;\n  box-sizing: border-box;\n  cursor: pointer;\n  transition: opacity 0.1s ease;\n}\n\n.canvas-element:hover {\n  opacity: 0.85;\n}\n\n.canvas-element.selected {\n  outline: 2px solid rgba(14, 233, 231, 0.9);\n  outline-offset: 2px;\n  cursor: move;\n}\n\n/* Selection handles */\n.resize-handle {\n  position: absolute;\n  width: 10px;\n  height: 10px;\n  background: #0ee9e7;\n  border: 1px solid #fff;\n  border-radius: 2px;\n  z-index: 100;\n  pointer-events: auto;\n}\n\n.resize-handle[data-h=\"nw\"] { cursor: nw-resize; top: -5px; left: -5px; }\n.resize-handle[data-h=\"n\"]  { cursor: n-resize;  top: -5px; left: calc(50% - 5px); }\n.resize-handle[data-h=\"ne\"] { cursor: ne-resize; top: -5px; right: -5px; }\n.resize-handle[data-h=\"e\"]  { cursor: e-resize;  top: calc(50% - 5px); right: -5px; }\n.resize-handle[data-h=\"se\"] { cursor: se-resize; bottom: -5px; right: -5px; }\n.resize-handle[data-h=\"s\"]  { cursor: s-resize;  bottom: -5px; left: calc(50% - 5px); }\n.resize-handle[data-h=\"sw\"] { cursor: sw-resize; bottom: -5px; left: -5px; }\n.resize-handle[data-h=\"w\"]  { cursor: w-resize;  top: calc(50% - 5px); left: -5px; }\n\n/* Group selection overlay — orange bounding box */\n.group-overlay {\n  position: absolute;\n  pointer-events: none;\n  z-index: 90;\n}\n\n.group-outline {\n  position: absolute;\n  inset: 0;\n  border: 2px solid rgba(255, 140, 0, 0.9);\n  background: rgba(255, 140, 0, 0.04);\n}\n\n/* Group resize handles — same as individual but orange */\n.group-handle {\n  position: absolute;\n  width: 10px;\n  height: 10px;\n  background: #ff8c00;\n  border: 1px solid #fff;\n  border-radius: 2px;\n  z-index: 100;\n  pointer-events: auto;\n}\n\n.group-handle[data-h=\"nw\"] { cursor: nw-resize; top: -5px; left: -5px; }\n.group-handle[data-h=\"n\"]  { cursor: n-resize;  top: -5px; left: calc(50% - 5px); }\n.group-handle[data-h=\"ne\"] { cursor: ne-resize; top: -5px; right: -5px; }\n.group-handle[data-h=\"e\"]  { cursor: e-resize;  top: calc(50% - 5px); right: -5px; }\n.group-handle[data-h=\"se\"] { cursor: se-resize; bottom: -5px; right: -5px; }\n.group-handle[data-h=\"s\"]  { cursor: s-resize;  bottom: -5px; left: calc(50% - 5px); }\n.group-handle[data-h=\"sw\"] { cursor: sw-resize; bottom: -5px; left: -5px; }\n.group-handle[data-h=\"w\"]  { cursor: w-resize;  top: calc(50% - 5px); left: -5px; }\n\n.toolbar-check {\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n  padding: 0 8px;\n  min-height: 32px;\n  border: 1px solid #2a2a3a;\n  border-radius: 8px;\n  background: linear-gradient(180deg, rgba(35, 39, 56, 0.96), rgba(23, 25, 36, 0.96));\n  color: #9aa4ba;\n  cursor: pointer;\n  user-select: none;\n}\n\n.toolbar-check:hover {\n  border-color: #3b465f;\n  color: #cfd8e8;\n}\n\n.toolbar-check-input {\n  position: absolute;\n  opacity: 0;\n  pointer-events: none;\n}\n\n.toolbar-check-box {\n  width: 13px;\n  height: 13px;\n  border: 1px solid #4a556d;\n  border-radius: 3px;\n  background: rgba(9, 12, 18, 0.85);\n  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.04);\n  position: relative;\n  flex-shrink: 0;\n}\n\n.toolbar-check-input:checked + .toolbar-check-box {\n  border-color: rgba(255, 140, 0, 0.9);\n  background: rgba(255, 140, 0, 0.18);\n}\n\n.toolbar-check-input:checked + .toolbar-check-box::after {\n  content: \"\";\n  position: absolute;\n  left: 3px;\n  top: 1px;\n  width: 4px;\n  height: 7px;\n  border: solid #ffb04d;\n  border-width: 0 2px 2px 0;\n  transform: rotate(45deg);\n}\n\n.toolbar-check-label {\n  font-size: 11px;\n  font-weight: 600;\n  letter-spacing: 0.02em;\n  white-space: nowrap;\n}\n\n/* ─── Layers / shapes panel ────────────────────────────────────────── */\n\n#shapes-panel {\n  position: absolute;\n  right: 12px;\n  top: 72px;\n  width: 240px;\n  min-width: 180px;\n  min-height: 80px;\n  max-height: 60vh;\n  background: #1a1a24;\n  border: 1px solid #2a2a3a;\n  border-radius: 8px;\n  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);\n  z-index: 200;\n  overflow: hidden;\n  resize: both;\n  display: none;\n  flex-direction: column;\n}\n\n#shapes-panel.visible {\n  display: flex;\n}\n\n.shapes-list {\n  flex: 1;\n  overflow-y: auto;\n  overflow-x: hidden;\n  padding: 6px;\n}\n\n.layers-empty {\n  padding: 16px;\n  text-align: center;\n  color: #444;\n  font-size: 13px;\n  font-style: italic;\n}\n\n/* Layer item row */\n.layer-item {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  padding: 5px 8px;\n  margin-bottom: 6px;\n  cursor: pointer;\n  transition: background 0.1s ease, border-color 0.1s ease, box-shadow 0.1s ease;\n  border: 1px solid #2a2a36;\n  border-left: 3px solid transparent;\n  border-radius: 6px;\n  background: linear-gradient(180deg, #22222e 0%, #1a1a24 100%);\n  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);\n}\n\n.layer-item:hover {\n  background: linear-gradient(180deg, #272734 0%, #1d1d28 100%);\n  border-color: #363646;\n}\n\n.layer-item.selected {\n  background: linear-gradient(180deg, rgba(14, 233, 231, 0.12) 0%, rgba(14, 233, 231, 0.07) 100%);\n  border-color: rgba(14, 233, 231, 0.22);\n  border-left-color: #0ee9e7;\n}\n\n.layer-group-box {\n  margin-bottom: 8px;\n  padding: 6px;\n  border: 1px solid rgba(255, 140, 0, 0.42);\n  border-radius: 8px;\n  background: linear-gradient(180deg, rgba(255, 140, 0, 0.08) 0%, rgba(72, 44, 17, 0.26) 100%);\n  box-shadow: inset 0 0 0 1px rgba(255, 176, 77, 0.04);\n}\n\n.layer-group-box.selected {\n  border-color: rgba(255, 140, 0, 0.85);\n  box-shadow: inset 0 0 0 1px rgba(255, 176, 77, 0.10);\n}\n\n.layer-item.grouped-member {\n  padding-left: 10px;\n}\n\n.layer-group-sep {\n  height: 1px;\n  margin: 2px 6px 8px;\n  background: linear-gradient(90deg, transparent 0%, #2f3242 18%, #2f3242 82%, transparent 100%);\n}\n\n.layer-icon {\n  width: 18px;\n  text-align: center;\n  font-size: 14px;\n  color: #666;\n  flex-shrink: 0;\n}\n\n.layer-item.selected .layer-icon {\n  color: #0ee9e7;\n}\n\n.layer-group-box .layer-item.grouped-member .layer-icon {\n  color: #ffb04d;\n}\n\n.layer-name {\n  flex: 1;\n  font-size: 12px;\n  color: #aaa;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.layer-item.selected .layer-name {\n  color: #ddd;\n}\n\n.layer-group-box .layer-item.grouped-member .layer-name {\n  color: #e5d0b4;\n}\n\n/* Layer action buttons (visibility, z-order) */\n.layer-btn {\n  width: 22px;\n  height: 22px;\n  border: none;\n  background: none;\n  color: #666;\n  cursor: pointer;\n  font-size: 12px;\n  border-radius: 3px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  flex-shrink: 0;\n  padding: 0;\n  transition: all 0.1s ease;\n}\n\n.layer-btn:hover {\n  background: rgba(255, 255, 255, 0.08);\n  color: #ccc;\n}\n\n/* Visibility eye toggle */\n.layer-vis {\n  font-size: 11px;\n  width: 20px;\n}\n\n.layer-vis::before {\n  content: \"\";\n  display: block;\n  width: 14px;\n  height: 10px;\n  border: 2px solid #0ee9e7;\n  border-radius: 75% / 100%;\n  position: relative;\n  box-sizing: border-box;\n}\n\n.layer-vis::after {\n  content: \"\";\n  display: block;\n  width: 4px;\n  height: 4px;\n  border-radius: 50%;\n  background: #0ee9e7;\n  position: relative;\n  top: -8px;\n  left: 5px;\n}\n\n.layer-vis.off::before {\n  border-color: #333;\n}\n\n.layer-vis.off::after {\n  background: #333;\n}\n\n/* Z-order arrows */\n.layer-z {\n  font-size: 14px;\n  min-width: 22px;\n  min-height: 22px;\n  color: #555;\n}\n\n.layer-z:hover {\n  color: #0ee9e7;\n  background: rgba(14, 233, 231, 0.08);\n}\n\n/* ─── Properties panel ──────────────────────────────────────────────── */\n\n#properties-panel {\n  position: absolute;\n  left: 12px;\n  top: 72px;\n  width: 340px;\n  min-width: 280px;\n  min-height: 80px;\n  background: #1a1a24;\n  border: 1px solid #2a2a3a;\n  border-radius: 8px;\n  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);\n  z-index: 200;\n  overflow-x: hidden;\n  overflow-y: auto;\n  resize: both;\n  display: none;\n}\n\n#properties-panel.visible {\n  display: block;\n}\n\n.panel-header {\n  display: flex;\n  align-items: center;\n  padding: 10px 14px;\n  background: #1e1e2a;\n  border-bottom: 1px solid #2a2a3a;\n  font-weight: 600;\n  font-size: 13px;\n  color: #aaa;\n  cursor: grab;\n  user-select: none;\n}\n\n.panel-header:active {\n  cursor: grabbing;\n}\n\n/* Collapse / expand toggle */\n.panel-toggle {\n  margin-left: auto;\n  background: none;\n  border: none;\n  color: #666;\n  cursor: pointer;\n  font-size: 14px;\n  padding: 0 2px;\n  line-height: 1;\n  border-radius: 3px;\n  transition: color 0.1s ease;\n}\n\n.panel-toggle:hover {\n  color: #ccc;\n}\n\n/* Collapsed state — hide content, disable resize */\n#properties-panel.collapsed .panel-content,\n#shapes-panel.collapsed .shapes-list {\n  display: none !important;\n}\n\n#properties-panel.collapsed.hover-open .panel-content,\n#shapes-panel.collapsed.hover-open .shapes-list {\n  display: block !important;\n}\n\n#properties-panel.collapsed,\n#shapes-panel.collapsed {\n  resize: none;\n  min-height: auto;\n}\n\n#properties-panel.collapsed.hover-open,\n#shapes-panel.collapsed.hover-open {\n  resize: both;\n}\n\n#properties-panel.collapsed .panel-header,\n#shapes-panel.collapsed .panel-header {\n  border-bottom: none;\n}\n\n#properties-panel.collapsed.hover-open .panel-header,\n#shapes-panel.collapsed.hover-open .panel-header {\n  border-bottom: 1px solid #2a2a3a;\n}\n\n.panel-content {\n  padding: 12px;\n}\n\n.prop-row {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  margin-bottom: 10px;\n}\n\n.prop-row.vertical {\n  flex-direction: column;\n  align-items: flex-start;\n}\n\n.prop-row label {\n  font-size: 12px;\n  color: #777;\n  min-width: 28px;\n}\n\n.prop-input {\n  width: 72px;\n  flex: 0 0 72px;\n  height: 28px;\n  background: #12121a;\n  border: 1px solid #3a3a4a;\n  border-radius: 4px;\n  color: #ccc;\n  font-size: 12px;\n  padding: 0 6px;\n  font-family: inherit;\n  text-align: right;\n}\n\n.prop-input:focus {\n  border-color: rgba(14, 233, 231, 0.5);\n  outline: none;\n}\n\n.prop-color {\n  width: 32px;\n  height: 28px;\n  border: 1px solid #3a3a4a;\n  border-radius: 4px;\n  cursor: pointer;\n  background: none;\n  padding: 1px;\n}\n\n.prop-textarea {\n  width: 100%;\n  background: #12121a;\n  border: 1px solid #3a3a4a;\n  border-radius: 4px;\n  color: #ccc;\n  font-size: 12px;\n  padding: 6px;\n  font-family: inherit;\n  resize: vertical;\n}\n\n.prop-textarea:focus {\n  border-color: rgba(14, 233, 231, 0.5);\n  outline: none;\n}\n\n.prop-delete {\n  width: 100%;\n  padding: 8px;\n  background: rgba(255, 70, 70, 0.12);\n  border: 1px solid rgba(255, 70, 70, 0.3);\n  border-radius: 6px;\n  color: #ff6666;\n  cursor: pointer;\n  font-size: 13px;\n  font-family: inherit;\n  transition: all 0.15s ease;\n}\n\n.prop-delete:hover {\n  background: rgba(255, 70, 70, 0.22);\n  border-color: rgba(255, 70, 70, 0.5);\n}\n\n/* ─── Status bar ────────────────────────────────────────────────────── */\n\n#editor-statusbar {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  padding: 8px 12px;\n  background: #1a1a24;\n  border-top: 1px solid #2a2a3a;\n  flex-shrink: 0;\n  min-height: 60px;\n}\n\n.statusbar-left,\n.statusbar-right {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  flex: 0 0 auto;\n}\n\n.statusbar-center {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  flex: 1 1 auto;\n  flex-wrap: wrap;\n  justify-content: center;\n  min-width: 0;\n  padding: 0 16px;\n}\n\n.status-btn {\n  min-width: 140px;\n  height: 40px;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  padding: 0 18px;\n  border: 1px solid #3a3a4a;\n  border-radius: 6px;\n  background: rgba(255, 255, 255, 0.04);\n  color: #aaa;\n  cursor: pointer;\n  font-size: 15px;\n  font-weight: 600;\n  line-height: 1;\n  font-family: inherit;\n  transition: all 0.15s ease;\n  white-space: nowrap;\n  text-align: center;\n}\n\n.status-btn:hover {\n  background: rgba(255, 255, 255, 0.08);\n  color: #fff;\n}\n\n.status-btn.primary {\n  background: rgba(14, 233, 231, 0.12);\n  border-color: rgba(14, 233, 231, 0.3);\n  color: #0ee9e7;\n}\n\n.status-btn.primary:hover {\n  background: rgba(14, 233, 231, 0.22);\n}\n\n.status-btn.danger {\n  background: rgba(255, 70, 70, 0.08);\n  border-color: rgba(255, 70, 70, 0.3);\n  color: #ff6666;\n}\n\n.status-btn.danger:hover {\n  background: rgba(255, 70, 70, 0.18);\n}\n\n.status-hint {\n  font-size: 13px;\n  color: #8a91a4;\n  max-width: 360px;\n  line-height: 1.35;\n}\n\n/* ══════════════════════════════════════════════════════════════════════ */\n/*                           DIALOGS                                     */\n/* ══════════════════════════════════════════════════════════════════════ */\n\n.dialog-overlay {\n  position: absolute;\n  top: 0;\n  left: 0;\n  width: 100%;\n  height: 100%;\n  background: rgba(0, 0, 0, 0.7);\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  z-index: 100000;\n}\n\n.dialog {\n  background: #1e1e2a;\n  border: 1px solid #3a3a4a;\n  border-radius: 12px;\n  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.6);\n  width: 420px;\n  max-width: 90vw;\n  max-height: 80vh;\n  overflow: hidden;\n  display: flex;\n  flex-direction: column;\n}\n\n.dialog-header {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  padding: 16px 20px;\n  border-bottom: 1px solid #2a2a3a;\n}\n\n.dialog-header h3 {\n  margin: 0;\n  font-size: 18px;\n  color: #fff;\n  font-weight: 600;\n}\n\n.dialog-close {\n  width: 28px;\n  height: 28px;\n  border: none;\n  background: none;\n  color: #777;\n  font-size: 20px;\n  cursor: pointer;\n  border-radius: 4px;\n}\n\n.dialog-close:hover {\n  background: rgba(255, 255, 255, 0.08);\n  color: #fff;\n}\n\n.dialog-content {\n  padding: 20px;\n  overflow-y: auto;\n}\n\n.dialog-content.centered {\n  text-align: center;\n  padding-top: 28px;\n  padding-bottom: 24px;\n}\n\n.dialog-content.centered h3 {\n  margin: 0 0 10px;\n  font-size: 24px;\n  color: #f4f7fb;\n}\n\n.dialog-content.centered p {\n  margin: 0;\n  color: #b9c4d6;\n  font-size: 17px;\n  line-height: 1.45;\n}\n\n.dialog-color-preview {\n  width: 100%;\n  height: 54px;\n  margin-bottom: 14px;\n  border: 1px solid #3a3a4a;\n  border-radius: 8px;\n  background: #ffffff;\n  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);\n}\n\n.color-strip-label {\n  display: block;\n  margin-bottom: 8px;\n  color: #d8deea;\n  font-size: 13px;\n}\n\n.color-strip-range {\n  width: 100%;\n  height: 22px;\n  margin: 0 0 16px;\n  appearance: none;\n  -webkit-appearance: none;\n  border: 1px solid #3a3a4a;\n  border-radius: 999px;\n  background: linear-gradient(90deg, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%);\n  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04);\n  outline: none;\n}\n\n.color-strip-range::-webkit-slider-thumb {\n  -webkit-appearance: none;\n  width: 14px;\n  height: 28px;\n  border-radius: 999px;\n  border: 1px solid rgba(255, 255, 255, 0.7);\n  background: #f8fbff;\n  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.25);\n  cursor: pointer;\n}\n\n.color-field-row {\n  display: flex;\n  align-items: flex-start;\n  justify-content: space-between;\n  gap: 10px;\n  margin-bottom: 10px;\n}\n\n.color-field {\n  display: flex;\n  flex-direction: column;\n  align-items: flex-start;\n  gap: 6px;\n  color: #d8deea;\n}\n\n.color-field-label {\n  font-size: 12px;\n  font-weight: 700;\n  letter-spacing: 0.08em;\n  text-transform: uppercase;\n  color: #8a91a4;\n}\n\n.color-number-input {\n  width: 4ch;\n  min-width: 4ch;\n  height: 34px;\n  padding: 0 6px;\n  background: #12121a;\n  border: 1px solid #3a3a4a;\n  border-radius: 6px;\n  color: #e7ecf5;\n  font-size: 14px;\n  text-align: center;\n  font-family: inherit;\n  outline: none;\n}\n\n.color-number-input:focus {\n  border-color: rgba(14, 233, 231, 0.5);\n}\n\n.color-number-input::-webkit-outer-spin-button,\n.color-number-input::-webkit-inner-spin-button,\n.color-strip-range::-webkit-outer-spin-button,\n.color-strip-range::-webkit-inner-spin-button {\n  -webkit-appearance: none;\n  margin: 0;\n}\n\n.color-hex-input {\n  text-transform: uppercase;\n  letter-spacing: 0.04em;\n}\n\n.dialog-footer {\n  display: flex;\n  align-items: center;\n  justify-content: flex-end;\n  gap: 10px;\n  padding: 14px 20px;\n  border-top: 1px solid #2a2a3a;\n}\n\n.dialog-footer.centered {\n  justify-content: center;\n  flex-wrap: nowrap;\n}\n\n/* Script list in load dialog */\n.script-list {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  max-height: 300px;\n  overflow-y: auto;\n}\n\n.script-item {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  padding: 10px 14px;\n  background: rgba(255, 255, 255, 0.03);\n  border: 1px solid #2a2a3a;\n  border-radius: 8px;\n  cursor: pointer;\n  transition: all 0.15s ease;\n}\n\n.script-item:hover {\n  background: rgba(14, 233, 231, 0.06);\n  border-color: rgba(14, 233, 231, 0.2);\n}\n\n.script-item .script-name {\n  font-size: 14px;\n  color: #ddd;\n}\n\n.script-item .script-meta {\n  font-size: 11px;\n  color: #666;\n}\n\n/* Save As dialog input */\n.saveas-input {\n  width: 100%;\n  height: 36px;\n  background: #12121a;\n  border: 1px solid #3a3a4a;\n  border-radius: 6px;\n  color: #ccc;\n  font-size: 14px;\n  padding: 0 12px;\n  font-family: inherit;\n  margin-top: 8px;\n}\n\n.saveas-input:focus {\n  border-color: rgba(14, 233, 231, 0.5);\n  outline: none;\n}\n\n.save-note {\n  font-size: 12px;\n  color: #666;\n  margin-top: 8px;\n}\n\n/* Confirm dialog icon */\n.confirm-icon {\n  position: relative;\n  width: 52px;\n  height: 52px;\n  margin: 0 auto 18px;\n  border-radius: 14px;\n  background: radial-gradient(circle at 50% 35%, rgba(255, 206, 104, 0.16) 0%, rgba(255, 206, 104, 0.06) 55%, rgba(255, 206, 104, 0) 100%);\n}\n\n.confirm-icon::before {\n  content: \"\";\n  position: absolute;\n  left: 50%;\n  top: 50%;\n  width: 28px;\n  height: 28px;\n  transform: translate(-50%, -50%) rotate(45deg);\n  border: 2px solid rgba(255, 199, 93, 0.72);\n  border-radius: 4px;\n  background: rgba(255, 187, 61, 0.08);\n  box-shadow: 0 8px 20px rgba(255, 177, 58, 0.12);\n}\n\n.confirm-icon::after {\n  content: \"!\";\n  position: absolute;\n  left: 50%;\n  top: 50%;\n  transform: translate(-50%, -50%);\n  font-size: 22px;\n  line-height: 1;\n  font-weight: 700;\n  color: #ffc86b;\n}\n\n/* ─── Dialog buttons ─────────────────────────────────────────────────── */\n\n.btn {\n  min-width: 132px;\n  height: 42px;\n  padding: 0 18px;\n  border: 1px solid #3a3a4a;\n  border-radius: 6px;\n  background: linear-gradient(180deg, #262634 0%, #1a1a24 100%);\n  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.04);\n  color: #c6cfdb;\n  cursor: pointer;\n  font-size: 14px;\n  font-weight: 600;\n  letter-spacing: 0.02em;\n  font-family: inherit;\n  transition: all 0.15s ease;\n}\n\n.btn:hover {\n  background: linear-gradient(180deg, #2d2d3c 0%, #20202c 100%);\n  border-color: #4a4a5e;\n  color: #fff;\n}\n\n.btn:active {\n  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.32);\n}\n\n.btn.secondary {\n  color: #d6dfeb;\n}\n\n.btn.primary {\n  background: linear-gradient(180deg, rgba(14, 233, 231, 0.22) 0%, rgba(6, 120, 135, 0.3) 100%);\n  border-color: rgba(14, 233, 231, 0.45);\n  color: #8ffaf8;\n}\n\n.btn.primary:hover {\n  background: linear-gradient(180deg, rgba(14, 233, 231, 0.28) 0%, rgba(8, 137, 153, 0.38) 100%);\n}\n\n.btn.danger {\n  background: linear-gradient(180deg, rgba(255, 92, 92, 0.16) 0%, rgba(110, 29, 40, 0.28) 100%);\n  border-color: rgba(255, 92, 92, 0.38);\n  color: #ff8a8a;\n}\n\n.btn.danger:hover {\n  background: linear-gradient(180deg, rgba(255, 92, 92, 0.22) 0%, rgba(130, 34, 47, 0.35) 100%);\n}\n\n.btn.secondary {\n  background: rgba(255, 255, 255, 0.04);\n}\n\n/* ══════════════════════════════════════════════════════════════════════ */\n/*                           EMPTY STATE                                 */\n/* ══════════════════════════════════════════════════════════════════════ */\n\n.empty-state {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  height: 100%;\n  color: #444;\n  font-size: 16px;\n  gap: 12px;\n}\n\n.empty-state .icon {\n  font-size: 48px;\n  opacity: 0.3;\n}\n\n/* ══════════════════════════════════════════════════════════════════════ */\n/*                           TOAST NOTIFICATIONS                         */\n/* ══════════════════════════════════════════════════════════════════════ */\n\n.toast-container {\n  position: fixed;\n  /* Below toolbar: editor starts at 8vh, toolbar ~56px tall */\n  top: calc(8vh + 64px);\n  left: 50%;\n  transform: translateX(-50%);\n  z-index: 200000;\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n  align-items: center;\n  pointer-events: none;\n}\n\n.toast {\n  padding: 10px 20px;\n  background: #2a2a3a;\n  border: 1px solid #3a3a4a;\n  border-radius: 8px;\n  color: #ccc;\n  font-size: 13px;\n  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);\n  animation: toast-in 0.3s ease;\n  transition: opacity 0.25s ease, transform 0.25s ease;\n  pointer-events: auto;\n}\n\n.toast.success {\n  border-color: rgba(50, 200, 100, 0.4);\n  background: rgba(50, 200, 100, 0.1);\n  color: #6fd898;\n}\n\n.toast.error {\n  border-color: rgba(255, 70, 70, 0.4);\n  background: rgba(255, 70, 70, 0.1);\n  color: #ff8888;\n}\n\n.toast.info {\n  border-color: rgba(14, 233, 231, 0.3);\n  background: rgba(14, 233, 231, 0.08);\n  color: #0ee9e7;\n}\n\n@keyframes toast-in {\n  from { opacity: 0; transform: translateY(10px); }\n  to { opacity: 1; transform: translateY(0); }\n}\n\n/* ─── Stepper controls ───────────────────────────────────────────────── */\n\n.stepper-ctrl {\n  display: flex;\n  align-items: center;\n  gap: 3px;\n  flex: 1;\n}\n\n.stepper-dec,\n.stepper-inc {\n  flex-shrink: 0;\n  width: 26px;\n  height: 28px;\n  border: 1px solid #3a3a4a;\n  border-radius: 4px;\n  background: #12121a;\n  color: #ccc;\n  cursor: pointer;\n  font-size: 16px;\n  line-height: 1;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  font-family: inherit;\n}\n\n.stepper-dec:hover,\n.stepper-inc:hover {\n  background: rgba(14, 233, 231, 0.12);\n  border-color: rgba(14, 233, 231, 0.4);\n  color: #0ee9e7;\n}\n\n.stepper-select {\n  flex: 1;\n  height: 28px;\n  background: #12121a;\n  border: 1px solid #3a3a4a;\n  border-radius: 4px;\n  color: #ccc;\n  font-size: 12px;\n  padding: 0 4px;\n  font-family: inherit;\n  text-align: center;\n  cursor: pointer;\n}\n\n.stepper-select:focus {\n  border-color: rgba(14, 233, 231, 0.5);\n  outline: none;\n}\n";
  document.head.appendChild(style);
})();
// --- 000-core.js ---
// 000-core.js - HUD Editor runtime, root state, DOM utilities
(function hudEditorCore() {
  "use strict";

  var WIN = window;
  var DOC = document;
  var NS = "HudEditor";

  if (WIN[NS] && typeof WIN[NS].destroy === "function") {
    try {
      WIN[NS].destroy("reinstall");
    } catch (_ignoreDestroy) {}
  }
  if (WIN[NS]) {
    return;
  }

  var listeners = {};
  var cleanupFns = [];
  var activeToasts = {};

  var state = {
    initialized: false,
    editModeActive: false,
    currentScreen: "start",
    currentTool: "select",
    autoOpenPanels: false,
    selectedElementId: null,
    selectedElementIds: [],
    isDirty: false,
    document: null,
    connectedScreen: false,
    editorContext: {
      available: false,
      visible: false,
      selectedSlot: null,
      selectedFilter: null,
      canAccessOnStart: false
    }
  };

  function addCleanup(fn) {
    if (typeof fn === "function") {
      cleanupFns.push(fn);
    }
    return fn;
  }

  function runCleanup() {
    for (var i = cleanupFns.length - 1; i >= 0; i -= 1) {
      try {
        cleanupFns[i]();
      } catch (_ignoreCleanup) {}
    }
    cleanupFns = [];
  }

  function trimString(value) {
    return String(value == null ? "" : value).replace(/^\s+|\s+$/g, "");
  }

  function padBase36(value, size) {
    var text = Math.floor(Math.abs(Number(value) || 0)).toString(36);
    while (text.length < size) {
      text = "0" + text;
    }
    return text;
  }

  function createLayoutId() {
    var now = Date.now ? Date.now() : new Date().getTime();
    return "ly_" + now.toString(36) + padBase36(Math.random() * 1679616, 4) + padBase36(Math.random() * 1679616, 4);
  }

  function normalizeDocumentMeta(doc) {
    if (!doc || typeof doc !== "object") {
      return null;
    }
    var id = trimString(doc.id);
    if (!id) {
      return null;
    }
    doc.id = id;
    doc.name = trimString(doc.name) || "Layout";
    return doc;
  }

  function el(tag, attrs, children) {
    var node = DOC.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        if (key === "className") {
          node.className = attrs[key];
        } else if (key === "dataset") {
          Object.keys(attrs[key]).forEach(function (dk) {
            node.dataset[dk] = attrs[key][dk];
          });
        } else if (key === "style" && typeof attrs[key] === "object") {
          Object.keys(attrs[key]).forEach(function (sk) {
            node.style[sk] = attrs[key][sk];
          });
        } else if (key === "textContent") {
          node.textContent = attrs[key];
        } else {
          node.setAttribute(key, attrs[key]);
        }
      });
    }
    if (children) {
      children.forEach(function (child) {
        if (typeof child === "string") {
          node.appendChild(DOC.createTextNode(child));
        } else if (child) {
          node.appendChild(child);
        }
      });
    }
    return node;
  }

  function qs(selector, root) {
    return (root || DOC).querySelector(selector);
  }

  function qsa(selector, root) {
    return Array.from((root || DOC).querySelectorAll(selector));
  }

  function getRoot() {
    var root = DOC.getElementById("hud-editor-root");
    if (!root) {
      root = el("div", { id: "hud-editor-root" });
      root.style.display = "none";
      (DOC.body || DOC.documentElement).appendChild(root);
    }
    return root;
  }

  function showScreen(name) {
    state.currentScreen = name;
    var root = getRoot();
    qsa(".hud-screen", root).forEach(function (screen) {
      screen.classList.remove("active");
      screen.style.display = "none";
    });
    var target = qs('[data-screen="' + name + '"]', root);
    if (target) {
      target.classList.add("active");
      target.style.display = "";
    }
  }

  function enterEditMode() {
    if (state.editModeActive) {
      showScreen(state.currentScreen);
      return;
    }
    state.editModeActive = true;
    var root = getRoot();
    root.style.display = "block";
    root.style.pointerEvents = "auto";
    showScreen(state.currentScreen);
    emit("enter-edit");
  }

  function exitEditMode() {
    if (!state.editModeActive) {
      return;
    }
    state.editModeActive = false;
    var root = getRoot();
    root.style.display = "none";
    root.style.pointerEvents = "none";
    emit("exit-edit");
  }

  function closeUi(reason) {
    var activeBefore = !!state.editModeActive;
    try {
      emit("close-dialog", reason || "close-ui");
    } catch (_ignoreCloseDialog) {}
    try {
      showScreen("start");
    } catch (_ignoreShowStart) {}
    exitEditMode();
    updateToggleButton();
    return {
      closed: true,
      activeBefore: activeBefore,
      currentScreen: state.currentScreen
    };
  }

  function on(event, fn) {
    if (!listeners[event]) {
      listeners[event] = [];
    }
    listeners[event].push(fn);
  }

  function off(event, fn) {
    if (!listeners[event]) {
      return;
    }
    listeners[event] = listeners[event].filter(function (entry) {
      return entry !== fn;
    });
  }

  function emit(event, data) {
    (listeners[event] || []).forEach(function (fn) {
      try {
        fn(data);
      } catch (_ignoreListener) {}
    });
  }

  function isEscapeEvent(e) {
    if (!e) {
      return false;
    }
    return e.code === "Escape" || e.key === "Escape" || e.key === "Esc" || e.keyCode === 27 || e.which === 27;
  }

  function onKeyDown(e) {
    if (!state.editModeActive) {
      return;
    }

    if (isEscapeEvent(e)) {
      if (state.currentScreen === "start") {
        if (typeof e.stopPropagation === "function") e.stopPropagation();
        exitEditMode();
        updateToggleButton();
        e.preventDefault();
        return;
      }
      state.selectedElementId = null;
      emit("deselect-all");
      return;
    }

    if (e.code === "Delete" && state.selectedElementId) {
      emit("delete-element", state.selectedElementId);
      return;
    }

    var toolMap = {
      KeyV: "select",
      KeyB: "box",
      KeyR: "rounded",
      KeyC: "circle",
      KeyL: "line",
      KeyT: "text",
      KeyA: "bezierArc",
      KeyY: "triangle",
      KeyQ: "quad",
      KeyI: "image"
    };
    if (toolMap[e.code] && !e.ctrlKey && !e.metaKey) {
      state.currentTool = toolMap[e.code];
      emit("tool-changed", state.currentTool);
      return;
    }

    if (e.ctrlKey && e.code === "KeyZ") {
      emit("undo");
      e.preventDefault();
      return;
    }
    if (e.ctrlKey && e.code === "KeyY") {
      emit("redo");
      e.preventDefault();
      return;
    }
    if (e.ctrlKey && e.code === "KeyS") {
      emit("save");
      e.preventDefault();
    }
  }

  function onMouseCapture(e) {
    if (!state.editModeActive) {
      return;
    }
  }

  function updateToggleButton() {
    var button = DOC.getElementById("hud-editor-toggle");
    if (!button) {
      return;
    }
    if (state.editModeActive) {
      button.textContent = "HUD Editor: ON";
      button.style.background = "#0ee9e7";
      button.style.color = "#000";
    } else {
      button.textContent = "HUD Editor: OFF";
      button.style.background = "#333";
      button.style.color = "#fff";
    }
  }

  function getToastContainer() {
    var container = DOC.getElementById("hud-editor-toast-container");
    if (!container) {
      container = DOC.createElement("div");
      container.id = "hud-editor-toast-container";
      container.className = "toast-container";
      (DOC.body || DOC.documentElement).appendChild(container);
    }
    return container;
  }

  function getToastKey(data, text) {
    return String(data.type || "info") + "::" + text;
  }

  function setToastText(meta) {
    if (!meta || !meta.toast) return;
    meta.toast.textContent = meta.count > 1 ? (meta.text + " x" + meta.count) : meta.text;
  }

  function clearToastTimers(meta) {
    if (!meta) return;
    if (meta.fadeTimer) WIN.clearTimeout(meta.fadeTimer);
    if (meta.removeTimer) WIN.clearTimeout(meta.removeTimer);
    meta.fadeTimer = null;
    meta.removeTimer = null;
  }

  function removeToast(meta) {
    if (!meta) return;
    clearToastTimers(meta);
    if (activeToasts[meta.key] === meta) {
      delete activeToasts[meta.key];
    }
    try {
      if (meta.toast && meta.toast.parentNode) {
        meta.toast.parentNode.removeChild(meta.toast);
      }
    } catch (_ignoreToastRemove) {}
  }

  function scheduleToast(meta) {
    clearToastTimers(meta);
    meta.toast.style.opacity = "1";
    meta.toast.style.transform = "translateY(0)";
    meta.fadeTimer = WIN.setTimeout(function () {
      try {
        meta.toast.style.opacity = "0";
        meta.toast.style.transform = "translateY(-6px)";
      } catch (_ignoreToastFade) {}
    }, 1800);

    meta.removeTimer = WIN.setTimeout(function () {
      removeToast(meta);
    }, 2200);
  }

  function showToast(payload) {
    var data = payload && typeof payload === "object" ? payload : { text: String(payload || "") };
    var text = String(data.text || "").trim();
    if (!text) {
      return;
    }

    var key = getToastKey(data, text);
    var existing = activeToasts[key];
    if (existing) {
      existing.count += 1;
      setToastText(existing);
      scheduleToast(existing);
      return;
    }

    var container = getToastContainer();
    var toast = DOC.createElement("div");
    toast.className = "toast " + (data.type || "info");
    var meta = {
      key: key,
      text: text,
      count: 1,
      toast: toast,
      fadeTimer: null,
      removeTimer: null,
    };
    setToastText(meta);
    container.appendChild(toast);
    activeToasts[key] = meta;
    scheduleToast(meta);
  }

  function createToggleButton() {
    var existing = DOC.getElementById("hud-editor-toggle");
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }

    var button = DOC.createElement("button");
    button.id = "hud-editor-toggle";
    button.type = "button";
    button.textContent = "HUD Editor: OFF";
    button.style.cssText = "position:fixed;top:10px;right:16px;display:inline-flex;align-items:center;justify-content:center;min-width:164px;height:40px;background:#333;color:#fff;z-index:2147482400;font:700 14px/1.2 'Segoe UI',Tahoma,sans-serif;padding:8px 16px;border:2px solid #0ee9e7;border-radius:10px;cursor:pointer;white-space:nowrap;box-sizing:border-box;box-shadow:0 8px 24px rgba(0,0,0,0.28);";
    button.addEventListener("click", function () {
      if (state.editModeActive) {
        exitEditMode();
      } else {
        enterEditMode();
      }
      updateToggleButton();
    });
    updateToggleButton();
    (DOC.body || DOC.documentElement).appendChild(button);

    addCleanup(function () {
      try {
        if (button.parentNode) {
          button.parentNode.removeChild(button);
        }
      } catch (_ignoreButtonCleanup) {}
    });
  }

  function init() {
    if (state.initialized) {
      return;
    }
    state.initialized = true;

    DOC.addEventListener("keydown", onKeyDown, true);
    WIN.addEventListener("keydown", onKeyDown, true);
    DOC.addEventListener("mousedown", onMouseCapture, true);
    DOC.addEventListener("mousemove", onMouseCapture, true);
    DOC.addEventListener("mouseup", onMouseCapture, true);
    DOC.addEventListener("click", onMouseCapture, true);

    addCleanup(function () {
      DOC.removeEventListener("keydown", onKeyDown, true);
      WIN.removeEventListener("keydown", onKeyDown, true);
      DOC.removeEventListener("mousedown", onMouseCapture, true);
      DOC.removeEventListener("mousemove", onMouseCapture, true);
      DOC.removeEventListener("mouseup", onMouseCapture, true);
      DOC.removeEventListener("click", onMouseCapture, true);
    });

    if (DOC.body) {
      createToggleButton();
    } else {
      var onReady = function () {
        DOC.removeEventListener("DOMContentLoaded", onReady);
        createToggleButton();
      };
      DOC.addEventListener("DOMContentLoaded", onReady);
      addCleanup(function () {
        DOC.removeEventListener("DOMContentLoaded", onReady);
      });
    }

    on("toast", showToast);

    addCleanup(function () {
      Object.keys(activeToasts).forEach(function (key) {
        removeToast(activeToasts[key]);
      });
      activeToasts = {};
      var container = DOC.getElementById("hud-editor-toast-container");
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
    });
  }

  function destroy(reason) {
    try {
      emit("destroy", reason || "destroy");
    } catch (_ignoreDestroyEmit) {}

    exitEditMode();
    runCleanup();

    var root = DOC.getElementById("hud-editor-root");
    if (root && root.parentNode) {
      root.parentNode.removeChild(root);
    }

    var style = DOC.getElementById("hud-editor-styles");
    if (style && style.parentNode) {
      style.parentNode.removeChild(style);
    }

    listeners = {};
    delete WIN[NS];
  }

  WIN[NS] = {
    state: state,
    getRoot: getRoot,
    el: el,
    qs: qs,
    qsa: qsa,
    trimString: trimString,
    createLayoutId: createLayoutId,
    normalizeDocumentMeta: normalizeDocumentMeta,
    showScreen: showScreen,
    enterEditMode: enterEditMode,
    exitEditMode: exitEditMode,
    closeUi: closeUi,
    updateToggleButton: updateToggleButton,
    on: on,
    off: off,
    emit: emit,
    cleanup: addCleanup,
    init: init,
    destroy: destroy
  };

  init();
})();

// --- 010-start-screen.js ---
// 010-start-screen.js - Start screen UI + logic
(function hudEditorStartScreen() {
  "use strict";

  var NS = "HudEditor";
  var APP = window[NS];
  if (!APP) return;

  var el = APP.el;
  var qs = APP.qs;
  var qsa = APP.qsa;

  // ─── Build start screen DOM ──────────────────────────────────────────

  function buildStartScreen() {
    var container = el("div", {
      className: "hud-screen",
      dataset: { screen: "start" },
      style: { display: "none" },
    }, [
      el("div", { className: "start-container" }, [
        el("div", { className: "start-header" }, [
          el("h1", { textContent: "Lua Painter" }),
          el("p", { className: "subtitle", textContent: "HUD Layout Editor" }),
        ]),
        el("div", { id: "start-editor-context", className: "start-context-card" }, [
          el("div", { className: "start-context-title", textContent: "Lua Editor Connection" }),
          el("div", { className: "start-context-pill is-offline", textContent: "Preview Only" }),
          el("p", {
            className: "start-context-copy",
            textContent: "Open the programming board Lua editor to load from or save to unit.onStart."
          }),
        ]),
        el("div", { className: "start-menu" }, [
          el("button", {
            className: "menu-btn primary",
            dataset: { action: "new" },
          }, [
            el("span", { className: "icon", textContent: "\u270F" }),
            el("div", { className: "label-group" }, [
              el("span", { className: "label", textContent: "New Script" }),
              el("span", { className: "desc", textContent: "Start a fresh layout" }),
            ]),
          ]),
          el("button", {
            className: "menu-btn",
            id: "start-load-btn",
            dataset: { action: "load" },
          }, [
            el("span", { className: "icon", textContent: "\u27A4" }),
            el("div", { className: "label-group" }, [
              el("span", { className: "label", textContent: "Load" }),
              el("span", { className: "desc", textContent: "Open layout from unit.onStart" }),
            ]),
          ]),
          el("button", {
            className: "menu-btn",
            id: "start-saveas-btn",
            dataset: { action: "saveas" },
          }, [
            el("span", { className: "icon", textContent: "\u2714" }),
            el("div", { className: "label-group" }, [
              el("span", { className: "label", textContent: "Save As" }),
              el("span", { className: "desc", textContent: "Save current layout into unit.onStart" }),
            ]),
          ]),
        ]),
      ]),
    ]);
    return container;
  }

  // ─── Action handlers ─────────────────────────────────────────────────

  function onNewScript() {
    var sw = 1920;
    var sh = 1080;
    APP.state.document = APP.normalizeDocumentMeta({
      version: 1,
      revision: 1,
      id: APP.createLayoutId(),
      name: "Layout",
      screenWidth: sw,
      screenHeight: sh,
      elements: [
        {
          id: "main_panel",
          type: "boxRounded",
          x: Math.round(sw * 0.05),
          y: Math.round(sh * 0.05),
          w: Math.round(sw * 0.9),
          h: Math.round(sh * 0.9),
          radius: 20,
          fill: [0.10, 0.11, 0.12, 0.98],
          stroke: [0.70, 0.72, 0.76, 1.00],
          strokeWidth: 3,
          textLines: ["New Layout"],
          textColor: [0.86, 0.88, 0.92, 1.0],
          textSize: 24,
          textAlign: "center",
        },
      ],
    });
    APP.state.isDirty = false;
    APP.showScreen("editor");
    APP.emit("document-created", APP.state.document);
  }

  function onLoad() {
    APP.emit("load-dialog-open");
  }

  function onSaveAs() {
    APP.emit("saveas-dialog-open");
  }

  // ─── Click delegation ────────────────────────────────────────────────

  function onMenuClick(e) {
    var btn = e.target.closest("[data-action]");
    if (!btn) return;
    if (btn.disabled) return;
    var action = btn.dataset.action;
    if (action === "new") onNewScript();
    else if (action === "load") onLoad();
    else if (action === "saveas") onSaveAs();
  }

  function updateEditorContext(status) {
    var root = APP.getRoot();
    var loadBtn = qs("#start-load-btn", root);
    var saveAsBtn = qs("#start-saveas-btn", root);
    var card = qs("#start-editor-context", root);
    var pill = qs(".start-context-pill", card);
    var copy = qs(".start-context-copy", card);
    var canUseBoard = !!(status && status.canAccessOnStart);

    if (loadBtn) loadBtn.disabled = !canUseBoard;
    if (saveAsBtn) saveAsBtn.disabled = !canUseBoard;

    if (!pill || !copy) return;
    pill.className = "start-context-pill " + (canUseBoard ? "is-online" : "is-offline");
    pill.textContent = canUseBoard ? "Board Connected" : "Preview Only";
    copy.textContent = canUseBoard
      ? "Load reads the current programming board unit.onStart filter, and save writes back there."
      : "Open the programming board Lua editor to load from or save to unit.onStart.";
  }

  // ─── Register with core ──────────────────────────────────────────────

  APP.on("enter-edit", function () {
    if (APP.state.currentScreen === "start") {
      APP.showScreen("start");
    }
  });

  APP.on("editor-context", updateEditorContext);

  function mountStartScreen() {
    var root = APP.getRoot();
    if (qs('[data-screen="start"]', root)) return;
    var startScreen = buildStartScreen();
    root.appendChild(startScreen);
    startScreen.addEventListener("click", onMenuClick);
  }

  APP.init = (function (origInit) {
    return function () {
      origInit();
      mountStartScreen();
      updateEditorContext(APP.state.editorContext || null);
    };
  })(APP.init);

  mountStartScreen();
  updateEditorContext(APP.state.editorContext || null);
})();

// --- 020-editor-shell.js ---
// 020-editor-shell.js - Editor HTML structure + navigation
(function hudEditorShell() {
  "use strict";

  var NS = "HudEditor";
  var APP = window[NS];
  if (!APP) return;

  var el = APP.el;
  var qs = APP.qs;
  var qsa = APP.qsa;
  var AUTO_OPEN_PANELS_KEY = "hud_auto_open_panels";

  function loadAutoOpenPanels() {
    try {
      return localStorage.getItem(AUTO_OPEN_PANELS_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  function setAutoOpenPanels(enabled) {
    APP.state.autoOpenPanels = !!enabled;
    try {
      localStorage.setItem(AUTO_OPEN_PANELS_KEY, enabled ? "1" : "");
    } catch (e) { /* ignore */ }
    APP.emit("auto-open-panels-changed", APP.state.autoOpenPanels);
  }

  // ─── Stepper builder ────────────────────────────────────────────────

  var STROKE_PRESETS = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20];
  var RADIUS_PRESETS = [0, 2, 4, 6, 8, 10, 12, 16, 20, 24, 28, 32, 40, 50, 75, 100];
  var SHAPE_TOOL_OPTIONS = [
    { tool: "box", title: "Box", shortcut: "B", glyph: "\u25A1", iconClass: "tb-icon-box tb-icon-glyph tb-icon-glyph-box" },
    { tool: "rounded", title: "Rounded Box", shortcut: "R", glyph: "\u25A2", iconClass: "tb-icon-rounded tb-icon-glyph tb-icon-glyph-rounded" },
    { tool: "circle", title: "Circle", shortcut: "C", glyph: "\u25CB", iconClass: "tb-icon-circle tb-icon-glyph tb-icon-glyph-circle" },
    { tool: "bezierArc", title: "Bezier Arc", shortcut: "A", glyph: "\u2302", iconClass: "tb-icon-line tb-icon-glyph tb-icon-glyph-line" },
    { tool: "triangle", title: "Triangle", shortcut: "Y", glyph: "\u25B3", iconClass: "tb-icon-box tb-icon-glyph tb-icon-glyph-box" },
    { tool: "quad", title: "Quad", shortcut: "Q", glyph: "\u25F0", iconClass: "tb-icon-rounded tb-icon-glyph tb-icon-glyph-rounded" },
    { tool: "image", title: "Image", shortcut: "I", glyph: "\u25C9", iconClass: "tb-icon-circle tb-icon-glyph tb-icon-glyph-circle" },
    { tool: "line", title: "Line", shortcut: "L", glyph: "/", iconClass: "tb-icon-line tb-icon-glyph tb-icon-glyph-line" },
    { tool: "text", title: "Text", shortcut: "T", glyph: "T", iconClass: "tb-icon-text tb-icon-glyph tb-icon-glyph-text" },
  ];
  var SHAPE_TOOL_MAP = {};
  var lastShapeTool = SHAPE_TOOL_OPTIONS[0].tool;

  SHAPE_TOOL_OPTIONS.forEach(function (option) {
    SHAPE_TOOL_MAP[option.tool] = option;
  });

  function buildStepper(prop, presets) {
    var options = presets.map(function (v) {
      return el("option", { value: String(v), textContent: String(v) });
    });
    return el("div", { className: "stepper-ctrl" }, [
      el("button", { className: "stepper-dec", dataset: { stepperProp: prop }, textContent: "\u2212" }),
      el("select", { className: "stepper-select", dataset: { prop: prop } }, options),
      el("button", { className: "stepper-inc", dataset: { stepperProp: prop }, textContent: "+" }),
    ]);
  }

  function buildShapeToolButton(option) {
    return el("button", {
      type: "button",
      className: "tool-btn dropdown-tool-btn",
      dataset: { tool: option.tool },
      title: option.title + " (" + option.shortcut + ")"
    }, [
      el("span", { className: "tb-icon " + option.iconClass, textContent: option.glyph }),
      el("span", { className: "dropdown-tool-copy" }, [
        el("span", { className: "dropdown-tool-title", textContent: option.title }),
        el("span", { className: "dropdown-tool-key", textContent: option.shortcut }),
      ]),
    ]);
  }

  function buildShapeDropdown() {
    var defaultShape = SHAPE_TOOL_OPTIONS[0];
    return el("div", { className: "toolbar-dropdown", id: "shape-tool-dropdown" }, [
      el("button", {
        type: "button",
        className: "action-btn toolbar-dropdown-trigger",
        dataset: { action: "toggle-shape-menu" },
        title: "Shape tools"
      }, [
        el("span", {
          id: "shape-tool-trigger-icon",
          className: "tb-icon " + defaultShape.iconClass,
          textContent: defaultShape.glyph
        }),
        el("span", { className: "toolbar-dropdown-caret", textContent: "\u25BE" }),
      ]),
      el("div", { className: "toolbar-dropdown-menu", id: "shape-tool-menu" },
        SHAPE_TOOL_OPTIONS.map(buildShapeToolButton)
      ),
    ]);
  }

  // ─── Build editor shell DOM ──────────────────────────────────────────

  function buildEditorShell() {
    var container = el("div", {
      className: "hud-screen",
      dataset: { screen: "editor" },
      style: { display: "none" },
    }, [

      // ── Toolbar ──
      el("div", { id: "editor-toolbar" }, [

        // Tool buttons — selection stays visible, shapes live in a compact menu
        el("div", { className: "toolbar-group" }, [
          el("button", { className: "tool-btn active", dataset: { tool: "select" }, title: "Select (V)" }, [
            el("span", { className: "tb-icon tb-icon-select tb-icon-glyph tb-icon-glyph-select", textContent: "\u2196" }),
            el("span", { className: "tb-key", textContent: "V" }),
          ]),
          buildShapeDropdown(),
        ]),

        el("div", { className: "toolbar-divider" }),

        // Color swatches
        el("div", { className: "toolbar-group colors" }, [
          el("div", { className: "swatch-pair" }, [
            el("span", { className: "swatch-label", textContent: "Fill" }),
            el("button", {
              type: "button",
              className: "color-swatch-btn",
              title: "Fill color",
              dataset: { colorProp: "fill", colorHex: "#3366FF" },
            }, [
              el("span", { className: "color-swatch-chip" }),
            ]),
          ]),
          el("div", { className: "swatch-pair" }, [
            el("span", { className: "swatch-label", textContent: "Stroke" }),
            el("button", {
              type: "button",
              className: "color-swatch-btn",
              title: "Stroke color",
              dataset: { colorProp: "stroke", colorHex: "#FFFFFF" },
            }, [
              el("span", { className: "color-swatch-chip" }),
            ]),
          ]),
        ]),

        el("div", { className: "toolbar-divider" }),

        // Grouping
        el("div", { className: "toolbar-group actions" }, [
          el("button", { className: "action-btn", dataset: { action: "group" }, title: "Group (Ctrl+G)" }, [
            el("span", { className: "tb-icon tb-icon-group" }),
          ]),
          el("button", { className: "action-btn", dataset: { action: "ungroup" }, title: "Ungroup (Ctrl+Shift+G)" }, [
            el("span", { className: "tb-icon tb-icon-ungroup" }),
          ]),
        ]),

        el("div", { className: "toolbar-divider" }),

        // Clone
        el("div", { className: "toolbar-group actions" }, [
          el("button", { className: "action-btn", dataset: { action: "clone" }, title: "Clone (Ctrl+D)" }, [
            el("span", { className: "tb-icon tb-icon-clone" }),
          ]),
        ]),

        el("div", { className: "toolbar-divider" }),

        // Alignment
        el("div", { className: "toolbar-group align-group" }, [
          el("button", { className: "action-btn", dataset: { action: "align-left" }, title: "Align left" }, [
            el("span", { className: "tb-icon tb-icon-align-left" }),
          ]),
          el("button", { className: "action-btn", dataset: { action: "align-center-h" }, title: "Align center horizontal" }, [
            el("span", { className: "tb-icon tb-icon-align-center-h" }),
          ]),
          el("button", { className: "action-btn", dataset: { action: "align-right" }, title: "Align right" }, [
            el("span", { className: "tb-icon tb-icon-align-right" }),
          ]),
          el("button", { className: "action-btn", dataset: { action: "align-top" }, title: "Align top" }, [
            el("span", { className: "tb-icon tb-icon-align-top" }),
          ]),
          el("button", { className: "action-btn", dataset: { action: "align-center-v" }, title: "Align center vertical" }, [
            el("span", { className: "tb-icon tb-icon-align-center-v" }),
          ]),
          el("button", { className: "action-btn", dataset: { action: "align-bottom" }, title: "Align bottom" }, [
            el("span", { className: "tb-icon tb-icon-align-bottom" }),
          ]),
        ]),

        el("div", { className: "toolbar-divider" }),

        el("label", { className: "toolbar-check", title: "Auto-open collapsed panels on hover" }, [
          el("input", {
            type: "checkbox",
            className: "toolbar-check-input",
            id: "auto-open-panels-toggle",
          }),
          el("span", { className: "toolbar-check-box" }),
          el("span", { className: "toolbar-check-label", textContent: "Auto Panels" }),
        ]),

        el("div", { className: "toolbar-spacer" }),

        // Undo/Redo
        el("div", { className: "toolbar-group actions" }, [
          el("button", { className: "action-btn", dataset: { action: "undo" }, title: "Undo (Ctrl+Z)" }, [
            el("span", { className: "tb-icon", textContent: "\u21A9" }),
          ]),
          el("button", { className: "action-btn", dataset: { action: "redo" }, title: "Redo (Ctrl+Y)" }, [
            el("span", { className: "tb-icon", textContent: "\u21AA" }),
          ]),
        ]),
      ]),

      // ── Canvas area ──
      el("div", { id: "canvas-container" }, [
        el("div", { id: "canvas-preview" }),
      ]),

      // ── Properties panel ──
      el("div", { id: "properties-panel", className: "docked-panel" }, [
        el("div", { className: "panel-header" }, [
          el("span", { textContent: "Properties" }),
          el("button", { className: "panel-toggle", dataset: { action: "toggle-collapse" }, textContent: "\u25BE" }),
        ]),
        el("div", { className: "panel-content" }, [
          el("div", { className: "prop-row" }, [
            el("label", { textContent: "X" }),
            el("input", { type: "number", className: "prop-input", dataset: { prop: "x" } }),
            el("label", { textContent: "Y" }),
            el("input", { type: "number", className: "prop-input", dataset: { prop: "y" } }),
          ]),
          el("div", { className: "prop-row" }, [
            el("label", { textContent: "W" }),
            el("input", { type: "number", className: "prop-input", dataset: { prop: "w" } }),
            el("label", { textContent: "H" }),
            el("input", { type: "number", className: "prop-input", dataset: { prop: "h" } }),
          ]),
          el("div", { className: "prop-row" }, [
            el("label", { textContent: "Fill" }),
            el("button", {
              type: "button",
              className: "prop-color-btn",
              title: "Fill color",
              dataset: { colorProp: "fill", colorHex: "#3366FF" }
            }, [
              el("span", { className: "prop-color-chip" }),
            ]),
          ]),
          el("div", { className: "prop-row" }, [
            el("label", { textContent: "Stroke" }),
            el("button", {
              type: "button",
              className: "prop-color-btn",
              title: "Stroke color",
              dataset: { colorProp: "stroke", colorHex: "#FFFFFF" }
            }, [
              el("span", { className: "prop-color-chip" }),
            ]),
          ]),
          el("div", { className: "prop-row" }, [
            el("label", { textContent: "Stroke W" }),
            buildStepper("strokeWidth", STROKE_PRESETS),
          ]),
          el("div", { className: "prop-row", dataset: { propRow: "radius" } }, [
            el("label", { textContent: "Radius" }),
            buildStepper("radius", RADIUS_PRESETS),
          ]),
          el("div", { className: "prop-row", dataset: { propRow: "rotation" } }, [
            el("label", { textContent: "Rot (rad)" }),
            el("input", { type: "number", step: "0.01", className: "prop-input", dataset: { prop: "rotation" } }),
          ]),
          el("div", { className: "prop-row", dataset: { propRow: "shadowBlur" } }, [
            el("label", { textContent: "Glow" }),
            el("input", { type: "number", step: "1", min: "0", className: "prop-input", dataset: { prop: "shadowBlur" } }),
          ]),
          el("div", { className: "prop-row", dataset: { propRow: "shadowColor" } }, [
            el("label", { textContent: "Glow Col" }),
            el("button", {
              type: "button",
              className: "prop-color-btn",
              title: "Glow color",
              dataset: { colorProp: "shadowColor", colorHex: "#000000" }
            }, [
              el("span", { className: "prop-color-chip" }),
            ]),
          ]),
          el("div", { className: "prop-row", dataset: { propRow: "textColor" } }, [
            el("label", { textContent: "Text Col" }),
            el("button", {
              type: "button",
              className: "prop-color-btn",
              title: "Text color",
              dataset: { colorProp: "textColor", colorHex: "#FFFFFF" }
            }, [
              el("span", { className: "prop-color-chip" }),
            ]),
          ]),
          el("div", { className: "prop-row", dataset: { propRow: "textSize" } }, [
            el("label", { textContent: "Text Size" }),
            el("input", { type: "number", step: "1", min: "1", className: "prop-input", dataset: { prop: "textSize" } }),
          ]),
          el("div", { className: "prop-row", dataset: { propRow: "textAlign" } }, [
            el("label", { textContent: "Text Align" }),
            el("select", { className: "prop-input", dataset: { prop: "textAlign" } }, [
              el("option", { value: "left", textContent: "Left" }),
              el("option", { value: "center", textContent: "Center" }),
              el("option", { value: "right", textContent: "Right" }),
            ]),
          ]),
          el("div", { className: "prop-row vertical", dataset: { propRow: "textLines" } }, [
            el("label", { textContent: "Text" }),
            el("textarea", { className: "prop-textarea", rows: "3", dataset: { prop: "textLines" } }),
          ]),
          el("div", { className: "prop-row vertical", dataset: { propRow: "imageSrc" } }, [
            el("label", { textContent: "Image Path" }),
            el("input", { type: "text", className: "prop-input", dataset: { prop: "imageSrc" } }),
          ]),
          el("div", { className: "prop-row" }, [
            el("button", {
              className: "prop-delete",
              dataset: { action: "delete-element" },
              textContent: "Delete Element",
            }),
          ]),
        ]),
      ]),

      // ── Status bar ──
      el("div", { id: "editor-statusbar" }, [
        el("div", { className: "statusbar-left" }, [
          el("button", {
            className: "status-btn primary",
            dataset: { action: "save" },
            textContent: "Apply + Close HUD",
          }),
        ]),
        el("div", { className: "statusbar-center" }, [
          el("span", { id: "editor-context-pill", className: "editor-context-pill is-offline", textContent: "Preview Only" }),
          el("span", {
            id: "editor-status-hint",
            className: "status-hint",
            textContent: "Open the programming board Lua editor to load or save"
          }),
        ]),
        el("div", { className: "statusbar-right" }, [
          el("button", {
            className: "status-btn",
            dataset: { action: "export-board" },
            textContent: "Export Board",
          }),
          el("button", {
            className: "status-btn",
            dataset: { action: "export-screen" },
            textContent: "Export Screen",
          }),
          el("button", {
            className: "status-btn danger",
            dataset: { action: "close" },
            textContent: "Close",
          }),
        ]),
      ]),
    ]);

    return container;
  }

  // ─── Toolbar click delegation ────────────────────────────────────────

  function onToolbarClick(e) {
    var dropdownBtn = e.target.closest('[data-action="toggle-shape-menu"]');
    if (dropdownBtn) {
      toggleShapeMenu();
      return;
    }

    var btn = e.target.closest("[data-tool]");
    if (btn) {
      APP.state.currentTool = btn.dataset.tool;
      updateToolButtons(APP.state.currentTool);
      closeShapeMenu();
      APP.emit("tool-changed", APP.state.currentTool);
      return;
    }

    var actionBtn = e.target.closest("[data-action]");
    if (!actionBtn) return;

    var action = actionBtn.dataset.action;
    closeShapeMenu();
    if (action === "undo") APP.emit("undo");
    else if (action === "redo") APP.emit("redo");
    else if (action === "save") APP.emit("save");
    else if (action === "export-board") APP.emit("export-board");
    else if (action === "export-screen") APP.emit("export-screen");
    else if (action === "close") APP.emit("close-editor");
    else if (action === "delete-element" && APP.state.selectedElementId) {
      APP.emit("delete-element", APP.state.selectedElementId);
    }
    else if (action.indexOf("align-") === 0) {
      APP.emit("align", action.replace("align-", ""));
    }
    else if (action === "group") {
      APP.emit("group-selection");
    }
    else if (action === "ungroup") {
      APP.emit("ungroup-selection");
    }
    else if (action === "clone") {
      APP.emit("clone-selection");
    }
    else if (action === "toggle-collapse") {
      APP.emit("toggle-props-collapse");
    }
  }

  function isShapeTool(tool) {
    return !!SHAPE_TOOL_MAP[tool];
  }

  function getShapeDropdown(root) {
    return qs("#shape-tool-dropdown", root || APP.getRoot());
  }

  function openShapeMenu() {
    var dropdown = getShapeDropdown();
    var trigger;
    if (!dropdown) return;
    trigger = qs(".toolbar-dropdown-trigger", dropdown);
    dropdown.classList.add("open");
    if (trigger) trigger.setAttribute("aria-expanded", "true");
  }

  function closeShapeMenu() {
    var dropdown = getShapeDropdown();
    var trigger;
    if (!dropdown) return;
    trigger = qs(".toolbar-dropdown-trigger", dropdown);
    dropdown.classList.remove("open");
    if (trigger) trigger.setAttribute("aria-expanded", "false");
  }

  function toggleShapeMenu() {
    var dropdown = getShapeDropdown();
    if (!dropdown) return;
    if (dropdown.classList.contains("open")) {
      closeShapeMenu();
    } else {
      openShapeMenu();
    }
  }

  function updateShapeDropdown(activeTool) {
    var dropdown = getShapeDropdown();
    var trigger;
    var icon;
    var option;
    if (!dropdown) return;

    if (isShapeTool(activeTool)) lastShapeTool = activeTool;
    option = SHAPE_TOOL_MAP[lastShapeTool] || SHAPE_TOOL_OPTIONS[0];
    trigger = qs(".toolbar-dropdown-trigger", dropdown);
    icon = qs("#shape-tool-trigger-icon", dropdown);

    if (icon) {
      icon.className = "tb-icon " + option.iconClass;
      icon.textContent = option.glyph;
    }
    if (trigger) {
      trigger.title = "Shape tools (" + option.title + " ready, " + option.shortcut + ")";
      trigger.classList.toggle("active", isShapeTool(activeTool));
    }
  }

  // ─── Navigation ──────────────────────────────────────────────────────

  function goToStart() {
    APP.showScreen("start");
  }

  function goToEditor() {
    APP.showScreen("editor");
    setTimeout(function () {
      APP.emit("resize");
    }, 0);
    requestAnimationFrame(function () {
      APP.emit("resize");
    });
  }

  function updateToolButtons(activeTool) {
    var root = APP.getRoot();
    qsa("#editor-toolbar .tool-btn", root).forEach(function (button) {
      if (button.dataset.tool === activeTool) {
        button.classList.add("active");
      } else {
        button.classList.remove("active");
      }
    });
    updateShapeDropdown(activeTool);
  }

  function syncToolbarSettings() {
    var root = APP.getRoot();
    var input = qs("#auto-open-panels-toggle", root);
    if (input) input.checked = !!APP.state.autoOpenPanels;
  }

  function updateEditorContext(status) {
    var root = APP.getRoot();
    var saveBtn = qs('[data-action="save"]', root);
    var pill = qs("#editor-context-pill", root);
    var hint = qs("#editor-status-hint", root);
    var canUseBoard = !!(status && status.canAccessOnStart);

    if (saveBtn) {
      saveBtn.textContent = canUseBoard ? "Apply + Close HUD" : "Save";
      saveBtn.title = canUseBoard
        ? "Write to unit.onStart and close the HUD editor after apply"
        : "Save current layout";
    }

    if (saveBtn) saveBtn.disabled = !canUseBoard;

    if (pill) {
      pill.className = "editor-context-pill " + (canUseBoard ? "is-online" : "is-offline");
      pill.textContent = canUseBoard ? "Board Connected" : "Preview Only";
    }
    if (hint) {
      hint.textContent = canUseBoard
        ? "Save writes directly to the current programming board unit.onStart"
        : "Open the programming board Lua editor to load or save";
    }
  }

  function attachToolbarSettingListeners() {
    var root = APP.getRoot();
    var toolbar = qs("#editor-toolbar", root);
    if (!toolbar || toolbar.__hudSettingsBound) return;
    toolbar.__hudSettingsBound = true;

    toolbar.addEventListener("change", function (e) {
      var input = e.target;
      if (!input || input.id !== "auto-open-panels-toggle") return;
      setAutoOpenPanels(!!input.checked);
    });
  }

  function attachShapeDropdownListeners() {
    if (document.__hudShapeDropdownBound) return;
    document.__hudShapeDropdownBound = true;

    document.addEventListener("mousedown", function (e) {
      var dropdown = getShapeDropdown();
      if (!dropdown || !dropdown.classList.contains("open")) return;
      if (dropdown.contains(e.target)) return;
      closeShapeMenu();
    }, true);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" || e.code === "Escape") {
        closeShapeMenu();
      }
    }, true);
  }

  // ─── Register with core ──────────────────────────────────────────────

  APP.on("document-created", function () {
    goToEditor();
  });

  APP.on("tool-changed", function (tool) {
    closeShapeMenu();
    updateToolButtons(tool || APP.state.currentTool);
  });

  APP.on("auto-open-panels-changed", function () {
    syncToolbarSettings();
  });

  APP.on("editor-context", updateEditorContext);

  function mountEditorShell() {
    var root = APP.getRoot();
    if (qs('[data-screen="editor"]', root)) return;
    var editorShell = buildEditorShell();
    root.appendChild(editorShell);

    var toolbar = qs("#editor-toolbar", root);
    if (toolbar) toolbar.addEventListener("click", onToolbarClick);
    attachToolbarSettingListeners();
    attachShapeDropdownListeners();
    APP.state.autoOpenPanels = loadAutoOpenPanels();
    syncToolbarSettings();
    updateEditorContext(APP.state.editorContext || null);

    var statusbar = qs("#editor-statusbar", root);
    if (statusbar) statusbar.addEventListener("click", onToolbarClick);

    var propsPanel = qs("#properties-panel", root);
    if (propsPanel) propsPanel.addEventListener("click", onToolbarClick);
  }

  APP.init = (function (origInit) {
    return function () {
      origInit();
      mountEditorShell();
      updateEditorContext(APP.state.editorContext || null);
    };
  })(APP.init);

  mountEditorShell();

  // Expose
  APP.goToStart = goToStart;
  APP.goToEditor = goToEditor;
  APP.updateToolButtons = updateToolButtons;
  APP.closeShapeMenu = closeShapeMenu;
})();

// --- 030-canvas-renderer.js ---
// 030-canvas-renderer.js - DOM-based element rendering for WYSIWYG preview
(function hudEditorCanvasRenderer() {
  "use strict";

  var NS = "HudEditor";
  var APP = window[NS];
  if (!APP) return;

  var el = APP.el;
  var qs = APP.qs;
  var qsa = APP.qsa;

  // ─── Config ──────────────────────────────────────────────────────────

  var CANVAS_PADDING = 32;  // px padding around preview
  var DEFAULT_SCREEN_W = 1920;
  var DEFAULT_SCREEN_H = 1080;

  // ─── State ──────────────────────────────────────────────────────────

  var scale = 1;
  var canvasW = DEFAULT_SCREEN_W;
  var canvasH = DEFAULT_SCREEN_H;
  var renderPending = false;

  // ─── Coordinate conversion ──────────────────────────────────────────

  function screenToCanvas(sx, sy) {
    return {
      x: Math.round(sx * scale),
      y: Math.round(sy * scale),
    };
  }

  function canvasToScreen(cx, cy) {
    return {
      x: Math.round(cx / scale),
      y: Math.round(cy / scale),
    };
  }

  // ─── Color helpers ─────────────────────────────────────────────────

  function rgbaToCss(rgba) {
    if (!rgba || rgba.length < 4) return "transparent";
    var r = Math.round((rgba[0] || 0) * 255);
    var g = Math.round((rgba[1] || 0) * 255);
    var b = Math.round((rgba[2] || 0) * 255);
    var a = rgba[3] !== undefined ? rgba[3] : 1;
    if (a >= 1) {
      return "rgb(" + r + "," + g + "," + b + ")";
    }
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
  }

  function hasVisibleColor(rgba) {
    return Array.isArray(rgba) && (Number(rgba[3]) || 0) > 0;
  }

  function cssToRgba(css) {
    // Parse #RRGGBB or #RGB
    var hex = css.replace("#", "");
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length !== 6) return [0, 0, 0, 1];
    var r = parseInt(hex.substr(0, 2), 16) / 255;
    var g = parseInt(hex.substr(2, 2), 16) / 255;
    var b = parseInt(hex.substr(4, 2), 16) / 255;
    return [r, g, b, 1];
  }

  // ─── Element DOM creation ───────────────────────────────────────────

  function createElementDom(element) {
    var dom = el("div", {
      className: "canvas-element",
      dataset: { elementId: element.id, elementType: element.type },
    });

    applyElementStyles(dom, element);
    return dom;
  }

  function createSvgElement(tagName) {
    return document.createElementNS("http://www.w3.org/2000/svg", tagName);
  }

  function setShadowStyle(node, blur, color) {
    if (!node || !hasVisibleColor(color) || !(blur > 0)) {
      if (node) node.style.filter = "";
      return;
    }
    node.style.filter = "drop-shadow(0 0 " + Math.max(1, blur) + "px " + rgbaToCss(color) + ")";
  }

  function createCommandLayer(command, originX, originY) {
    var layer = el("div", { className: "canvas-command" });
    layer.style.position = "absolute";
    layer.style.left = Math.round((Number(command.x) - originX) * scale) + "px";
    layer.style.top = Math.round((Number(command.y) - originY) * scale) + "px";
    layer.style.width = Math.max(1, Math.round((Number(command.w) || 0) * scale)) + "px";
    layer.style.height = Math.max(1, Math.round((Number(command.h) || 0) * scale)) + "px";
    layer.style.transformOrigin = "center center";
    layer.style.pointerEvents = "none";
    layer.style.overflow = "visible";
    if (command.o !== "text" && (Number(command.rot) || 0)) {
      layer.style.transform = "rotate(" + (Number(command.rot) || 0) + "rad)";
    }
    return layer;
  }

  function createSvgCommandNode(command, draw) {
    var width = Math.max(1, (Number(command.w) || 0) * scale);
    var height = Math.max(1, (Number(command.h) || 0) * scale);
    var svg = createSvgElement("svg");
    svg.setAttribute("viewBox", "0 0 " + width + " " + height);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.style.width = "100%";
    svg.style.height = "100%";
    svg.style.overflow = "visible";
    svg.style.pointerEvents = "none";
    draw(svg, width, height);
    setShadowStyle(svg, Math.max(0, (command.sh && Number(command.sh.b) || 0) * scale), command.sh && command.sh.c);
    return svg;
  }

  function appendShapeNode(layer, command) {
    var fill = hasVisibleColor(command.f) ? rgbaToCss(command.f) : "transparent";
    var stroke = hasVisibleColor(command.s) ? rgbaToCss(command.s) : "transparent";
    var strokeWidth = Math.max(0, (Number(command.sw) || 0) * scale);
    var kind = String(command.k || "box");
    var svg = createSvgCommandNode(command, function (svg, width, height) {
      var shape;
      if (kind === "circle") {
        shape = createSvgElement("circle");
        shape.setAttribute("cx", String(width * 0.5));
        shape.setAttribute("cy", String(height * 0.5));
        shape.setAttribute("r", String(Math.min(width, height) * 0.5));
      } else {
        shape = kind === "box" || kind === "boxRounded" ? createSvgElement("rect") : createSvgElement("polygon");
        if (kind === "box" || kind === "boxRounded") {
          shape.setAttribute("x", "0");
          shape.setAttribute("y", "0");
          shape.setAttribute("width", String(width));
          shape.setAttribute("height", String(height));
          if (kind === "boxRounded") {
            var radius = Math.max(0, (Number(command.r) || 0) * scale);
            shape.setAttribute("rx", String(radius));
            shape.setAttribute("ry", String(radius));
          }
        } else if (kind === "triangle") {
          shape.setAttribute("points", "0,0 " + width + ",0 0," + height);
        } else {
          var inset = Math.max(0, Math.min(0.45, Number(command.qi) || 0.125));
          shape.setAttribute("points", [
            "0,0",
            (width * (1 - inset)) + "," + (height * inset),
            width + "," + height,
            (width * inset) + "," + (height * (1 - inset))
          ].join(" "));
        }
      }
      shape.setAttribute("fill", fill);
      shape.setAttribute("stroke", stroke);
      shape.setAttribute("stroke-width", String(strokeWidth));
      shape.setAttribute("vector-effect", "non-scaling-stroke");
      svg.appendChild(shape);
    });
    layer.appendChild(svg);
  }

  function appendBezierNode(layer, command) {
    var stroke = hasVisibleColor(command.s) ? rgbaToCss(command.s) : "transparent";
    var strokeWidth = Math.max(1, (Number(command.sw) || 2) * scale);
    var svg = createSvgCommandNode(command, function (svg, width, height) {
      var path = createSvgElement("path");
      path.setAttribute("d", "M 0 " + height + " Q " + (width * 0.5) + " 0 " + width + " " + height);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", stroke);
      path.setAttribute("stroke-width", String(strokeWidth));
      path.setAttribute("vector-effect", "non-scaling-stroke");
      path.setAttribute("stroke-linecap", "round");
      svg.appendChild(path);
    });
    layer.appendChild(svg);
  }

  function appendLineNode(layer, command) {
    var stroke = hasVisibleColor(command.s) ? rgbaToCss(command.s) : "transparent";
    var strokeWidth = Math.max(1, (Number(command.sw) || 2) * scale);
    var svg = createSvgCommandNode(command, function (svg, width, height) {
      var line = createSvgElement("line");
      line.setAttribute("x1", "0");
      line.setAttribute("y1", "0");
      line.setAttribute("x2", String(width));
      line.setAttribute("y2", String(height));
      line.setAttribute("stroke", stroke);
      line.setAttribute("stroke-width", String(strokeWidth));
      line.setAttribute("vector-effect", "non-scaling-stroke");
      line.setAttribute("stroke-linecap", "round");
      svg.appendChild(line);
    });
    layer.appendChild(svg);
  }

  function appendTextNode(layer, command) {
    var wrapper = el("div", { className: "canvas-text-node" });
    var lines = Array.isArray(command.l) ? command.l : [];
    var fontSize = Math.max(1, Math.floor((Number(command.ts) || 16) * scale + 0.5));
    var strokeWidth = Math.max(0, (Number(command.sw) || 0) * scale);
    wrapper.style.position = "absolute";
    wrapper.style.inset = "0";
    wrapper.style.display = "flex";
    wrapper.style.flexDirection = "column";
    wrapper.style.justifyContent = "center";
    wrapper.style.alignItems = command.ta === "center" ? "center" : (command.ta === "right" ? "flex-end" : "flex-start");
    wrapper.style.padding = "0 " + Math.round(12 * scale) + "px";
    wrapper.style.gap = Math.max(2, Math.floor(fontSize * 0.2)) + "px";
    wrapper.style.color = rgbaToCss(command.tc || [1, 1, 1, 1]);
    wrapper.style.fontSize = fontSize + "px";
    wrapper.style.fontFamily = "Play, Rajdhani, Segoe UI, sans-serif";
    wrapper.style.lineHeight = "1";
    wrapper.style.textAlign = command.ta || "left";
    wrapper.style.whiteSpace = "pre";
    wrapper.style.pointerEvents = "none";
    if (strokeWidth > 0 && hasVisibleColor(command.s)) {
      wrapper.style.webkitTextStroke = strokeWidth + "px " + rgbaToCss(command.s);
    }
    if (hasVisibleColor(command.sh && command.sh.c) && (Number(command.sh && command.sh.b) || 0) > 0) {
      wrapper.style.textShadow = "0 0 " + Math.max(1, (Number(command.sh.b) || 0) * scale) + "px " + rgbaToCss(command.sh.c);
    }
    wrapper.textContent = lines.join("\n");
    layer.appendChild(wrapper);
  }

  function appendImageNode(layer, command) {
    var image = document.createElement("img");
    image.alt = "preview-image";
    image.src = command.src || "";
    image.style.width = "100%";
    image.style.height = "100%";
    image.style.objectFit = command.fit || "contain";
    image.style.display = "block";
    image.style.pointerEvents = "none";
    setShadowStyle(image, Math.max(0, (command.sh && Number(command.sh.b) || 0) * scale), command.sh && command.sh.c);
    image.addEventListener("error", function () {
      layer.style.backgroundImage = "radial-gradient(circle at 35% 35%, rgba(255,255,255,0.85), rgba(156,156,156,0.75) 35%, rgba(64,64,64,0.95) 70%)";
      layer.style.backgroundSize = "cover";
      layer.style.backgroundRepeat = "no-repeat";
      layer.style.backgroundPosition = "center";
    }, { once: true });
    layer.appendChild(image);
  }

  function buildPreviewCommands(element) {
    if (APP.screenCommands && typeof APP.screenCommands.buildCommandsForElement === "function") {
      return APP.screenCommands.buildCommandsForElement(element);
    }
    return [];
  }

  function appendCommandNode(dom, element, command) {
    var layer = createCommandLayer(command, Number(element.x) || 0, Number(element.y) || 0);
    switch (command.o) {
      case "shape":
        appendShapeNode(layer, command);
        break;
      case "bezier":
        appendBezierNode(layer, command);
        break;
      case "line":
        appendLineNode(layer, command);
        break;
      case "text":
        appendTextNode(layer, command);
        break;
      case "image":
        appendImageNode(layer, command);
        break;
      default:
        return;
    }
    dom.appendChild(layer);
  }

  function applyElementStyles(dom, element) {
    var pos = screenToCanvas(element.x, element.y);
    var size = screenToCanvas(element.w, element.h);

    dom.innerHTML = "";
    dom.dataset.elementType = element.type;
    dom.style.left = pos.x + "px";
    dom.style.top = pos.y + "px";
    dom.style.width = size.x + "px";
    dom.style.height = size.y + "px";
    dom.style.transform = "";
    dom.style.transformOrigin = "";
    dom.style.filter = "";
    dom.style.background = "transparent";
    dom.style.backgroundColor = "transparent";
    dom.style.backgroundImage = "none";
    dom.style.backgroundSize = "";
    dom.style.backgroundRepeat = "";
    dom.style.backgroundPosition = "";
    dom.style.border = "none";
    dom.style.borderRadius = "0";
    dom.style.boxSizing = "border-box";
    dom.style.display = "block";
    dom.style.alignItems = "";
    dom.style.justifyContent = "";
    dom.style.padding = "";
    dom.style.overflow = "visible";
    dom.style.color = "";
    dom.style.fontSize = "";
    dom.style.fontFamily = "";
    dom.style.textAlign = "";
    dom.style.whiteSpace = "";
    dom.style.wordBreak = "";
    dom.style.webkitTextStroke = "";
    dom.style.textShadow = "";
    buildPreviewCommands(element).forEach(function (command) {
      appendCommandNode(dom, element, command);
    });

    // Hide element when visibility is off; restore when toggled back
    if (element.visible === false) {
      dom.style.display = "none";
    } else if (dom.style.display === "none") {
      dom.style.display = "";
    }
  }

  // ─── Selection overlay ─────────────────────────────────────────────

  function createSelectionOverlay(element, showHandles) {
    var overlay = el("div", {
      className: "selection-overlay",
      dataset: { elementId: element.id + "_sel" },
    });

    // Outline
    var outline = el("div", { className: "selection-outline" });
    overlay.appendChild(outline);

    // 8 resize handles — only for focus element
    if (showHandles !== false) {
      var handles = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
      handles.forEach(function (h) {
        var handle = el("div", {
          className: "resize-handle",
          dataset: { h: h, elementId: element.id },
        });
        overlay.appendChild(handle);
      });
    }

    // Size/position the overlay
    var pos = screenToCanvas(element.x, element.y);
    var size = screenToCanvas(element.w, element.h);

    overlay.style.position = "absolute";
    overlay.style.left = (pos.x - 2) + "px";
    overlay.style.top = (pos.y - 2) + "px";
    overlay.style.width = (size.x + 4) + "px";
    overlay.style.height = (size.y + 4) + "px";
    overlay.style.pointerEvents = "none";
    outline.style.position = "absolute";
    outline.style.inset = "0";
    outline.style.border = "2px solid rgba(14, 233, 231, 0.9)";

    return overlay;
  }

  // ─── Render selection / group overlays ──────────────────────────────

  function computeMultiSelectBounds(selIds) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var i = 0; i < selIds.length; i++) {
      var el = findElementById(selIds[i]);
      if (!el) continue;
      if (el.x < minX) minX = el.x;
      if (el.y < minY) minY = el.y;
      if (el.x + el.w > maxX) maxX = el.x + el.w;
      if (el.y + el.h > maxY) maxY = el.y + el.h;
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  function createGroupOverlay(bounds, isGroup, showHandles) {
    var overlay = el("div", {
      className: "group-overlay",
      dataset: { groupId: isGroup ? "group_sel" : "multi_sel" },
    });

    // Orange outline — non-interactive
    var outline = el("div", { className: "group-outline" });
    outline.style.position = "absolute";
    outline.style.inset = "0";
    outline.style.pointerEvents = "none";
    overlay.appendChild(outline);

    if (showHandles !== false) {
      // 8 resize handles — interactive, on top
      var handles = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
      handles.forEach(function (h) {
        var handle = el("div", {
          className: "group-handle",
          dataset: { h: h },
        });
        overlay.appendChild(handle);
      });
    }

    // Size/position the overlay
    var pos = screenToCanvas(bounds.x, bounds.y);
    var size = screenToCanvas(bounds.w, bounds.h);

    overlay.style.position = "absolute";
    overlay.style.left = (pos.x - 2) + "px";
    overlay.style.top = (pos.y - 2) + "px";
    overlay.style.width = (size.x + 4) + "px";
    overlay.style.height = (size.y + 4) + "px";
    overlay.style.pointerEvents = "none";

    return overlay;
  }

  function clearSelectionOverlays() {
    var preview = getCanvasPreview();
    if (!preview) return;
    qsa('.selection-overlay', preview).forEach(function (node) {
      if (node && node.parentNode) {
        node.parentNode.removeChild(node);
      }
    });
    qsa('.group-overlay', preview).forEach(function (node) {
      if (node && node.parentNode) {
        node.parentNode.removeChild(node);
      }
    });
  }

  function renderSelectionOverlays() {
    var preview = getCanvasPreview();
    if (!preview) return;
    clearSelectionOverlays();

    var selIds = APP.state.selectedElementIds || [];
    var sel = APP.selection;
    var isGrouped = sel && sel.hasGroup && sel.hasGroup();
    var isGroupSelected = sel && sel.isGroupSelected && sel.isGroupSelected();
    var isMultiSelect = selIds.length >= 2;

    if (isGrouped) {
      var groupBounds = sel.getGroupBounds();
      if (groupBounds && groupBounds.w > 0 && groupBounds.h > 0) {
        preview.appendChild(createGroupOverlay(groupBounds, true, isGroupSelected));
      }
    }

    if (isMultiSelect) {
      var multiBounds = computeMultiSelectBounds(selIds);
      if (multiBounds && multiBounds.w > 0 && multiBounds.h > 0) {
        preview.appendChild(createGroupOverlay(multiBounds, false, true));
      }
      return;
    }

    if (selIds.length === 1) {
      var selEl = findElementById(selIds[0]);
      if (selEl) {
        var overlay = createSelectionOverlay(selEl, true);
        preview.appendChild(overlay);
      }
    }
  }

  // ─── Render all elements ────────────────────────────────────────────

  function getCanvasPreview() {
    return qs("#canvas-preview");
  }

  function clearCanvas() {
    var preview = getCanvasPreview();
    if (!preview) return;
    // Remove all child elements but keep structure
    while (preview.firstChild) {
      preview.removeChild(preview.firstChild);
    }
  }

  function renderDocument() {
    var doc = APP.state.document;
    if (!doc) return;

    var preview = getCanvasPreview();
    if (!preview) return;

    clearCanvas();

    // Update canvas size from document
    canvasW = doc.screenWidth || DEFAULT_SCREEN_W;
    canvasH = doc.screenHeight || DEFAULT_SCREEN_H;

    // Size the preview container
    sizeCanvasPreview();

    // Render each element
    var elements = doc.elements || [];
    elements.forEach(function (element) {
      var dom = createElementDom(element);
      preview.appendChild(dom);
    });

    // Render selection / group overlays
    renderSelectionOverlays();

    renderPending = false;
  }

  function scheduleRender() {
    if (renderPending) return;
    renderPending = true;
    requestAnimationFrame(function () {
      renderDocument();
    });
  }

  function findElementById(id) {
    var doc = APP.state.document;
    if (!doc || !doc.elements) return null;
    return doc.elements.find(function (el) {
      return el.id === id;
    }) || null;
  }

  // ─── Size canvas preview to fit container ──────────────────────────

  function sizeCanvasPreview() {
    var container = qs("#canvas-container");
    var preview = getCanvasPreview();
    if (!container || !preview) return;

    var availW = container.clientWidth - CANVAS_PADDING * 2;
    var availH = container.clientHeight - CANVAS_PADDING * 2;

    // Fit canvas within available space, maintaining aspect ratio
    var aspectScreen = canvasW / canvasH;
    var aspectAvail = availW / availH;

    var fitW, fitH;
    if (aspectAvail > aspectScreen) {
      // Available is wider than screen - fit to height
      fitH = availH;
      fitW = fitH * aspectScreen;
    } else {
      // Available is taller than screen - fit to width
      fitW = availW;
      fitH = fitW / aspectScreen;
    }

    fitW = Math.max(64, Math.min(fitW, availW));
    fitH = Math.max(36, Math.min(fitH, availH));

    preview.style.width = fitW + "px";
    preview.style.height = fitH + "px";

    scale = fitW / canvasW;
  }

  // ─── Update single element in DOM ─────────────────────────────────

  function updateElementDom(elementId) {
    var preview = getCanvasPreview();
    if (!preview) return;

    var dom = qs('[data-element-id="' + elementId + '"]', preview);
    if (!dom) return;

    var element = findElementById(elementId);
    if (!element) {
      preview.removeChild(dom);
      return;
    }

    var replacement = createElementDom(element);
    preview.replaceChild(replacement, dom);

    // Rebuild selection / group overlays
    renderSelectionOverlays();
  }

  // ─── Remove element from DOM ──────────────────────────────────────

  function removeElementDom(elementId) {
    var preview = getCanvasPreview();
    if (!preview) return;

    var dom = qs('[data-element-id="' + elementId + '"]', preview);
    if (dom) preview.removeChild(dom);

    var selOverlay = qs('[data-element-id="' + elementId + '_sel"]', preview);
    if (selOverlay) preview.removeChild(selOverlay);
  }

  // ─── Add element to DOM ───────────────────────────────────────────

  function addElementDom(element) {
    var preview = getCanvasPreview();
    if (!preview) return;

    var dom = createElementDom(element);
    preview.appendChild(dom);
  }

  // ─── Event listeners ────────────────────────────────────────────────

  APP.on("document-created", function () {
    scheduleRender();
  });

  APP.on("document-loaded", function () {
    scheduleRender();
  });

  APP.on("element-added", function (element) {
    addElementDom(element);
    if (APP.state.selectedElementId === element.id) {
      var preview = getCanvasPreview();
      if (preview) {
        var selOverlay = qs('[data-element-id="' + element.id + '_sel"]', preview);
        if (selOverlay) preview.removeChild(selOverlay);
        var overlay = createSelectionOverlay(element);
        preview.appendChild(overlay);
      }
    }
  });

  APP.on("element-updated", function (elementId) {
    updateElementDom(elementId);
  });

  APP.on("element-deleted", function (elementId) {
    removeElementDom(elementId);
  });

  APP.on("selection-changed", function () {
    // Re-render to show/hide selection overlay
    scheduleRender();
  });

  APP.on("deselect-all", function () {
    scheduleRender();
  });

  APP.on("tool-changed", function () {
    // Could change cursor style based on tool
  });

  APP.on("resize", function () {
    sizeCanvasPreview();
    scheduleRender();
  });

  // ─── Public API ────────────────────────────────────────────────────

  APP.canvas = {
    render: renderDocument,
    scheduleRender: scheduleRender,
    updateElement: updateElementDom,
    removeElement: removeElementDom,
    addElement: addElementDom,
    screenToCanvas: screenToCanvas,
    canvasToScreen: canvasToScreen,
    getScale: function () { return scale; },
    getElementById: findElementById,
    sizePreview: sizeCanvasPreview,
    applyElementStyles: applyElementStyles,
    clearSelectionOverlays: clearSelectionOverlays,
    _getPreview: getCanvasPreview,
  };

  // ─── Init: size canvas on window resize ───────────────────────────

  function onWindowResize() {
    if (APP.state.editModeActive) {
      APP.emit("resize");
    }
  }

  window.addEventListener("resize", onWindowResize);
  if (typeof APP.cleanup === "function") {
    APP.cleanup(function () {
      window.removeEventListener("resize", onWindowResize);
    });
  }

  // Initial size when entering edit mode
  APP.on("enter-edit", function () {
    sizeCanvasPreview();
    scheduleRender();
  });

})();

// --- 040-tool-handlers.js ---
// 040-tool-handlers.js - Tool selection and element creation
(function hudEditorToolHandlers() {
  "use strict";

  var NS = "HudEditor";
  var APP = window[NS];
  if (!APP) return;

  // ─── Tool state ────────────────────────────────────────────────────

  var isCreating = false;
  var createStartX = 0;
  var createStartY = 0;
  var createCurrentX = 0;
  var createCurrentY = 0;
  var tempElement = null;
  var tempDom = null;
  var MIN_CREATE_SIZE = 10;
  var DEFAULT_IMAGE_PATH = "resources_generated/env/voxel/ore/aluminium-ore/icons/env_aluminium-ore_icon.png";

  function ensureCanvasCreateListeners() {
    var preview = APP.canvas && APP.canvas._getPreview ? APP.canvas._getPreview() : null;
    if (!preview) return;
    if (preview.__hudEditorCreateBound) return;
    preview.__hudEditorCreateBound = true;
    preview.addEventListener("mousedown", onCanvasMouseDown);
    preview.addEventListener("mousemove", onCanvasMouseMove);
    preview.addEventListener("mouseup", onCanvasMouseUp);
  }

  // ─── Tool to element type mapping ─────────────────────────────────

  var toolToType = {
    select: null,
    box: "box",
    rounded: "boxRounded",
    circle: "circle",
    bezierArc: "bezierArc",
    triangle: "triangle",
    quad: "quad",
    image: "image",
    line: "line",
    text: "text",
  };

  // ─── Generate unique element ID ────────────────────────────────────

  function generateId() {
    var doc = APP.state.document;
    if (!doc || !doc.elements) return "el_" + Date.now();
    var base = "el";
    var counter = doc.elements.length + 1;
    var id = base + "_" + counter;
    // Ensure uniqueness
    while (doc.elements.find(function (e) { return e.id === id; })) {
      counter++;
      id = base + "_" + counter;
    }
    return id;
  }

  // ─── Create element from current tool ─────────────────────────────

  function createNewElement(screenX, screenY) {
    var tool = APP.state.currentTool;
    var type = toolToType[tool];
    if (!type) return null;

    var element = {
      id: generateId(),
      type: type,
      visible: true,
      x: screenX,
      y: screenY,
      w: 0,
      h: 0,
      radius: 12,
      fill: [0.15, 0.15, 0.18, 0.95],
      stroke: [0.70, 0.72, 0.76, 1.0],
      strokeWidth: 2,
      textLines: tool === "text" ? ["Text"] : null,
      textColor: [0.86, 0.88, 0.92, 1.0],
      textSize: 16,
      textAlign: "center",
      rotation: 0,
      shadowBlur: 0,
      shadowColor: [0, 0, 0, 0],
      imageSrc: "",
      imageFit: "contain",
      quadInset: 0.125
    };

    if (type === "line" || type === "bezierArc") {
      element.fill = [0, 0, 0, 0];
    }
    if (type === "text") {
      element.fill = [0, 0, 0, 0];
      element.strokeWidth = 0;
    }
    if (type === "image") {
      element.fill = [0, 0, 0, 0];
      element.stroke = [0, 0, 0, 0];
      element.strokeWidth = 0;
      element.imageSrc = DEFAULT_IMAGE_PATH;
    }

    return element;
  }

  // ─── Update temp element during drag ───────────────────────────────

  function updateTempElement(screenX, screenY) {
    if (!tempElement) return;

    var tool = APP.state.currentTool;
    if (tool === "line") {
      tempElement.x = createStartX;
      tempElement.y = createStartY;
      tempElement.w = screenX - createStartX;
      tempElement.h = screenY - createStartY;
    } else {
      var sx = Math.min(createStartX, screenX);
      var sy = Math.min(createStartY, screenY);
      var ex = Math.max(createStartX, screenX);
      var ey = Math.max(createStartY, screenY);

      tempElement.x = sx;
      tempElement.y = sy;
      tempElement.w = ex - sx;
      tempElement.h = ey - sy;
    }

    // Update the temp DOM
    if (tempDom && APP.canvas && typeof APP.canvas.applyElementStyles === "function") {
      APP.canvas.applyElementStyles(tempDom, tempElement);
    }
  }

  function hasMeaningfulSize(element) {
    if (!element) return false;
    if (element.type === "line") {
      return Math.sqrt(element.w * element.w + element.h * element.h) >= MIN_CREATE_SIZE;
    }
    return element.w >= MIN_CREATE_SIZE && element.h >= MIN_CREATE_SIZE;
  }

  // ─── Finalize element creation ─────────────────────────────────────

  function finalizeCreation() {
    if (!tempElement) return null;

    // Only create if element has meaningful size
    if (!hasMeaningfulSize(tempElement)) {
      // Remove temp DOM
      if (tempDom) {
        var preview = APP.canvas && APP.canvas.getElementById ? null : null;
        // Temp DOM will be cleaned up by scheduleRender on cancel
      }
      cancelCreation();
      return null;
    }

    // Add to document once
    if (APP.state.document && APP.state.document.elements) {
      APP.state.document.elements.push(tempElement);
      APP.state.isDirty = true;

      // Select the new element
      APP.state.selectedElementId = tempElement.id;

      // Emit events
      APP.emit("element-added", tempElement);
      APP.emit("selection-changed", tempElement.id);
    }

    var created = tempElement;
    tempElement = null;
    tempDom = null;
    isCreating = false;

    return created;
  }

  // ─── Cancel creation ───────────────────────────────────────────────

  function cancelCreation() {
    if (tempElement) {
      // Remove temp DOM if exists
      if (tempDom) {
        var preview = APP.canvas && APP.canvas._getPreview ? APP.canvas._getPreview() : null;
        if (preview && preview.querySelector) {
          var dom = preview.querySelector('[data-element-id="' + tempElement.id + '"]');
          if (dom) preview.removeChild(dom);
        }
        tempDom = null;
      }
      tempElement = null;
    }
    isCreating = false;
    APP.emit("creating-cancelled");
  }

  // ─── Canvas mouse handlers ─────────────────────────────────────────

  function onCanvasMouseDown(e) {
    if (!APP.state.editModeActive) return;
    if (APP.state.currentScreen !== "editor") return;

    var tool = APP.state.currentTool;

    // If in select mode, let selection-manager handle it
    if (tool === "select") return;

    var preview = APP.canvas && APP.canvas._getPreview ? APP.canvas._getPreview() : null;
    if (!preview) return;

    var rect = preview.getBoundingClientRect();
    var canvasX = e.clientX - rect.left;
    var canvasY = e.clientY - rect.top;
    var screen = APP.canvas.canvasToScreen(canvasX, canvasY);

    createStartX = screen.x;
    createStartY = screen.y;
    createCurrentX = screen.x;
    createCurrentY = screen.y;

    tempElement = createNewElement(screen.x, screen.y);
    if (!tempElement) return;

    isCreating = true;

    // Create temp DOM
    tempDom = document.createElement("div");
    tempDom.className = "canvas-element creating";
    tempDom.dataset.elementId = tempElement.id;
    tempDom.style.opacity = "0.6";
    preview.appendChild(tempDom);

    if (APP.canvas && typeof APP.canvas.applyElementStyles === "function") {
      APP.canvas.applyElementStyles(tempDom, tempElement);
    }
    APP.emit("creation-started", tempElement);
  }

  function onCanvasMouseMove(e) {
    if (!isCreating || !tempElement) return;

    var preview = APP.canvas && APP.canvas._getPreview ? APP.canvas._getPreview() : null;
    if (!preview) return;

    var rect = preview.getBoundingClientRect();
    var canvasX = e.clientX - rect.left;
    var canvasY = e.clientY - rect.top;
    var screen = APP.canvas.canvasToScreen(canvasX, canvasY);

    createCurrentX = screen.x;
    createCurrentY = screen.y;

    updateTempElement(screen.x, screen.y);
  }

  function onCanvasMouseUp(e) {
    if (!isCreating) return;
    var preview = APP.canvas && APP.canvas._getPreview ? APP.canvas._getPreview() : null;
    if (preview) {
      var rect = preview.getBoundingClientRect();
      var canvasX = e.clientX - rect.left;
      var canvasY = e.clientY - rect.top;
      var screen = APP.canvas.canvasToScreen(canvasX, canvasY);
      updateTempElement(screen.x, screen.y);
    }
    finalizeCreation();
  }

  // ─── Attach canvas events ──────────────────────────────────────────

  APP.on("enter-edit", function () {
    if (APP.state.currentScreen !== "editor") return;
    setTimeout(ensureCanvasCreateListeners, 0);
  });

  APP.on("document-created", function () {
    setTimeout(ensureCanvasCreateListeners, 0);
  });

  APP.on("document-loaded", function () {
    setTimeout(ensureCanvasCreateListeners, 0);
  });

  // Expose for selection manager
  APP.tools = {
    isCreating: function () { return isCreating; },
    cancelCreation: cancelCreation,
    finalizeCreation: finalizeCreation,
  };

})();

// --- 050-selection-manager.js ---
// 050-selection-manager.js - Element selection, hit testing, drag, resize, grouping, cloning
(function hudEditorSelectionManager() {
  "use strict";

  var NS = "HudEditor";
  var APP = window[NS];
  if (!APP) return;

  // ─── Helpers ──────────────────────────────────────────────────────

  function ids() { return APP.state.selectedElementIds; }

  function isSelected(id) {
    var arr = ids();
    for (var i = 0; i < arr.length; i++) { if (arr[i] === id) return true; }
    return false;
  }

  // ─── Group state ──────────────────────────────────────────────────

  var groupState = {
    active: false,        // true when a group selection is active
    selected: false,      // true when the persistent group is the active UI target
    memberIds: [],        // element IDs that are members of the group
  };

  function hasGroup() { return groupState.active && groupState.memberIds.length >= 2; }
  function isGroupSelected() { return hasGroup() && groupState.selected; }

  // Aggregate selection: selected group members or selected loose elements.
  function activeIds() {
    if (isGroupSelected()) return groupState.memberIds.slice();
    return ids().slice();
  }

  function isAggregateSelection() {
    return activeIds().length >= 2;
  }

  function getGroupBounds() {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    var members = groupState.memberIds.slice();
    for (var i = 0; i < members.length; i++) {
      var el = APP.canvas.getElementById(members[i]);
      if (!el) continue;
      if (el.x < minX) minX = el.x;
      if (el.y < minY) minY = el.y;
      if (el.x + el.w > maxX) maxX = el.x + el.w;
      if (el.y + el.h > maxY) maxY = el.y + el.h;
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  // ─── Hit testing ───────────────────────────────────────────────────

  function pointInElement(x, y, element) {
    if (!element) return false;
    return x >= element.x &&
           x <= element.x + element.w &&
           y >= element.y &&
           y <= element.y + element.h;
  }

  function hitTest(screenX, screenY) {
    var doc = APP.state.document;
    if (!doc || !doc.elements) return null;
    var elements = doc.elements;
    for (var i = elements.length - 1; i >= 0; i--) {
      var el = elements[i];
      if (el.visible === false) continue;
      if (pointInElement(screenX, screenY, el)) return el;
    }
    return null;
  }

  // ─── Selection ─────────────────────────────────────────────────────

  function selectGroup() {
    if (!hasGroup()) return;
    groupState.selected = true;
    APP.state.selectedElementId = null;
    APP.state.selectedElementIds = [];
    APP.emit("selection-changed", null);
  }

  function selectElement(elementId) {
    groupState.selected = false;
    APP.state.selectedElementId = elementId;
    APP.state.selectedElementIds = elementId ? [elementId] : [];
    APP.emit("selection-changed", elementId);
  }

  function toggleInSelection(elementId) {
    groupState.selected = false;
    var arr = ids();
    if (isSelected(elementId)) {
      var next = [];
      for (var i = 0; i < arr.length; i++) {
        if (arr[i] !== elementId) next.push(arr[i]);
      }
      APP.state.selectedElementIds = next;
      APP.state.selectedElementId = next.length > 0 ? next[next.length - 1] : null;
    } else {
      arr.push(elementId);
      APP.state.selectedElementId = elementId;
    }
    APP.emit("selection-changed", APP.state.selectedElementId);
  }

  function deselectAll() {
    if (ids().length === 0 && !APP.state.selectedElementId && !groupState.active) return;
    APP.state.selectedElementId = null;
    APP.state.selectedElementIds = [];
    groupState.selected = false;
    APP.emit("selection-changed", null);
    APP.emit("deselect-all");
  }

  function deleteSelected() {
    var arr = activeIds();
    if (arr.length === 0) return;

    var doc = APP.state.document;
    if (!doc || !doc.elements) return;

    if (APP.undoRedo) APP.undoRedo.push();

    for (var s = 0; s < arr.length; s++) {
      var id = arr[s];
      for (var i = doc.elements.length - 1; i >= 0; i--) {
        if (doc.elements[i].id === id) {
          doc.elements.splice(i, 1);
          APP.state.isDirty = true;
          APP.emit("element-deleted", id);
          break;
        }
      }
    }

    if (hasGroup()) {
      groupState.memberIds = groupState.memberIds.filter(function (groupId) {
        return !!APP.canvas.getElementById(groupId);
      });
      if (groupState.memberIds.length < 2) {
        groupState.active = false;
        groupState.selected = false;
        groupState.memberIds = [];
      }
    }
    deselectAll();
  }

  // ─── Grouping ──────────────────────────────────────────────────────

  function groupSelection() {
    var arr = ids();
    if (arr.length < 2) return;

    if (APP.undoRedo) APP.undoRedo.push();

    groupState.active = true;
    groupState.selected = true;
    groupState.memberIds = arr.slice();
    APP.state.selectedElementId = null;
    APP.state.selectedElementIds = [];
    APP.emit("group-activated");
    APP.emit("selection-changed", null);
    APP.canvas.scheduleRender();
  }

  function ungroupSelection() {
    if (!hasGroup()) return;

    if (APP.undoRedo) APP.undoRedo.push();

    var members = groupState.memberIds.slice();
    groupState.active = false;
    groupState.selected = false;
    groupState.memberIds = [];
    APP.state.selectedElementIds = members;
    APP.state.selectedElementId = members.length > 0 ? members[members.length - 1] : null;
    APP.emit("group-deactivated");
    APP.emit("selection-changed", APP.state.selectedElementId);
    APP.canvas.scheduleRender();
  }

  // ─── Cloning ───────────────────────────────────────────────────────

  var CLONE_OFFSET_X = 24;
  var CLONE_OFFSET_Y = 24;

  function cloneSelection() {
    var sourceIds;
    if (isGroupSelected()) {
      sourceIds = groupState.memberIds.slice();
    } else {
      sourceIds = ids().slice();
    }
    if (sourceIds.length === 0) return;

    var doc = APP.state.document;
    if (!doc || !doc.elements) return;

    if (APP.undoRedo) APP.undoRedo.push();

    var newIds = [];
    for (var i = 0; i < sourceIds.length; i++) {
      var src = APP.canvas.getElementById(sourceIds[i]);
      if (!src) continue;
      var clone = JSON.parse(JSON.stringify(src));
      clone.id = generateId();
      clone.x += CLONE_OFFSET_X;
      clone.y += CLONE_OFFSET_Y;
      doc.elements.push(clone);
      newIds.push(clone.id);
      APP.emit("element-added", clone);
    }

    if (newIds.length === 0) return;

    APP.state.isDirty = true;
    groupState.selected = false;

    if (newIds.length === 1) {
      selectElement(newIds[0]);
    } else {
      APP.state.selectedElementIds = newIds;
      APP.state.selectedElementId = newIds[newIds.length - 1];
      APP.emit("selection-changed", APP.state.selectedElementId);
    }

    APP.canvas.scheduleRender();
    APP.emit("toast", { type: "success", text: newIds.length > 1 ? "Cloned selection" : "Cloned element" });
  }

  function generateId() {
    var doc = APP.state.document;
    if (!doc || !doc.elements) return "el_" + Date.now();
    var base = "el";
    var counter = doc.elements.length + 1;
    var id = base + "_" + counter;
    while (doc.elements.find(function (e) { return e.id === id; })) {
      counter++;
      id = base + "_" + counter;
    }
    return id;
  }

  // ─── Canvas click handler ──────────────────────────────────────────

  function onCanvasClick(e) {
    if (dragState.suppressClick) {
      dragState.suppressClick = false;
      return;
    }

    if (!APP.state.editModeActive) return;
    if (APP.state.currentScreen !== "editor") return;
    if (APP.state.currentTool !== "select") return;

    if (e.target.classList && e.target.classList.contains("resize-handle")) return;
    if (e.target.classList && e.target.classList.contains("group-handle")) return;

    var preview = APP.canvas && APP.canvas._getPreview ? APP.canvas._getPreview() : null;
    if (!preview) return;

    if (e.target.closest("#properties-panel")) return;
    if (e.target.closest("#shapes-panel")) return;
    if (e.target.closest("#editor-toolbar")) return;
    if (e.target.closest("#editor-statusbar")) return;

    var hitId = null;
    var screen = null;
    var clickedElement = e.target.closest(".canvas-element");
    if (clickedElement && clickedElement.dataset && clickedElement.dataset.elementId) {
      hitId = clickedElement.dataset.elementId;
    } else {
      var rect = preview.getBoundingClientRect();
      var canvasX = e.clientX - rect.left;
      var canvasY = e.clientY - rect.top;
      screen = APP.canvas.canvasToScreen(canvasX, canvasY);
      var hit = hitTest(screen.x, screen.y);
      if (hit) hitId = hit.id;
    }

    if (hasGroup()) {
      if (hitId && groupState.memberIds.indexOf(hitId) !== -1) {
        selectGroup();
        return;
      }

      var bounds = getGroupBounds();
      if (!hitId && pointInElement(screen.x, screen.y, bounds)) {
        selectGroup();
        return;
      }
    }

    if (hitId) {
      if (e.shiftKey || e.ctrlKey) {
        toggleInSelection(hitId);
      } else {
        selectElement(hitId);
      }
    } else {
      deselectAll();
    }
  }

  // ─── Drag/move state (multi-element + group) ───────────────────────

  var dragState = {
    active: false,
    startX: 0,
    startY: 0,
    origins: null,   // [{id, origX, origY}, ...]
    moved: false,
    suppressClick: false,
  };

  function onElementMouseDown(e) {
    if (!APP.state.editModeActive) return;
    if (APP.state.currentScreen !== "editor") return;
    if (APP.state.currentTool !== "select") return;

    if (e.target.classList && e.target.classList.contains("resize-handle")) return;
    if (e.target.classList && e.target.classList.contains("group-handle")) return;

    if (e.target.closest("#properties-panel")) return;
    if (e.target.closest("#shapes-panel")) return;
    if (e.target.closest("#editor-toolbar")) return;
    if (e.target.closest("#editor-statusbar")) return;

    var clickedElement = e.target.closest(".canvas-element");
    if (!clickedElement || !clickedElement.dataset || !clickedElement.dataset.elementId) {
      if (!hasGroup()) return;

      var previewRect = preview.getBoundingClientRect();
      var previewCanvasX = e.clientX - previewRect.left;
      var previewCanvasY = e.clientY - previewRect.top;
      var previewScreen = APP.canvas.canvasToScreen(previewCanvasX, previewCanvasY);
      var groupBounds = getGroupBounds();
      var groupHit = hitTest(previewScreen.x, previewScreen.y);
      if (groupHit || !pointInElement(previewScreen.x, previewScreen.y, groupBounds)) return;

      selectGroup();
      startAggregateDrag(previewScreen.x, previewScreen.y, groupState.memberIds.slice());
      e.preventDefault();
      return;
    }

    var elementId = clickedElement.dataset.elementId;
    var element = APP.canvas.getElementById(elementId);
    if (!element) return;

    var preview = APP.canvas && APP.canvas._getPreview ? APP.canvas._getPreview() : null;
    if (!preview) return;

    if (e.shiftKey || e.ctrlKey) return;

    // Clicking a grouped member targets the persistent group.
    if (hasGroup() && groupState.memberIds.indexOf(elementId) !== -1) {
      var groupRect = preview.getBoundingClientRect();
      var groupCanvasX = e.clientX - groupRect.left;
      var groupCanvasY = e.clientY - groupRect.top;
      var groupScreen = APP.canvas.canvasToScreen(groupCanvasX, groupCanvasY);
      selectGroup();
      startAggregateDrag(groupScreen.x, groupScreen.y, groupState.memberIds.slice());
      e.preventDefault();
      return;
    }

    if (!isSelected(elementId)) {
      selectElement(elementId);
    }

    var rect = preview.getBoundingClientRect();
    var canvasX = e.clientX - rect.left;
    var canvasY = e.clientY - rect.top;
    var screen = APP.canvas.canvasToScreen(canvasX, canvasY);

    startAggregateDrag(screen.x, screen.y, ids().slice());
    e.preventDefault();
  }

  function startAggregateDrag(screenX, screenY, targetIds) {
    var origins = [];
    for (var i = 0; i < targetIds.length; i++) {
      var el = APP.canvas.getElementById(targetIds[i]);
      if (el) origins.push({ id: targetIds[i], origX: el.x, origY: el.y });
    }

    dragState.active = true;
    dragState.startX = screenX;
    dragState.startY = screenY;
    dragState.origins = origins;
    dragState.moved = false;
    dragState.suppressClick = false;

    document.addEventListener("mousemove", onDragMouseMove);
    document.addEventListener("mouseup", onDragMouseUp);
  }

  function onDragMouseMove(e) {
    if (!dragState.active) return;

    var preview = APP.canvas && APP.canvas._getPreview ? APP.canvas._getPreview() : null;
    if (!preview) return;

    var rect = preview.getBoundingClientRect();
    var canvasX = e.clientX - rect.left;
    var canvasY = e.clientY - rect.top;
    var screen = APP.canvas.canvasToScreen(canvasX, canvasY);

    var dx = screen.x - dragState.startX;
    var dy = screen.y - dragState.startY;

    if (!dragState.moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
    if (!dragState.moved && APP.undoRedo) APP.undoRedo.push();
    dragState.moved = true;

    var origins = dragState.origins;
    for (var i = 0; i < origins.length; i++) {
      var o = origins[i];
      var elem = APP.canvas.getElementById(o.id);
      if (!elem) continue;
      elem.x = o.origX + dx;
      elem.y = o.origY + dy;
      APP.canvas.updateElement(o.id);
    }
    APP.state.isDirty = true;
  }

  function onDragMouseUp() {
    if (!dragState.active) return;

    var wasMoved = dragState.moved;
    dragState.active = false;
    dragState.moved = false;

    document.removeEventListener("mousemove", onDragMouseMove);
    document.removeEventListener("mouseup", onDragMouseUp);

    if (wasMoved) {
      dragState.suppressClick = true;
      var origins = dragState.origins;
      for (var i = 0; i < origins.length; i++) {
        APP.emit("element-updated", origins[i].id);
      }
    }
  }

  // ─── Resize handle drag state ─────────────────────────────────────

  var resizeState = {
    active: false,
    elementId: null,
    handle: null,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
    origW: 0,
    origH: 0,
  };

  // ─── Group resize state ───────────────────────────────────────────

  var groupResizeState = {
    active: false,
    handle: null,
    startX: 0,
    startY: 0,
    bounds: null,  // {x, y, w, h}
    memberOrigins: null, // [{id, origX, origY, origW, origH}, ...]
  };

  function ensureCanvasSelectionListeners() {
    var preview = APP.canvas && APP.canvas._getPreview ? APP.canvas._getPreview() : null;
    if (!preview) return;
    if (!preview.__hudEditorSelectBound) {
      preview.__hudEditorSelectBound = true;
      preview.addEventListener("click", onCanvasClick);
      preview.addEventListener("mousedown", onElementMouseDown);
      preview.addEventListener("mousedown", onResizeHandleMouseDown, true);
      preview.addEventListener("mousedown", onGroupHandleMouseDown, true);
    }
  }

  function onResizeHandleMouseDown(e) {
    var handle = e.target;
    if (!handle.classList || !handle.classList.contains("resize-handle")) return;

    e.stopPropagation();
    e.preventDefault();

    if (!APP.state.editModeActive) return;

    var elementId = handle.dataset.elementId;
    var handleType = handle.dataset.h;

    var element = APP.canvas.getElementById(elementId);
    if (!element) return;

    var preview = APP.canvas && APP.canvas._getPreview ? APP.canvas._getPreview() : null;
    if (!preview) return;

    var rect = preview.getBoundingClientRect();
    var canvasX = e.clientX - rect.left;
    var canvasY = e.clientY - rect.top;
    var screen = APP.canvas.canvasToScreen(canvasX, canvasY);

    if (APP.undoRedo) APP.undoRedo.push();

    resizeState.active = true;
    resizeState.elementId = elementId;
    resizeState.handle = handleType;
    resizeState.startX = screen.x;
    resizeState.startY = screen.y;
    resizeState.origX = element.x;
    resizeState.origY = element.y;
    resizeState.origW = element.w;
    resizeState.origH = element.h;

    document.addEventListener("mousemove", onResizeMouseMove);
    document.addEventListener("mouseup", onResizeMouseUp);
  }

  function onResizeMouseMove(e) {
    if (!resizeState.active) return;

    var preview = APP.canvas && APP.canvas._getPreview ? APP.canvas._getPreview() : null;
    if (!preview) return;

    var rect = preview.getBoundingClientRect();
    var canvasX = e.clientX - rect.left;
    var canvasY = e.clientY - rect.top;
    var screen = APP.canvas.canvasToScreen(canvasX, canvasY);

    var dx = screen.x - resizeState.startX;
    var dy = screen.y - resizeState.startY;

    var elem = APP.canvas.getElementById(resizeState.elementId);
    if (!elem) return;

    var h = resizeState.handle;

    var newX = resizeState.origX;
    var newY = resizeState.origY;
    var newW = resizeState.origW;
    var newH = resizeState.origH;

    if (h.includes("e")) { newW = Math.max(10, resizeState.origW + dx); }
    if (h.includes("s")) { newH = Math.max(10, resizeState.origH + dy); }
    if (h.includes("w")) {
      var nw = Math.max(10, resizeState.origW - dx);
      newX = resizeState.origX + resizeState.origW - nw;
      newW = nw;
    }
    if (h.includes("n")) {
      var nh = Math.max(10, resizeState.origH - dy);
      newY = resizeState.origY + resizeState.origH - nh;
      newH = nh;
    }

    elem.x = newX;
    elem.y = newY;
    elem.w = newW;
    elem.h = newH;

    APP.state.isDirty = true;
    APP.canvas.updateElement(resizeState.elementId);
  }

  function onResizeMouseUp() {
    if (!resizeState.active) return;

    resizeState.active = false;
    document.removeEventListener("mousemove", onResizeMouseMove);
    document.removeEventListener("mouseup", onResizeMouseUp);

    APP.emit("element-updated", resizeState.elementId);
  }

  // ─── Group handle mouse handlers ──────────────────────────────────

  function onGroupHandleMouseDown(e) {
    var handle = e.target;
    if (!handle.classList || !handle.classList.contains("group-handle")) return;

    e.stopPropagation();
    e.preventDefault();

    if (!APP.state.editModeActive) return;
    if (!isAggregateSelection()) return;

    var handleType = handle.dataset.h;
    var bounds = getGroupBounds();

    var preview = APP.canvas && APP.canvas._getPreview ? APP.canvas._getPreview() : null;
    if (!preview) return;

    var rect = preview.getBoundingClientRect();
    var canvasX = e.clientX - rect.left;
    var canvasY = e.clientY - rect.top;
    var screen = APP.canvas.canvasToScreen(canvasX, canvasY);

    if (APP.undoRedo) APP.undoRedo.push();

    // Capture member origins
    var aIds = activeIds();
    var memberOrigins = [];
    for (var i = 0; i < aIds.length; i++) {
      var el = APP.canvas.getElementById(aIds[i]);
      if (el) {
        memberOrigins.push({ id: el.id, origX: el.x, origY: el.y, origW: el.w, origH: el.h });
      }
    }

    groupResizeState.active = true;
    groupResizeState.handle = handleType;
    groupResizeState.startX = screen.x;
    groupResizeState.startY = screen.y;
    groupResizeState.bounds = bounds;
    groupResizeState.memberOrigins = memberOrigins;

    document.addEventListener("mousemove", onGroupResizeMouseMove);
    document.addEventListener("mouseup", onGroupResizeMouseUp);
  }

  function onGroupResizeMouseMove(e) {
    if (!groupResizeState.active) return;

    var preview = APP.canvas && APP.canvas._getPreview ? APP.canvas._getPreview() : null;
    if (!preview) return;

    var rect = preview.getBoundingClientRect();
    var canvasX = e.clientX - rect.left;
    var canvasY = e.clientY - rect.top;
    var screen = APP.canvas.canvasToScreen(canvasX, canvasY);

    var dx = screen.x - groupResizeState.startX;
    var dy = screen.y - groupResizeState.startY;

    var oldBounds = groupResizeState.bounds;
    var h = groupResizeState.handle;

    var newX = oldBounds.x;
    var newY = oldBounds.y;
    var newW = oldBounds.w;
    var newH = oldBounds.h;

    if (h.includes("e")) { newW = Math.max(20, oldBounds.w + dx); }
    if (h.includes("s")) { newH = Math.max(20, oldBounds.h + dy); }
    if (h.includes("w")) {
      var nw = Math.max(20, oldBounds.w - dx);
      newX = oldBounds.x + oldBounds.w - nw;
      newW = nw;
    }
    if (h.includes("n")) {
      var nh = Math.max(20, oldBounds.h - dy);
      newY = oldBounds.y + oldBounds.h - nh;
      newH = nh;
    }

    // Compute scale factors
    var scaleX = newW / oldBounds.w;
    var scaleY = newH / oldBounds.h;

    // Compute translation of the group's top-left
    var transX = newX - oldBounds.x;
    var transY = newY - oldBounds.y;

    var origins = groupResizeState.memberOrigins;
    for (var i = 0; i < origins.length; i++) {
      var o = origins[i];
      var elem = APP.canvas.getElementById(o.id);
      if (!elem) continue;

      if (elem.type === "circle") {
        // Circle: move center point, keep radius (scale doesn't apply to radius visually here)
        var oldCx = o.origX + o.origW / 2;
        var oldCy = o.origY + o.origH / 2;
        var newCx = (oldCx - oldBounds.x) * scaleX + oldBounds.x + transX;
        var newCy = (oldCy - oldBounds.y) * scaleY + oldBounds.y + transY;
        elem.x = newCx - o.origW / 2;
        elem.y = newCy - o.origH / 2;
      } else if (elem.type === "line") {
        // Line: scale both position and dimensions
        elem.x = (o.origX - oldBounds.x) * scaleX + oldBounds.x + transX;
        elem.y = (o.origY - oldBounds.y) * scaleY + oldBounds.y + transY;
        elem.w = o.origW * scaleX;
        elem.h = o.origH * scaleY;
      } else {
        // Box, boxRounded, text: scale position and dimensions
        elem.x = (o.origX - oldBounds.x) * scaleX + oldBounds.x + transX;
        elem.y = (o.origY - oldBounds.y) * scaleY + oldBounds.y + transY;
        elem.w = Math.max(10, o.origW * scaleX);
        elem.h = Math.max(10, o.origH * scaleY);
      }

      APP.canvas.updateElement(elem.id);
    }

    APP.state.isDirty = true;
  }

  function onGroupResizeMouseUp() {
    if (!groupResizeState.active) return;

    groupResizeState.active = false;
    document.removeEventListener("mousemove", onGroupResizeMouseMove);
    document.removeEventListener("mouseup", onGroupResizeMouseUp);

    var aIds = activeIds();
    for (var i = 0; i < aIds.length; i++) {
      APP.emit("element-updated", aIds[i]);
    }
  }

  // ─── Attach events ─────────────────────────────────────────────────

  APP.on("enter-edit", function () {
    if (APP.state.currentScreen !== "editor") return;
    setTimeout(ensureCanvasSelectionListeners, 0);
  });

  APP.on("document-created", function () {
    setTimeout(ensureCanvasSelectionListeners, 0);
  });

  APP.on("document-loaded", function () {
    setTimeout(ensureCanvasSelectionListeners, 0);
  });

  APP.on("selection-changed", function () {
    setTimeout(function () {
      var handles = document.querySelectorAll(".resize-handle");
      handles.forEach(function (h) {
        h.removeEventListener("mousedown", onResizeHandleMouseDown);
        h.addEventListener("mousedown", onResizeHandleMouseDown);
      });
      var gHandles = document.querySelectorAll(".group-handle");
      gHandles.forEach(function (h) {
        h.removeEventListener("mousedown", onGroupHandleMouseDown);
        h.addEventListener("mousedown", onGroupHandleMouseDown);
      });
    }, 10);
  });

  APP.on("tool-changed", function (tool) {
    if (tool !== "select") { deselectAll(); }
  });

  APP.on("delete-element", function () {
    deleteSelected();
  });

  APP.on("group-selection", function () {
    groupSelection();
  });

  APP.on("ungroup-selection", function () {
    ungroupSelection();
  });

  APP.on("clone-selection", function () {
    cloneSelection();
  });

  // ─── Alignment ─────────────────────────────────────────────────────

  function alignSelected(mode) {
    var arr = activeIds();
    if (arr.length < 2) {
      if (arr.length === 1) alignToCanvas(mode);
      return;
    }

    var elems = [];
    for (var i = 0; i < arr.length; i++) {
      var e = APP.canvas.getElementById(arr[i]);
      if (e) elems.push(e);
    }
    if (elems.length < 2) return;

    if (APP.undoRedo) APP.undoRedo.push();

    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var j = 0; j < elems.length; j++) {
      var el = elems[j];
      if (el.x < minX) minX = el.x;
      if (el.y < minY) minY = el.y;
      if (el.x + el.w > maxX) maxX = el.x + el.w;
      if (el.y + el.h > maxY) maxY = el.y + el.h;
    }

    for (var k = 0; k < elems.length; k++) {
      var elem = elems[k];
      switch (mode) {
        case "left":      elem.x = minX; break;
        case "right":     elem.x = maxX - elem.w; break;
        case "center-h":  elem.x = minX + (maxX - minX) / 2 - elem.w / 2; break;
        case "top":       elem.y = minY; break;
        case "bottom":    elem.y = maxY - elem.h; break;
        case "center-v":  elem.y = minY + (maxY - minY) / 2 - elem.h / 2; break;
      }
      APP.canvas.updateElement(elem.id);
    }

    APP.state.isDirty = true;
    APP.canvas.scheduleRender();
    APP.emit("element-updated", arr[0]);
  }

  function alignToCanvas(mode) {
    var arr = ids();
    if (arr.length !== 1) return;
    var elem = APP.canvas.getElementById(arr[0]);
    if (!elem) return;

    var doc = APP.state.document;
    var sw = (doc && doc.screenWidth) || 1920;
    var sh = (doc && doc.screenHeight) || 1080;

    if (APP.undoRedo) APP.undoRedo.push();

    switch (mode) {
      case "left":      elem.x = 0; break;
      case "right":     elem.x = sw - elem.w; break;
      case "center-h":  elem.x = (sw - elem.w) / 2; break;
      case "top":       elem.y = 0; break;
      case "bottom":    elem.y = sh - elem.h; break;
      case "center-v":  elem.y = (sh - elem.h) / 2; break;
    }

    APP.state.isDirty = true;
    APP.canvas.updateElement(elem.id);
    APP.emit("element-updated", elem.id);
  }

  APP.on("align", function (mode) {
    alignSelected(mode);
  });

  // ─── Public API ────────────────────────────────────────────────────

  APP.selection = {
    select: selectElement,
    selectGroup: selectGroup,
    toggleIn: toggleInSelection,
    deselect: deselectAll,
    deleteSelected: deleteSelected,
    hitTest: hitTest,
    isSelected: isSelected,
    getIds: function () { return ids().slice(); },
    groupSelection: groupSelection,
    ungroupSelection: ungroupSelection,
    cloneSelection: cloneSelection,
    hasGroup: hasGroup,
    isGroupSelected: isGroupSelected,
    getGroupBounds: getGroupBounds,
    getGroupMemberIds: function () { return groupState.memberIds.slice(); },
  };

  if (typeof APP.cleanup === "function") {
    APP.cleanup(function () {
      dragState.active = false;
      document.removeEventListener("mousemove", onDragMouseMove);
      document.removeEventListener("mouseup", onDragMouseUp);
      resizeState.active = false;
      document.removeEventListener("mousemove", onResizeMouseMove);
      document.removeEventListener("mouseup", onResizeMouseUp);
      groupResizeState.active = false;
      document.removeEventListener("mousemove", onGroupResizeMouseMove);
      document.removeEventListener("mouseup", onGroupResizeMouseUp);
    });
  }

})();

// --- 060-shapes-panel.js ---
// 060-shapes-panel.js - Floating layers / shapes list panel
(function hudEditorShapesPanel() {
  "use strict";

  var NS = "HudEditor";
  var APP = window[NS];
  if (!APP) return;

  var el = APP.el;
  var qs = APP.qs;

  // ─── Type display info ──────────────────────────────────────────────

  var TYPE_INFO = {
    box:        { icon: "\u25AD", label: "Box" },
    boxRounded: { icon: "\u25A2", label: "Rounded" },
    circle:     { icon: "\u25CB", label: "Circle" },
    bezierArc:  { icon: "\u2302", label: "Bezier Arc" },
    triangle:   { icon: "\u25B3", label: "Triangle" },
    quad:       { icon: "\u25F0", label: "Quad" },
    image:      { icon: "\u25C9", label: "Image" },
    line:       { icon: "\u2571", label: "Line" },
    text:       { icon: "T",      label: "Text" },
  };

  // ─── Panel DOM ──────────────────────────────────────────────────────

  var panelEl = null;
  var listEl = null;

  function isAutoOpenEnabled() {
    return !!APP.state.autoOpenPanels;
  }

  function buildPanel() {
    listEl = el("div", { className: "shapes-list" });

    panelEl = el("div", { id: "shapes-panel" }, [
      el("div", { className: "panel-header" }, [
        el("span", { textContent: "Layers" }),
        el("button", { className: "panel-toggle", dataset: { action: "toggle-collapse" }, textContent: "\u25BE" }),
      ]),
      listEl,
    ]);

    return panelEl;
  }

  // ─── Render the layer list ──────────────────────────────────────────

  function buildLayerItem(elem, hasGroup, groupMemberIds) {
    var info = TYPE_INFO[elem.type] || { icon: "?", label: elem.type };
    var isSelected = APP.selection.isSelected(elem.id);
    var isVisible = elem.visible !== false;
    var isGroupedMember = hasGroup && groupMemberIds.indexOf(elem.id) !== -1;

    return el("div", {
      className: "layer-item" + (isSelected ? " selected" : "") + (isGroupedMember ? " grouped-member" : ""),
      dataset: { elementId: elem.id },
    }, [
      el("button", {
        className: "layer-btn layer-vis" + (isVisible ? "" : " off"),
        dataset: { action: "toggle-vis", elementId: elem.id },
        title: isVisible ? "Hide" : "Show",
      }),
      el("span", { className: "layer-icon", textContent: info.icon }),
      el("span", {
        className: "layer-name",
        textContent: info.label + " " + elem.id.replace("el_", "#"),
      }),
      el("button", {
        className: "layer-btn layer-z",
        dataset: { action: "move-up", elementId: elem.id },
        title: "Move forward",
        textContent: "\u25B4",
      }),
      el("button", {
        className: "layer-btn layer-z",
        dataset: { action: "move-down", elementId: elem.id },
        title: "Move backward",
        textContent: "\u25BE",
      }),
    ]);
  }

  function refreshList() {
    if (!listEl) return;

    var doc = APP.state.document;
    var elements = (doc && doc.elements) || [];
    var hasGroup = APP.selection && APP.selection.hasGroup && APP.selection.hasGroup();
    var isGroupSelected = APP.selection && APP.selection.isGroupSelected && APP.selection.isGroupSelected();
    var groupMemberIds = hasGroup && APP.selection.getGroupMemberIds ? APP.selection.getGroupMemberIds() : [];

    // Clear
    listEl.innerHTML = "";

    if (elements.length === 0) {
      listEl.appendChild(
        el("div", { className: "layers-empty", textContent: "No shapes yet" })
      );
      return;
    }

    var grouped = [];
    var ungrouped = [];

    // Show top-most first (reverse of array order)
    for (var i = elements.length - 1; i >= 0; i--) {
      var elem = elements[i];
      if (hasGroup && groupMemberIds.indexOf(elem.id) !== -1) {
        grouped.push(elem);
      } else {
        ungrouped.push(elem);
      }
    }

    if (grouped.length > 0) {
      var groupBox = el("div", {
        className: "layer-group-box" + (isGroupSelected ? " selected" : ""),
        dataset: { groupId: "persistent_group" },
      });
      for (var g = 0; g < grouped.length; g++) {
        groupBox.appendChild(buildLayerItem(grouped[g], hasGroup, groupMemberIds));
      }
      listEl.appendChild(groupBox);
    }

    if (grouped.length > 0 && ungrouped.length > 0) {
      listEl.appendChild(el("div", { className: "layer-group-sep" }));
    }

    for (var u = 0; u < ungrouped.length; u++) {
      listEl.appendChild(buildLayerItem(ungrouped[u], hasGroup, groupMemberIds));
    }
  }

  // ─── Actions ────────────────────────────────────────────────────────

  function toggleVisibility(elementId) {
    var elem = APP.canvas.getElementById(elementId);
    if (!elem) return;

    if (APP.undoRedo) APP.undoRedo.push();
    elem.visible = (elem.visible === false) ? true : false;
    APP.state.isDirty = true;
    APP.canvas.updateElement(elementId);
    APP.emit("element-updated", elementId);
    refreshList();
  }

  function moveElement(elementId, direction) {
    var doc = APP.state.document;
    if (!doc || !doc.elements) return;

    var idx = -1;
    for (var i = 0; i < doc.elements.length; i++) {
      if (doc.elements[i].id === elementId) { idx = i; break; }
    }
    if (idx < 0) return;

    // "up" in visual list = higher z-order = move toward end of array
    var newIdx = direction === "up" ? idx + 1 : idx - 1;
    if (newIdx < 0 || newIdx >= doc.elements.length) return;

    if (APP.undoRedo) APP.undoRedo.push();
    var tmp = doc.elements[idx];
    doc.elements[idx] = doc.elements[newIdx];
    doc.elements[newIdx] = tmp;

    APP.state.isDirty = true;
    APP.canvas.render();
    refreshList();
  }

  // ─── Click delegation ──────────────────────────────────────────────

  function onPanelClick(e) {
    var btn = e.target.closest("[data-action]");
    if (btn) {
      var action = btn.dataset.action;
      var id = btn.dataset.elementId;
      if (action === "toggle-collapse") { toggleCollapse(); return; }
      if (action === "toggle-vis") { toggleVisibility(id); return; }
      if (action === "move-up")    { moveElement(id, "up"); return; }
      if (action === "move-down")  { moveElement(id, "down"); return; }
    }

    var groupBox = e.target.closest(".layer-group-box");
    if (groupBox && !e.target.closest(".layer-item")) {
      APP.selection.selectGroup();
      return;
    }

    // Click on item body -> select (shift = toggle in multi-select)
    var item = e.target.closest(".layer-item");
    if (item && item.dataset.elementId) {
      if (e.shiftKey || e.ctrlKey) {
        APP.selection.toggleIn(item.dataset.elementId);
      } else {
        APP.selection.select(item.dataset.elementId);
      }
    }
  }

  // ─── Collapse / expand ──────────────────────────────────────────────

  var COLLAPSE_KEY = "hud_shapes_panel_collapsed";

  function toggleCollapse() {
    if (!panelEl) return;
    var collapsed = !panelEl.classList.contains("collapsed");
    panelEl.classList.toggle("collapsed", collapsed);
    if (!collapsed) panelEl.classList.remove("hover-open");
    var btn = qs(".panel-toggle", panelEl);
    if (btn) btn.textContent = collapsed ? "\u25B8" : "\u25BE";
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : ""); } catch (e) { /* ignore */ }
  }

  function restoreCollapse() {
    if (!panelEl) return;
    var collapsed = false;
    try { collapsed = localStorage.getItem(COLLAPSE_KEY) === "1"; } catch (e) { /* ignore */ }
    panelEl.classList.toggle("collapsed", collapsed);
    if (!collapsed) panelEl.classList.remove("hover-open");
    var btn = qs(".panel-toggle", panelEl);
    if (btn) btn.textContent = collapsed ? "\u25B8" : "\u25BE";
  }

  // ─── Panel visibility ──────────────────────────────────────────────

  function showPanel() {
    if (!panelEl) return;
    panelEl.classList.add("visible");
    restorePanelPos(panelEl);
    restoreCollapse();
    refreshList();
  }

  function hidePanel() {
    if (panelEl) panelEl.classList.remove("visible");
  }

  // ─── Panel position persistence ────────────────────────────────────

  var POS_KEY = "hud_shapes_panel_pos";

  function savePanelPos(panel) {
    try {
      localStorage.setItem(POS_KEY, JSON.stringify({
        left: panel.style.left,
        top: panel.style.top,
      }));
    } catch (e) { /* ignore */ }
  }

  function restorePanelPos(panel) {
    var left = null;
    var top = 72;
    try {
      var saved = localStorage.getItem(POS_KEY);
      if (saved) {
        var pos = JSON.parse(saved);
        if (pos.left) left = parseFloat(pos.left);
        if (pos.top)  top  = parseFloat(pos.top) || 72;
      }
    } catch (e) { /* ignore */ }

    // Default: right side of editor
    var editorScreen = panel.closest('[data-screen="editor"]');
    if (left === null && editorScreen) {
      left = editorScreen.clientWidth - (panel.offsetWidth || 240) - 12;
    }
    if (left === null) left = 12;

    // Clamp to editor bounds
    if (editorScreen) {
      left = Math.max(0, Math.min(left, editorScreen.clientWidth  - (panel.offsetWidth  || 240)));
      top  = Math.max(0, Math.min(top,  editorScreen.clientHeight - (panel.offsetHeight || 80)));
    }

    panel.style.left  = left + "px";
    panel.style.top   = top  + "px";
    panel.style.right = "auto";
  }

  // ─── Panel header drag ─────────────────────────────────────────────

  var drag = { active: false, offX: 0, offY: 0, editorRect: null };

  function attachDragListener() {
    if (!panelEl) return;
    var header = qs(".panel-header", panelEl);
    if (!header || header.__hudShapesDragBound) return;
    header.__hudShapesDragBound = true;

    header.addEventListener("mousedown", function (e) {
      if (e.button !== 0) return;
      if (e.target.closest(".panel-toggle")) return;
      var editorScreen = panelEl.closest('[data-screen="editor"]');
      if (!editorScreen) return;
      var editorRect = editorScreen.getBoundingClientRect();
      var panelRect  = panelEl.getBoundingClientRect();

      drag.active = true;
      drag.offX = e.clientX - panelRect.left;
      drag.offY = e.clientY - panelRect.top;
      drag.editorRect = editorRect;

      panelEl.style.right = "auto";
      panelEl.style.left  = (panelRect.left - editorRect.left) + "px";
      panelEl.style.top   = (panelRect.top  - editorRect.top)  + "px";

      e.preventDefault();
    });

    document.addEventListener("mousemove", function (e) {
      if (!drag.active) return;
      var er = drag.editorRect;
      var x = e.clientX - drag.offX - er.left;
      var y = e.clientY - drag.offY - er.top;
      x = Math.max(0, Math.min(x, er.width  - panelEl.offsetWidth));
      y = Math.max(0, Math.min(y, er.height - panelEl.offsetHeight));
      panelEl.style.left = x + "px";
      panelEl.style.top  = y + "px";
    });

    document.addEventListener("mouseup", function () {
      if (drag.active) savePanelPos(panelEl);
      drag.active = false;
    });
  }

  function attachHoverOpenListener() {
    if (!panelEl || panelEl.__hudShapesHoverBound) return;
    panelEl.__hudShapesHoverBound = true;

    panelEl.addEventListener("mouseenter", function () {
      if (!isAutoOpenEnabled()) return;
      if (!panelEl.classList.contains("collapsed")) return;
      panelEl.classList.add("hover-open");
    });

    panelEl.addEventListener("mouseleave", function () {
      if (!panelEl.classList.contains("collapsed")) return;
      panelEl.classList.remove("hover-open");
    });
  }

  // ─── Mount into editor screen ──────────────────────────────────────

  function mount() {
    var root = APP.getRoot ? APP.getRoot() : document;
    var editorScreen = qs('[data-screen="editor"]', root);
    if (!editorScreen) return;
    if (qs("#shapes-panel", editorScreen)) return;

    var panel = buildPanel();
    editorScreen.appendChild(panel);
    panel.addEventListener("click", onPanelClick);
    attachDragListener();
    attachHoverOpenListener();
  }

  // ─── Events ────────────────────────────────────────────────────────

  APP.on("enter-edit", function () {
    setTimeout(function () { mount(); showPanel(); }, 0);
  });

  APP.on("document-created", function () {
    setTimeout(function () { mount(); showPanel(); }, 0);
  });

  APP.on("document-loaded", function () {
    setTimeout(function () { mount(); showPanel(); }, 0);
  });

  APP.on("exit-edit", function () {
    hidePanel();
  });

  APP.on("element-added",      function () { refreshList(); });
  APP.on("element-deleted",    function () { refreshList(); });
  APP.on("element-updated",    function () { refreshList(); });
  APP.on("selection-changed",  function () { refreshList(); });
  APP.on("group-activated",    function () { refreshList(); });
  APP.on("group-deactivated",  function () { refreshList(); });
  APP.on("auto-open-panels-changed", function (enabled) {
    if (!enabled && panelEl) panelEl.classList.remove("hover-open");
  });

})();

// --- 070-properties-panel.js ---
// 070-properties-panel.js - Properties editing UI + binding
(function hudEditorPropertiesPanel() {
  "use strict";

  var NS = "HudEditor";
  var APP = window[NS];
  if (!APP) return;

  var qs = APP.qs;
  var qsa = APP.qsa;

  function isAutoOpenEnabled() {
    return !!APP.state.autoOpenPanels;
  }

  function setColorButtonValue(button, hex) {
    if (!button) return;
    var color = String(hex || "#ffffff");
    button.dataset.colorHex = color;
    button.style.setProperty("--swatch-color", color);
    button.style.backgroundColor = color;
    button.style.backgroundImage = "none";
    var chip = qs(".color-swatch-chip, .prop-color-chip", button);
    if (chip) chip.style.background = color;
  }

  function getSelectedElement() {
    return APP.state.selectedElementId ? APP.canvas.getElementById(APP.state.selectedElementId) : null;
  }

  function getColorValueForProp(prop) {
    var element = getSelectedElement();
    if (!element) return [1, 1, 1, 1];
    if (prop === "fill") return Array.isArray(element.fill) ? element.fill.slice() : [1, 1, 1, 1];
    if (prop === "stroke") return Array.isArray(element.stroke) ? element.stroke.slice() : [1, 1, 1, 1];
    if (prop === "textColor") return Array.isArray(element.textColor) ? element.textColor.slice() : [1, 1, 1, 1];
    if (prop === "shadowColor") return Array.isArray(element.shadowColor) ? element.shadowColor.slice() : [0, 0, 0, 0];
    return [1, 1, 1, 1];
  }

  function openColorDialog(prop, rgba) {
    if (!prop) return;
    var value = Array.isArray(rgba) ? rgba.slice(0, 4) : getColorValueForProp(prop);
    APP.emit("color-dialog-open", {
      prop: prop,
      rgba: value
    });
  }

  // ─── Property sync: document → panel ───────────────────────────────

  function populatePanel(elementId) {
    var element = APP.canvas.getElementById(elementId);
    if (!element) {
      hidePanel();
      return;
    }

    var panel = qs("#properties-panel");
    if (!panel) return;

    panel.classList.add("visible");

    // Position X/Y
    var xInput = qs('[data-prop="x"]', panel);
    var yInput = qs('[data-prop="y"]', panel);
    var wInput = qs('[data-prop="w"]', panel);
    var hInput = qs('[data-prop="h"]', panel);
    var radiusInput = qs('[data-prop="radius"]', panel);
    var strokeWidthInput = qs('[data-prop="strokeWidth"]', panel);
    var textArea = qs('[data-prop="textLines"]', panel);
    var rotationInput = qs('[data-prop="rotation"]', panel);
    var shadowBlurInput = qs('[data-prop="shadowBlur"]', panel);
    var textSizeInput = qs('[data-prop="textSize"]', panel);
    var textAlignInput = qs('[data-prop="textAlign"]', panel);
    var imageSrcInput = qs('[data-prop="imageSrc"]', panel);

    if (xInput) xInput.value = Math.round(element.x);
    if (yInput) yInput.value = Math.round(element.y);
    if (wInput) wInput.value = Math.round(element.w);
    if (hInput) hInput.value = Math.round(element.h);
    if (rotationInput) rotationInput.value = String(Number(element.rotation) || 0);
    if (shadowBlurInput) shadowBlurInput.value = String(Number(element.shadowBlur) || 0);
    // Radius only applies to box / boxRounded
    var radiusRow = qs('[data-prop-row="radius"]', panel);
    var showRadius = (element.type === "box" || element.type === "boxRounded");
    if (radiusRow) radiusRow.style.display = showRadius ? "" : "none";
    var textRows = ["textLines", "textColor", "textSize", "textAlign"];
    textRows.forEach(function (rowName) {
      var row = qs('[data-prop-row="' + rowName + '"]', panel);
      if (row) row.style.display = element.type === "text" ? "" : "none";
    });
    var imageRow = qs('[data-prop-row="imageSrc"]', panel);
    if (imageRow) imageRow.style.display = element.type === "image" ? "" : "none";

    if (radiusInput && showRadius) setStepperValue(radiusInput, element.radius || 0);
    if (strokeWidthInput) setStepperValue(strokeWidthInput, element.strokeWidth || 0);
    if (textSizeInput) textSizeInput.value = String(Number(element.textSize) || 16);
    if (textAlignInput) textAlignInput.value = String(element.textAlign || "left");
    if (imageSrcInput) imageSrcInput.value = String(element.imageSrc || "");

    // Colors — update both panel and toolbar pickers
    var fillHex   = rgbaToHex(element.fill);
    var strokeHex = rgbaToHex(element.stroke);
    var textHex = rgbaToHex(element.textColor);
    var shadowHex = rgbaToHex(element.shadowColor);
    var fillInput = qs('[data-color-prop="fill"]', panel);
    var strokeInput = qs('[data-color-prop="stroke"]', panel);
    var textColorInput = qs('[data-color-prop="textColor"]', panel);
    var shadowColorInput = qs('[data-color-prop="shadowColor"]', panel);
    setColorButtonValue(fillInput, fillHex);
    setColorButtonValue(strokeInput, strokeHex);
    setColorButtonValue(textColorInput, textHex);
    setColorButtonValue(shadowColorInput, shadowHex);

    // Sync toolbar color pickers too
    var root = APP.getRoot ? APP.getRoot() : document;
    var toolbarFill   = qs('#editor-toolbar [data-color-prop="fill"]', root);
    var toolbarStroke = qs('#editor-toolbar [data-color-prop="stroke"]', root);
    setColorButtonValue(toolbarFill, fillHex);
    setColorButtonValue(toolbarStroke, strokeHex);

    // Text
    if (textArea) {
      var lines = element.textLines || [];
      textArea.value = Array.isArray(lines) ? lines.join("\n") : (lines || "");
    }
  }

  // ─── Property sync: panel → document ──────────────────────────────

  // Properties that should apply to all selected elements
  var MULTI_PROPS = {
    fill: 1,
    stroke: 1,
    strokeWidth: 1,
    rotation: 1,
    shadowBlur: 1,
    shadowColor: 1
  };

  function applyPanelChange(prop, value) {
    var elementId = APP.state.selectedElementId;
    if (!elementId) return;

    APP.emit("before-element-change");

    // Determine which elements to update
    var targetIds;
    if (MULTI_PROPS[prop]) {
      targetIds = (APP.state.selectedElementIds || []).slice();
      if (targetIds.length === 0) targetIds = [elementId];
    } else {
      targetIds = [elementId];
    }

    var changed = false;

    for (var t = 0; t < targetIds.length; t++) {
      var element = APP.canvas.getElementById(targetIds[t]);
      if (!element) continue;

      switch (prop) {
        case "x":
          element.x = parseFloat(value) || 0;
          changed = true;
          break;
        case "y":
          element.y = parseFloat(value) || 0;
          changed = true;
          break;
        case "w":
          element.w = Math.max(1, parseFloat(value) || 1);
          changed = true;
          break;
        case "h":
          element.h = Math.max(1, parseFloat(value) || 1);
          changed = true;
          break;
        case "radius":
          element.radius = Math.max(0, parseFloat(value) || 0);
          changed = true;
          break;
        case "strokeWidth":
          element.strokeWidth = Math.max(0, parseFloat(value) || 0);
          changed = true;
          break;
        case "rotation":
          element.rotation = parseFloat(value) || 0;
          changed = true;
          break;
        case "shadowBlur":
          element.shadowBlur = Math.max(0, parseFloat(value) || 0);
          changed = true;
          break;
        case "fill":
          element.fill = Array.isArray(value) ? value.slice(0, 4) : hexToRgba(value);
          changed = true;
          break;
        case "stroke":
          element.stroke = Array.isArray(value) ? value.slice(0, 4) : hexToRgba(value);
          changed = true;
          break;
        case "textColor":
          element.textColor = Array.isArray(value) ? value.slice(0, 4) : hexToRgba(value);
          changed = true;
          break;
        case "shadowColor":
          element.shadowColor = Array.isArray(value) ? value.slice(0, 4) : hexToRgba(value);
          changed = true;
          break;
        case "textLines":
          element.textLines = value.split("\n");
          changed = true;
          break;
        case "textSize":
          element.textSize = Math.max(1, parseFloat(value) || 1);
          changed = true;
          break;
        case "textAlign":
          element.textAlign = String(value || "left");
          changed = true;
          break;
        case "imageSrc":
          element.imageSrc = String(value || "");
          changed = true;
          break;
      }

      if (changed) {
        APP.canvas.updateElement(targetIds[t]);
      }
    }

    if (changed) {
      APP.state.isDirty = true;
      APP.emit("element-updated", elementId);
    }
  }

  // ─── Color conversion ─────────────────────────────────────────────

  function rgbaToHex(rgba) {
    if (!rgba || rgba.length < 4) return "#ffffff";
    var r = Math.round(rgba[0] * 255);
    var g = Math.round(rgba[1] * 255);
    var b = Math.round(rgba[2] * 255);
    return "#" +
      (r < 16 ? "0" : "") + r.toString(16) +
      (g < 16 ? "0" : "") + g.toString(16) +
      (b < 16 ? "0" : "") + b.toString(16);
  }

  function hexToRgba(hex) {
    hex = hex.replace("#", "");
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length !== 6) return [1, 1, 1, 1];
    var r = parseInt(hex.substr(0, 2), 16) / 255;
    var g = parseInt(hex.substr(2, 2), 16) / 255;
    var b = parseInt(hex.substr(4, 2), 16) / 255;
    return [r, g, b, 1];
  }

  // ─── Collapse / expand ─────────────────────────────────────────────

  var COLLAPSE_KEY = "hud_props_panel_collapsed";

  function toggleCollapse() {
    var panel = qs("#properties-panel");
    if (!panel) return;
    var collapsed = !panel.classList.contains("collapsed");
    panel.classList.toggle("collapsed", collapsed);
    if (!collapsed) panel.classList.remove("hover-open");
    var btn = qs(".panel-toggle", panel);
    if (btn) btn.textContent = collapsed ? "\u25B8" : "\u25BE";
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : ""); } catch (e) { /* ignore */ }
  }

  function restoreCollapse() {
    var panel = qs("#properties-panel");
    if (!panel) return;
    var collapsed = false;
    try { collapsed = localStorage.getItem(COLLAPSE_KEY) === "1"; } catch (e) { /* ignore */ }
    panel.classList.toggle("collapsed", collapsed);
    if (!collapsed) panel.classList.remove("hover-open");
    var btn = qs(".panel-toggle", panel);
    if (btn) btn.textContent = collapsed ? "\u25B8" : "\u25BE";
  }

  // ─── Panel visibility ─────────────────────────────────────────────

  function showPanel() {
    var panel = qs("#properties-panel");
    if (!panel) return;
    panel.classList.add("visible");
    restorePanelPos(panel);
    restoreCollapse();
  }

  function hidePanel() {
    var panel = qs("#properties-panel");
    if (panel) panel.classList.remove("visible");
  }

  // ─── Stepper value helper ─────────────────────────────────────────

  function setStepperValue(select, value) {
    // Try exact match first
    for (var i = 0; i < select.options.length; i++) {
      if (Number(select.options[i].value) === value) {
        select.selectedIndex = i;
        return;
      }
    }
    // Closest option
    var best = 0;
    var bestDiff = Infinity;
    for (var j = 0; j < select.options.length; j++) {
      var diff = Math.abs(Number(select.options[j].value) - value);
      if (diff < bestDiff) { bestDiff = diff; best = j; }
    }
    select.selectedIndex = best;
  }

  // ─── Input event handlers ─────────────────────────────────────────

  function onInputChange(e) {
    var input = e.target;
    var prop = input.dataset.prop;
    if (!prop) return;
    applyPanelChange(prop, input.value);
  }

  function onColorPicked(payload) {
    if (!payload || !payload.prop) return;
    var value = Array.isArray(payload.rgba) ? payload.rgba : payload.value;
    if (!value) return;
    applyPanelChange(payload.prop, value);
    if (APP.state.selectedElementId) {
      populatePanel(APP.state.selectedElementId);
    }
  }

  function onStepperClick(e) {
    var btn = e.target.closest(".stepper-dec, .stepper-inc");
    if (!btn) return;
    var prop = btn.dataset.stepperProp;
    if (!prop) return;
    var panel = qs("#properties-panel");
    var select = panel && qs('.stepper-select[data-prop="' + prop + '"]', panel);
    if (!select) return;
    var dir = btn.classList.contains("stepper-inc") ? 1 : -1;
    var newIdx = select.selectedIndex + dir;
    newIdx = Math.max(0, Math.min(newIdx, select.options.length - 1));
    select.selectedIndex = newIdx;
    applyPanelChange(prop, select.value);
  }

  function onStepperChange(e) {
    var select = e.target;
    if (!select.classList.contains("stepper-select")) return;
    var prop = select.dataset.prop;
    if (!prop) return;
    applyPanelChange(prop, select.value);
  }

  function onSelectChange(e) {
    var select = e.target;
    if (!select || select.classList.contains("stepper-select")) return;
    if (!select.dataset || !select.dataset.prop) return;
    applyPanelChange(select.dataset.prop, select.value);
  }

  // ─── Panel position persistence ───────────────────────────────────────

  var POS_KEY = "hud_props_panel_pos";

  function savePanelPos(panel) {
    try {
      localStorage.setItem(POS_KEY, JSON.stringify({ left: panel.style.left, top: panel.style.top }));
    } catch (e) {}
  }

  function restorePanelPos(panel) {
    var left = 12, top = 72;
    try {
      var saved = localStorage.getItem(POS_KEY);
      if (saved) {
        var pos = JSON.parse(saved);
        if (pos.left) left = parseFloat(pos.left) || 12;
        if (pos.top)  top  = parseFloat(pos.top)  || 72;
        // Clamp to editor bounds so a stale position can't hide the panel
        var editorScreen = panel.closest('[data-screen="editor"]');
        if (editorScreen) {
          left = Math.max(0, Math.min(left, editorScreen.clientWidth  - (panel.offsetWidth  || 340)));
          top  = Math.max(0, Math.min(top,  editorScreen.clientHeight - (panel.offsetHeight || 80)));
        }
      }
    } catch (e) {}
    // Always set position — defaults (12, 72) when no stored data
    panel.style.left  = left + "px";
    panel.style.top   = top  + "px";
    panel.style.right = "auto";
  }

  // ─── Panel drag ──────────────────────────────────────────────────────

  var drag = { active: false, offX: 0, offY: 0, editorRect: null };

  function attachDragListener() {
    var panel = qs("#properties-panel");
    var header = panel && qs(".panel-header", panel);
    if (!header || header.__hudPanelDragBound) return;
    header.__hudPanelDragBound = true;

    header.addEventListener("mousedown", function (e) {
      if (e.button !== 0) return;
      if (e.target.closest(".panel-toggle")) return;
      var editorScreen = panel.closest('[data-screen="editor"]');
      if (!editorScreen) return;
      var editorRect = editorScreen.getBoundingClientRect();
      var panelRect  = panel.getBoundingClientRect();

      drag.active = true;
      drag.offX = e.clientX - panelRect.left;
      drag.offY = e.clientY - panelRect.top;
      drag.editorRect = editorRect;

      // Panel is left-anchored by default; normalise on drag start
      panel.style.right = "auto";
      panel.style.left  = (panelRect.left - editorRect.left) + "px";
      panel.style.top   = (panelRect.top  - editorRect.top)  + "px";

      e.preventDefault();
    });

    document.addEventListener("mousemove", function (e) {
      if (!drag.active) return;
      var er = drag.editorRect;
      var x = e.clientX - drag.offX - er.left;
      var y = e.clientY - drag.offY - er.top;
      x = Math.max(0, Math.min(x, er.width  - panel.offsetWidth));
      y = Math.max(0, Math.min(y, er.height - panel.offsetHeight));
      panel.style.left = x + "px";
      panel.style.top  = y + "px";
    });

    document.addEventListener("mouseup", function () {
      if (drag.active) savePanelPos(panel);
      drag.active = false;
    });
  }

  function attachHoverOpenListener() {
    var panel = qs("#properties-panel");
    if (!panel || panel.__hudPropsHoverBound) return;
    panel.__hudPropsHoverBound = true;

    panel.addEventListener("mouseenter", function () {
      if (!isAutoOpenEnabled()) return;
      if (!panel.classList.contains("collapsed")) return;
      panel.classList.add("hover-open");
    });

    panel.addEventListener("mouseleave", function () {
      if (!panel.classList.contains("collapsed")) return;
      panel.classList.remove("hover-open");
    });
  }

  // ─── Toolbar color picker sync ─────────────────────────────────────

  function attachToolbarColorListeners() {
    var root = APP.getRoot ? APP.getRoot() : document;
    var toolbar = qs("#editor-toolbar", root);
    if (!toolbar || toolbar.__hudToolbarColorBound) return;
    toolbar.__hudToolbarColorBound = true;

    toolbar.addEventListener("click", function (e) {
      var button = e.target.closest("[data-color-prop]");
      if (!button) return;
      var prop = button.dataset.colorProp;
      if (prop !== "fill" && prop !== "stroke") return;
      openColorDialog(prop);
    });
  }

  function onPanelColorClick(e) {
    var button = e.target.closest("#properties-panel [data-color-prop]");
    if (!button) return;
    var prop = button.dataset.colorProp;
    if (prop !== "fill" && prop !== "stroke") return;
    openColorDialog(prop);
  }

  // ─── Attach panel events ───────────────────────────────────────────

  function attachPanelListeners() {
    var panel = qs("#properties-panel");
    if (!panel) return;

    // Number/text inputs
    var inputs = qsa("input[data-prop]", panel);
    inputs.forEach(function (input) {
      input.removeEventListener("input", onInputChange);
      input.addEventListener("input", onInputChange);
    });

    // Textarea
    var textareas = qsa("textarea[data-prop]", panel);
    textareas.forEach(function (ta) {
      ta.removeEventListener("input", onInputChange);
      ta.addEventListener("input", onInputChange);
    });

    // Stepper clicks (+/−) and select changes — use delegation on panel
    panel.removeEventListener("click", onPanelColorClick);
    panel.removeEventListener("click",  onStepperClick);
    panel.removeEventListener("change", onStepperChange);
    panel.removeEventListener("change", onSelectChange);
    panel.addEventListener("click", onPanelColorClick);
    panel.addEventListener("click",  onStepperClick);
    panel.addEventListener("change", onStepperChange);
    panel.addEventListener("change", onSelectChange);
  }

  // ─── Event listeners ──────────────────────────────────────────────

  APP.on("selection-changed", function (elementId) {
    if (elementId) {
      populatePanel(elementId);
      showPanel();
      attachPanelListeners();
      attachDragListener();
    } else {
      hidePanel();
    }
  });

  APP.on("enter-edit", function () {
    setTimeout(function () {
      attachPanelListeners();
      attachDragListener();
      attachHoverOpenListener();
      attachToolbarColorListeners();
    }, 200);
  });

  APP.on("element-updated", function (elementId) {
    if (elementId === APP.state.selectedElementId) {
      populatePanel(elementId);
    }
  });

  APP.on("color-picked", onColorPicked);

  APP.on("toggle-props-collapse", function () {
    toggleCollapse();
  });

  APP.on("auto-open-panels-changed", function (enabled) {
    var panel = qs("#properties-panel");
    if (!enabled && panel) panel.classList.remove("hover-open");
  });

})();

// --- 080-bridge-commands.js ---
// 080-bridge-commands.js - Ingame bridge via the live Lua editor page
(function hudEditorBridgeCommands() {
  "use strict";

  var NS = "HudEditor";
  var APP = window[NS];
  if (!APP) return;

  var UNIT_SLOT_NAME = "unit";
  var UNIT_FILTER_NAME = "onStart()";
  var BOOT_DOC_MARKER = "local HUD_EDITOR_BOOT_DOCUMENT =";
  var SELECT_POLL_MS = 25;
  var SELECT_MAX_ROUNDS = 120;

  function getLuaEditorRoot() {
    return document.getElementById("dpu_editor");
  }

  function isElementVisible(node) {
    if (!node) return false;
    if (node.style && node.style.display === "none") return false;
    return node.offsetParent !== null || node === document.activeElement;
  }

  function getLuaEditorManager() {
    return window.LUAEditorManager || null;
  }

  function hasLuaEditorBridge() {
    var manager = getLuaEditorManager();
    return !!(
      manager &&
      typeof manager.setCodeLuaEditor === "function" &&
      typeof manager.apply === "function"
    );
  }

  function getEditorStatus() {
    var selection = getCurrentSelection();
    var visible = isElementVisible(getLuaEditorRoot());
    var available = hasLuaEditorBridge();
    return {
      available: available,
      visible: visible,
      selectedSlot: selection.slot,
      selectedFilter: selection.filter,
      canAccessOnStart: !!(available && visible)
    };
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function getSlotNodes() {
    var root = getLuaEditorRoot();
    if (!root || !root.querySelectorAll) return [];
    var nodes = root.querySelectorAll("#slots_container .slot");
    var result = [];
    for (var i = 0; i < nodes.length; i += 1) {
      if (nodes[i] && !(nodes[i].classList && nodes[i].classList.contains("slotTemplate"))) {
        result.push(nodes[i]);
      }
    }
    return result;
  }

  function getFilterNodes() {
    var root = getLuaEditorRoot();
    if (!root || !root.querySelectorAll) return [];
    var nodes = root.querySelectorAll("#filters_container .filter");
    var result = [];
    for (var i = 0; i < nodes.length; i += 1) {
      if (!nodes[i] || (nodes[i].classList && nodes[i].classList.contains("filterTemplate"))) {
        continue;
      }
      if (nodes[i].classList && !nodes[i].classList.contains("view")) {
        continue;
      }
      result.push(nodes[i]);
    }
    return result;
  }

  function getSlotName(node) {
    if (!node || !node.querySelector) return "";
    var input = node.querySelector("input");
    return String(input ? (input.value || input.placeholder || input.textContent || "") : (node.textContent || "")).trim();
  }

  function getFilterEventName(node) {
    if (!node || !node.querySelector) return "";
    var label = node.querySelector(".actionName");
    return String(label ? (label.textContent || "") : "").trim();
  }

  function isSelectedNode(node) {
    if (!node || !node.classList) return false;
    return node.classList.contains("selected") ||
      node.classList.contains("active") ||
      node.classList.contains("current");
  }

  function clickNode(node) {
    if (!node) return false;
    try {
      if (typeof node.click === "function") {
        node.click();
        return true;
      }
      if (typeof MouseEvent === "function" && typeof node.dispatchEvent === "function") {
        node.dispatchEvent(new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window
        }));
        return true;
      }
    } catch (_ignoreClick) {}
    return false;
  }

  function findSlotNodeByName(slotName) {
    var wanted = normalizeText(slotName);
    var slots = getSlotNodes();
    var fallback = null;
    for (var i = 0; i < slots.length; i += 1) {
      var current = normalizeText(getSlotName(slots[i]));
      if (!current) continue;
      if (current === wanted) return slots[i];
      if (!fallback && current.indexOf(wanted) >= 0) fallback = slots[i];
    }
    return fallback;
  }

  function normalizeFilterKey(name) {
    return normalizeText(name).replace(/\([^)]*\)/g, "").replace(/\s+/g, "");
  }

  function findFilterNodeByEvent(filterName) {
    var wanted = normalizeFilterKey(filterName);
    var filters = getFilterNodes();
    var fallback = null;
    for (var i = 0; i < filters.length; i += 1) {
      var current = normalizeFilterKey(getFilterEventName(filters[i]));
      if (!current) continue;
      if (current === wanted) return filters[i];
      if (!fallback && current.indexOf(wanted) >= 0) fallback = filters[i];
    }
    return fallback;
  }

  function getCurrentSelection() {
    var manager = getLuaEditorManager();
    var currentData = manager && manager.currentData ? manager.currentData : null;
    var currentSlot = currentData && currentData.currentSlot ? currentData.currentSlot : null;
    var currentFilter = currentData && currentData.currentFilter ? currentData.currentFilter : null;
    return {
      slot: currentSlot && currentSlot.name ? String(currentSlot.name) : null,
      filter: currentFilter && (currentFilter.signature || currentFilter.name) ? String(currentFilter.signature || currentFilter.name) : null
    };
  }

  function pollUntil(stepFn, onDone, timeoutMessage) {
    var round = 0;
    function tick() {
      var outcome = false;
      try {
        outcome = !!stepFn();
      } catch (err) {
        onDone(err);
        return;
      }
      if (outcome) {
        onDone(null);
        return;
      }
      round += 1;
      if (round >= SELECT_MAX_ROUNDS) {
        onDone(new Error(timeoutMessage || "timed out"));
        return;
      }
      window.setTimeout(tick, SELECT_POLL_MS);
    }
    tick();
  }


  function ensureUnitOnStartSelected(onDone) {
    if (!hasLuaEditorBridge()) {
      onDone(new Error("lua editor bridge unavailable"));
      return;
    }
    var root = getLuaEditorRoot();
    if (!isElementVisible(root)) {
      onDone(new Error("lua editor not visible"));
      return;
    }

    function ensureFilter() {
      pollUntil(function () {
        var selection = getCurrentSelection();
        if (normalizeText(selection.slot) !== normalizeText(UNIT_SLOT_NAME)) {
          return false;
        }
        if (normalizeFilterKey(selection.filter) === normalizeFilterKey(UNIT_FILTER_NAME)) {
          return true;
        }
        var filterNode = findFilterNodeByEvent(UNIT_FILTER_NAME);
        if (!filterNode) return false;
        clickNode(filterNode);
        return normalizeFilterKey(getCurrentSelection().filter) === normalizeFilterKey(UNIT_FILTER_NAME);
      }, onDone, "unit.onStart selection not observed");
    }

    pollUntil(function () {
      var selection = getCurrentSelection();
      if (normalizeText(selection.slot) === normalizeText(UNIT_SLOT_NAME)) {
        return true;
      }
      var slotNode = findSlotNodeByName(UNIT_SLOT_NAME);
      if (!slotNode) return false;
      clickNode(slotNode);
      return normalizeText(getCurrentSelection().slot) === normalizeText(UNIT_SLOT_NAME);
    }, function (err) {
      if (err) {
        onDone(err);
        return;
      }
      ensureFilter();
    }, "unit slot selection not observed");
  }

  function getCurrentFilterCode() {
    var manager = getLuaEditorManager();
    var currentData = manager && manager.currentData ? manager.currentData : null;
    var currentFilter = currentData && currentData.currentFilter ? currentData.currentFilter : null;
    if (currentFilter && typeof currentFilter.code === "string") {
      return currentFilter.code;
    }
    try {
      if (manager && typeof manager.getCodeLuaEditor === "function") {
        return String(manager.getCodeLuaEditor() || "");
      }
    } catch (_ignoreGetCode) {}
    try {
      if (manager && typeof manager.getLuaEditor === "function") {
        var codeMirror = manager.getLuaEditor();
        if (codeMirror && typeof codeMirror.getValue === "function") {
          return String(codeMirror.getValue() || "");
        }
      }
    } catch (_ignoreCodeMirror) {}
    return "";
  }

  function extractBootDocumentTable(code) {
    var source = String(code || "");
    var markerIndex = source.indexOf(BOOT_DOC_MARKER);
    if (markerIndex < 0) return null;

    var start = markerIndex + BOOT_DOC_MARKER.length;
    while (start < source.length && /\s/.test(source.charAt(start))) {
      start += 1;
    }
    if (source.charAt(start) !== "{") return null;

    var depth = 0;
    var quote = "";
    var escaping = false;
    for (var i = start; i < source.length; i += 1) {
      var ch = source.charAt(i);
      if (quote) {
        if (escaping) {
          escaping = false;
        } else if (ch === "\\") {
          escaping = true;
        } else if (ch === quote) {
          quote = "";
        }
        continue;
      }
      if (ch === "\"" || ch === "'") {
        quote = ch;
        continue;
      }
      if (ch === "{") {
        depth += 1;
      } else if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          return source.slice(start, i + 1);
        }
      }
    }
    return null;
  }

  function createLuaTableParser(text) {
    var source = String(text || "");
    var index = 0;

    function error(message) {
      throw new Error(message + " at " + index);
    }

    function peek() {
      return source.charAt(index);
    }

    function skipWhitespace() {
      while (index < source.length && /\s/.test(source.charAt(index))) {
        index += 1;
      }
    }

    function consume(expected) {
      skipWhitespace();
      if (source.charAt(index) !== expected) {
        error("expected " + expected);
      }
      index += 1;
    }

    function parseString() {
      skipWhitespace();
      var quote = source.charAt(index);
      if (quote !== "\"" && quote !== "'") {
        error("expected string");
      }
      index += 1;
      var out = "";
      var escaping = false;
      while (index < source.length) {
        var ch = source.charAt(index);
        index += 1;
        if (escaping) {
          if (ch === "n") out += "\n";
          else if (ch === "r") out += "\r";
          else if (ch === "t") out += "\t";
          else out += ch;
          escaping = false;
          continue;
        }
        if (ch === "\\") {
          escaping = true;
          continue;
        }
        if (ch === quote) {
          return out;
        }
        out += ch;
      }
      error("unterminated string");
    }

    function parseNumber() {
      skipWhitespace();
      var match = source.slice(index).match(/^-?(?:\d+\.\d+|\d+|\.\d+)(?:[eE][+-]?\d+)?/);
      if (!match) error("expected number");
      index += match[0].length;
      return Number(match[0]);
    }

    function parseIdentifier() {
      skipWhitespace();
      var match = source.slice(index).match(/^[A-Za-z_][A-Za-z0-9_]*/);
      if (!match) error("expected identifier");
      index += match[0].length;
      return match[0];
    }

    function parseValue() {
      skipWhitespace();
      var ch = peek();
      if (ch === "{") return parseTable();
      if (ch === "\"" || ch === "'") return parseString();
      if (ch === "-" || ch === "." || /\d/.test(ch)) return parseNumber();

      var ident = parseIdentifier();
      if (ident === "true") return true;
      if (ident === "false") return false;
      if (ident === "nil" || ident === "null") return null;
      return ident;
    }

    function tryParseKeyValue() {
      skipWhitespace();
      var start = index;
      var key = null;

      if (peek() === "[") {
        index += 1;
        key = parseValue();
        skipWhitespace();
        if (peek() !== "]") {
          index = start;
          return null;
        }
        index += 1;
      } else {
        var match = source.slice(index).match(/^[A-Za-z_][A-Za-z0-9_]*/);
        if (!match) {
          return null;
        }
        key = match[0];
        index += match[0].length;
      }

      skipWhitespace();
      if (peek() !== "=") {
        index = start;
        return null;
      }
      index += 1;
      return {
        key: String(key),
        value: parseValue()
      };
    }

    function parseTable() {
      consume("{");
      var array = [];
      var object = {};
      var hasArray = false;
      var hasObject = false;

      while (index < source.length) {
        skipWhitespace();
        if (peek() === "}") {
          index += 1;
          break;
        }

        var pair = tryParseKeyValue();
        if (pair) {
          object[pair.key] = pair.value;
          hasObject = true;
        } else {
          array.push(parseValue());
          hasArray = true;
        }

        skipWhitespace();
        if (peek() === "," || peek() === ";") {
          index += 1;
        }
      }

      if (hasObject && !hasArray) return object;
      if (hasArray && !hasObject) return array;
      for (var i = 0; i < array.length; i += 1) {
        object[String(i + 1)] = array[i];
      }
      return object;
    }

    return {
      parse: function () {
        var value = parseValue();
        skipWhitespace();
        return value;
      }
    };
  }

  function parseBootDocumentFromCode(code) {
    var tableText = extractBootDocumentTable(code);
    if (!tableText) return null;
    var parser = createLuaTableParser(tableText);
    var doc = parser.parse();
    return normalizeDocument(doc);
  }

  function toArray(value) {
    if (Array.isArray(value)) return value.slice();
    if (!value || typeof value !== "object") return [];
    var keys = Object.keys(value).filter(function (key) {
      return /^\d+$/.test(key);
    }).sort(function (a, b) {
      return Number(a) - Number(b);
    });
    return keys.map(function (key) {
      return value[key];
    });
  }

  function toFiniteNumber(value, fallback) {
    var num = Number(value);
    return isFinite(num) ? num : fallback;
  }

  function normalizeColor(value, fallback) {
    var arr = toArray(value);
    if (!arr.length) return fallback.slice();
    return [
      toFiniteNumber(arr[0], fallback[0]),
      toFiniteNumber(arr[1], fallback[1]),
      toFiniteNumber(arr[2], fallback[2]),
      toFiniteNumber(arr[3], fallback[3])
    ];
  }

  function normalizeTextLines(value) {
    return toArray(value).map(function (line) {
      return String(line == null ? "" : line);
    });
  }

  function normalizeElement(raw, index) {
    if (!raw || typeof raw !== "object") return null;
    var type = String(raw.type || "box");
    if (type === "rounded") type = "boxRounded";
    return {
      id: raw.id ? String(raw.id) : ("element_" + (index + 1)),
      type: type,
      visible: raw.visible !== false,
      x: toFiniteNumber(raw.x, 0),
      y: toFiniteNumber(raw.y, 0),
      w: toFiniteNumber(raw.w, 120),
      h: toFiniteNumber(raw.h, 80),
      radius: toFiniteNumber(raw.radius, 0),
      fill: normalizeColor(raw.fill, [0.22, 0.24, 0.28, 0.92]),
      stroke: normalizeColor(raw.stroke, [0.82, 0.84, 0.88, 1]),
      strokeWidth: toFiniteNumber(raw.strokeWidth, 2),
      textLines: normalizeTextLines(raw.textLines),
      textColor: normalizeColor(raw.textColor, [1, 1, 1, 1]),
      textSize: toFiniteNumber(raw.textSize, 16),
      textAlign: raw.textAlign ? String(raw.textAlign) : "left",
      rotation: toFiniteNumber(raw.rotation, 0),
      shadowBlur: toFiniteNumber(raw.shadowBlur, 0),
      shadowColor: normalizeColor(raw.shadowColor, [0, 0, 0, 0]),
      imageSrc: raw.imageSrc ? String(raw.imageSrc) : "",
      imageFit: raw.imageFit ? String(raw.imageFit) : "contain",
      quadInset: toFiniteNumber(raw.quadInset, 0.125)
    };
  }

  function normalizeDocument(raw) {
    if (!raw || typeof raw !== "object") return null;
    var elements = toArray(raw.elements).map(function (element, index) {
      return normalizeElement(element, index);
    }).filter(Boolean);
    return APP.normalizeDocumentMeta({
      version: toFiniteNumber(raw.version, 1),
      revision: toFiniteNumber(raw.revision, 1),
      id: raw.id != null ? String(raw.id) : "",
      screenWidth: toFiniteNumber(raw.screenWidth, 1920),
      screenHeight: toFiniteNumber(raw.screenHeight, 1080),
      elements: elements,
      name: raw.name ? String(raw.name) : "Current Board Layout"
    });
  }

  function emitBoardError(message) {
    APP.emit("board-error", { message: message });
  }

  function emitCurrentList(doc) {
    var scripts = [];
    if (doc) {
      scripts.push({
        id: doc.id,
        name: doc.name || "Current Board Layout",
        modified: Number(doc.revision || 0)
      });
    }
    APP.emit("board-list", { scripts: scripts });
  }

  function loadCurrentDocument(eventName, failurePrefix) {
    ensureUnitOnStartSelected(function (err) {
      if (err) {
        emitBoardError(err.message || String(err));
        if (eventName === "board-load") {
          APP.emit("board-load", { document: null, error: err.message || String(err) });
        }
        return;
      }

      var code = getCurrentFilterCode();
      var doc = null;
      try {
        doc = parseBootDocumentFromCode(code);
      } catch (parseErr) {
        emitBoardError(parseErr.message || String(parseErr));
        if (eventName === "board-load") {
          APP.emit("board-load", { document: null, error: parseErr.message || String(parseErr) });
        }
        return;
      }

      if (!doc) {
        if (eventName === "board-list") {
          emitCurrentList(null);
        } else if (eventName === "board-load") {
          APP.emit("board-load", { document: null, error: failurePrefix || "no boot document found" });
        } else if (eventName === "board-sync") {
          APP.emit("board-sync", {
            mode: "start",
            selectedId: null,
            isDirty: false,
            revision: 0,
            document: null
          });
        }
        return;
      }

      if (eventName === "board-list") {
        emitCurrentList(doc);
      } else if (eventName === "board-load") {
        APP.emit("board-load", { document: doc });
      } else if (eventName === "board-sync") {
        APP.emit("board-sync", {
          mode: "loaded",
          selectedId: null,
          isDirty: false,
          revision: Number(doc.revision || 0),
          document: doc
        });
      }
    });
  }

  function saveCurrentDocument() {
    ensureUnitOnStartSelected(function (err) {
      if (err) {
        emitBoardError(err.message || String(err));
        APP.emit("board-save", { ok: false });
        return;
      }

      if (!APP.ideExport || typeof APP.ideExport.buildBoardOnStartCode !== "function") {
        emitBoardError("board export unavailable");
        APP.emit("board-save", { ok: false });
        return;
      }

      var doc = APP.state && APP.state.document ? APP.state.document : null;
      if (!doc) {
        emitBoardError("no document to save");
        APP.emit("board-save", { ok: false });
        return;
      }

      var manager = getLuaEditorManager();
      var closedHudForApply = false;
      try {
        manager.setCodeLuaEditor(APP.ideExport.buildBoardOnStartCode(doc));
        if (APP.state && APP.state.editModeActive && typeof APP.exitEditMode === "function") {
          APP.exitEditMode();
          if (typeof APP.updateToggleButton === "function") {
            APP.updateToggleButton();
          }
          closedHudForApply = true;
        }
        manager.apply();
        APP.emit("board-save", {
          ok: true,
          reopened: false,
          hudClosed: closedHudForApply
        });
      } catch (saveErr) {
        if (closedHudForApply && typeof APP.enterEditMode === "function") {
          APP.enterEditMode();
          if (typeof APP.updateToggleButton === "function") {
            APP.updateToggleButton();
          }
        }
        emitBoardError(saveErr && saveErr.message ? saveErr.message : String(saveErr));
        APP.emit("board-save", { ok: false });
      }
    });
  }

  APP.bridge = {
    isAvailable: hasLuaEditorBridge,
    getEditorStatus: getEditorStatus,
    ping: function () {
      APP.emit("board-pong", { version: "lua-editor-bridge" });
      return true;
    },
    sync: function () {
      loadCurrentDocument("board-sync", "no boot document found");
      return true;
    },
    newDocument: function (_screenW, _screenH) {
      return true;
    },
    loadDocument: function (_scriptId) {
      loadCurrentDocument("board-load", "no boot document found");
      return true;
    },
    saveDocument: function () {
      saveCurrentDocument();
      return true;
    },
    listScripts: function () {
      loadCurrentDocument("board-list", "no boot document found");
      return true;
    },
    pollOutput: function () { return null; },
    handleResponse: function () { return null; }
  };
})();

// --- 082-shape-snippets.js ---
// 082-shape-snippets.js - Shared snippet catalog for reproducible HUD shape demos
(function hudEditorShapeSnippets() {
  "use strict";

  var NS = "HudEditor";
  var APP = window[NS];
  if (!APP) return;

  var DEFAULT_IMAGE_PATH = "resources_generated/env/voxel/ore/aluminium-ore/icons/env_aluminium-ore_icon.png";
  var COLOR_SEQUENCE = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
    [0, 1, 1],
    [1, 0, 1],
    [1, 1, 0],
    [0.5, 0.5, 0.5]
  ];

  function deepCopy(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function docFromRecipe(recipe) {
    var doc = {
      version: 1,
      revision: 1,
      id: String(recipe.id || APP.createLayoutId()),
      name: String(recipe.name || recipe.title || "Snippet"),
      screenWidth: recipe.screenWidth || 1920,
      screenHeight: recipe.screenHeight || 1080,
      elements: Array.isArray(recipe.elements) ? deepCopy(recipe.elements) : []
    };
    return APP.normalizeDocumentMeta ? APP.normalizeDocumentMeta(doc) : doc;
  }

  function elem(id, type, x, y, w, h, extra) {
    var base = {
      id: id,
      type: type,
      visible: true,
      x: x,
      y: y,
      w: w,
      h: h,
      radius: 0,
      fill: [0.12, 0.14, 0.18, 0.92],
      stroke: [0.86, 0.9, 0.96, 1],
      strokeWidth: 3,
      textLines: null,
      textColor: [1, 1, 1, 1],
      textSize: 18,
      textAlign: "center",
      rotation: 0,
      shadowBlur: 0,
      shadowColor: [0, 0, 0, 0],
      imageSrc: "",
      imageFit: "contain",
      quadInset: 0.125
    };
    if (extra) {
      Object.keys(extra).forEach(function (key) {
        base[key] = extra[key];
      });
    }
    return base;
  }

  function addAlpha(index, alpha) {
    var source = COLOR_SEQUENCE[(index - 1) % COLOR_SEQUENCE.length];
    return [source[0], source[1], source[2], alpha == null ? 1 : alpha];
  }

  function createStyledState(size, colorIndex, rotation) {
    return {
      size: size,
      colorIndex: colorIndex || 1,
      rotation: rotation || 0
    };
  }

  function takeStyle(state, alpha) {
    var currentAlpha = alpha == null ? 1 : alpha;
    var fill = addAlpha(state.colorIndex, currentAlpha);
    state.colorIndex = state.colorIndex % COLOR_SEQUENCE.length + 1;
    var shadowColor = addAlpha(state.colorIndex, currentAlpha);
    state.colorIndex = state.colorIndex % COLOR_SEQUENCE.length + 1;
    var stroke = addAlpha(state.colorIndex, currentAlpha);
    state.colorIndex = state.colorIndex % COLOR_SEQUENCE.length + 1;
    return {
      fill: fill,
      rotation: state.rotation,
      shadowBlur: state.size / 4,
      shadowColor: shadowColor,
      stroke: stroke,
      strokeWidth: state.size / 8
    };
  }

  function defaultPrimitiveStyle(type, size) {
    if (type === "line" || type === "bezierArc") {
      return {
        fill: [0, 0, 0, 0],
        stroke: [0.92, 0.92, 0.94, 1],
        strokeWidth: size / 28,
        rotation: 0,
        shadowBlur: 0,
        shadowColor: [0, 0, 0, 0]
      };
    }
    if (type === "text") {
      return {
        fill: [0, 0, 0, 0],
        textColor: [0.92, 0.92, 0.94, 1],
        stroke: [0, 0, 0, 0],
        strokeWidth: 0,
        rotation: 0,
        shadowBlur: 0,
        shadowColor: [0, 0, 0, 0]
      };
    }
    if (type === "image") {
      return {
        fill: [0, 0, 0, 0],
        stroke: [0, 0, 0, 0],
        strokeWidth: 0,
        rotation: 0,
        shadowBlur: 0,
        shadowColor: [0, 0, 0, 0]
      };
    }
    return {
      fill: [0.94, 0.94, 0.95, 1],
      stroke: [0.76, 0.78, 0.82, 0.2],
      strokeWidth: size / 48,
      rotation: 0,
      shadowBlur: 0,
      shadowColor: [0, 0, 0, 0]
    };
  }

  function squareElement(id, type, x, y, size, style, extra) {
    var props = {
      rotation: style.rotation || 0,
      shadowBlur: style.shadowBlur || 0,
      shadowColor: deepCopy(style.shadowColor || [0, 0, 0, 0]),
      quadInset: extra && extra.quadInset != null ? extra.quadInset : 0.125
    };
    if (type === "text") {
      props.fill = [0, 0, 0, 0];
      props.stroke = deepCopy(style.stroke || [0, 0, 0, 0]);
      props.strokeWidth = style.strokeWidth || 0;
      props.textLines = [extra && extra.text || "E"];
      props.textColor = deepCopy(style.textColor || style.fill || [1, 1, 1, 1]);
      props.textSize = extra && extra.textSize != null ? extra.textSize : (size * 1.4);
      props.textAlign = "center";
    } else if (type === "image") {
      props.fill = deepCopy(style.fill || [0, 0, 0, 0]);
      props.stroke = deepCopy(style.stroke || [0, 0, 0, 0]);
      props.strokeWidth = style.strokeWidth || 0;
      props.imageSrc = extra && extra.imageSrc || DEFAULT_IMAGE_PATH;
      props.imageFit = "contain";
    } else if (type === "line" || type === "bezierArc") {
      props.fill = [0, 0, 0, 0];
      props.stroke = deepCopy(style.stroke || [1, 1, 1, 1]);
      props.strokeWidth = style.strokeWidth || 0;
    } else {
      props.fill = deepCopy(style.fill || [1, 1, 1, 1]);
      props.stroke = deepCopy(style.stroke || [0, 0, 0, 0]);
      props.strokeWidth = style.strokeWidth || 0;
    }
    if (type === "boxRounded") {
      props.radius = extra && extra.radius != null ? extra.radius : (size / 4);
    }
    if (extra) {
      Object.keys(extra).forEach(function (key) {
        props[key] = extra[key];
      });
    }
    return elem(id, type, x, y, size, size, props);
  }

  function buildShapesLuaDemoRecipe() {
    var screenWidth = 1920;
    var screenHeight = 1080;
    var rowCount = 4;
    var shapeCount = 9;
    var size = Math.min(screenHeight / rowCount / 2, screenWidth / shapeCount / 2);
    var elements = [];
    var styleDefaults = {};
    var xStep;
    var xOff;
    var yOff;

    function resetRow(step, xStart, yStart) {
      xStep = step;
      xOff = xStart;
      yOff = yStart;
    }

    function nextX() {
      var current = xOff;
      xOff += xStep;
      return current;
    }

    function addDemo(type, label, x, y, style, extra) {
      elements.push(squareElement(label + "_" + elements.length, type, x, y, size, style, extra));
    }

    function defaultFor(type) {
      return defaultPrimitiveStyle(type, size);
    }

    // Row 1: default primitive sample
    resetRow(
      screenWidth / shapeCount,
      screenWidth / shapeCount - ((screenWidth / shapeCount) + size) / 2,
      screenHeight / rowCount / 2 - size / 2
    );
    addDemo("image", "row1_image", nextX(), yOff, defaultFor("image"), { imageSrc: DEFAULT_IMAGE_PATH });
    addDemo("bezierArc", "row1_bezier", nextX(), yOff, defaultFor("bezierArc"));
    addDemo("box", "row1_box", nextX(), yOff, defaultFor("box"));
    addDemo("boxRounded", "row1_rounded", nextX(), yOff, defaultFor("boxRounded"), { radius: size / 4 });
    addDemo("circle", "row1_circle", nextX(), yOff, defaultFor("circle"));
    addDemo("line", "row1_line", nextX(), yOff, defaultFor("line"));
    addDemo("triangle", "row1_triangle", nextX(), yOff, defaultFor("triangle"));
    addDemo("quad", "row1_quad", nextX(), yOff, defaultFor("quad"), { quadInset: 0.125 });
    addDemo("text", "row1_text", nextX(), yOff, defaultFor("text"), { text: "E", textSize: size * 1.4 });

    // Row 2: custom styled primitives
    resetRow(
      screenWidth / shapeCount,
      screenWidth / shapeCount - ((screenWidth / shapeCount) + size) / 2,
      screenHeight / rowCount + screenHeight / rowCount / 2 - size / 2
    );
    var styledState = createStyledState(size, 1, Math.PI / 4);
    addDemo("image", "row2_image", nextX(), yOff, takeStyle(styledState, 1), { imageSrc: DEFAULT_IMAGE_PATH });
    addDemo("bezierArc", "row2_bezier", nextX(), yOff, takeStyle(styledState, 1));
    addDemo("box", "row2_box", nextX(), yOff, takeStyle(styledState, 1));
    addDemo("boxRounded", "row2_rounded", nextX(), yOff, takeStyle(styledState, 1), { radius: size / 4 });
    addDemo("circle", "row2_circle", nextX(), yOff, takeStyle(styledState, 1));
    addDemo("line", "row2_line", nextX(), yOff, takeStyle(styledState, 1));
    addDemo("triangle", "row2_triangle", nextX(), yOff, takeStyle(styledState, 1));
    addDemo("quad", "row2_quad", nextX(), yOff, takeStyle(styledState, 1), { quadInset: 0.125 });
    addDemo("text", "row2_text", nextX(), yOff, takeStyle(styledState, 1), { text: "E", textSize: size * 1.4 });

    // Row 3: same-type overlap with default styles + custom center style
    resetRow(
      screenWidth / shapeCount,
      screenWidth / shapeCount - ((screenWidth / shapeCount) + size) / 2,
      screenHeight / rowCount * 2 + screenHeight / rowCount / 2 - size / 2
    );
    var defaultState = createStyledState(size, 2, Math.PI / 8);
    styleDefaults.image = takeStyle(defaultState, 1);
    styleDefaults.bezierArc = takeStyle(defaultState, 1);
    styleDefaults.box = takeStyle(defaultState, 1);
    styleDefaults.boxRounded = takeStyle(defaultState, 1);
    styleDefaults.circle = takeStyle(defaultState, 1);
    styleDefaults.line = takeStyle(defaultState, 1);
    styleDefaults.polygon = takeStyle(defaultState, 1);
    styleDefaults.text = takeStyle(defaultState, 1);

    var overlapState = createStyledState(size, 3, -Math.PI / 8);
    function overlapTriple(type, key, baseX, extra) {
      addDemo(type, "row3_" + key + "_a", baseX - size / 4, yOff - size / 4, styleDefaults[key], extra);
      addDemo(type, "row3_" + key + "_b", baseX + size / 4, yOff + size / 4, styleDefaults[key], extra);
      addDemo(type, "row3_" + key + "_c", baseX, yOff, takeStyle(overlapState, 0.8), extra);
    }

    overlapTriple("image", "image", nextX(), { imageSrc: DEFAULT_IMAGE_PATH });
    overlapTriple("bezierArc", "bezierArc", nextX());
    overlapTriple("box", "box", nextX());
    overlapTriple("boxRounded", "boxRounded", nextX(), { radius: size / 4 });
    overlapTriple("circle", "circle", nextX());
    overlapTriple("line", "line", nextX());
    overlapTriple("triangle", "polygon", nextX());
    overlapTriple("quad", "polygon", nextX(), { quadInset: 0.125 });
    overlapTriple("text", "text", nextX(), { text: "E", textSize: size * 1.4 });

    // Row 4: mixed overlap in forward and reverse draw order
    resetRow(
      size / 2,
      screenWidth / 2 - (shapeCount + 2) * (size / 2),
      screenHeight / rowCount * 3 + screenHeight / rowCount / 2 - size / 2
    );
    var mixed = [
      { type: "image", key: "image", extra: { imageSrc: DEFAULT_IMAGE_PATH } },
      { type: "bezierArc", key: "bezierArc" },
      { type: "box", key: "box" },
      { type: "boxRounded", key: "boxRounded", extra: { radius: size / 4 } },
      { type: "circle", key: "circle" },
      { type: "line", key: "line" },
      { type: "triangle", key: "polygon" },
      { type: "quad", key: "polygon", extra: { quadInset: 0.125 } },
      { type: "text", key: "text", extra: { text: "E", textSize: size * 1.4 } }
    ];

    mixed.forEach(function (entry, index) {
      addDemo(entry.type, "row4_forward_" + index, nextX(), yOff, styleDefaults[entry.key], entry.extra);
    });

    xOff += xStep * 3;

    mixed.slice().reverse().forEach(function (entry, index) {
      addDemo(entry.type, "row4_reverse_" + index, nextX(), yOff, styleDefaults[entry.key], entry.extra);
    });

    return {
      id: "demo_shapes_lua_full",
      family: "demo/render-script",
      title: "DU shapes.lua Demo",
      capabilities: [
        "image",
        "bezierArc",
        "box",
        "boxRounded",
        "circle",
        "line",
        "triangle",
        "quad",
        "text",
        "rotation",
        "shadow",
        "alpha",
        "zOrder"
      ],
      screenWidth: screenWidth,
      screenHeight: screenHeight,
      elements: elements
    };
  }

  var RECIPES = [
    {
      id: "primitive_box_default",
      family: "primitive/default",
      title: "Primitive Box Default",
      capabilities: ["box", "fill", "stroke", "strokeWidth"],
      elements: [
        elem("box_default", "box", 780, 340, 360, 220, {
          fill: [0.92, 0.92, 0.94, 1],
          stroke: [0.74, 0.78, 0.84, 1],
          strokeWidth: 2
        })
      ]
    },
    {
      id: "primitive_rounded_default",
      family: "primitive/default",
      title: "Primitive Rounded Default",
      capabilities: ["boxRounded", "fill", "stroke", "radius"],
      elements: [
        elem("rounded_default", "boxRounded", 760, 320, 400, 260, {
          radius: 52,
          fill: [0.95, 0.95, 0.97, 1],
          stroke: [0.8, 0.84, 0.9, 1],
          strokeWidth: 2
        })
      ]
    },
    {
      id: "primitive_circle_default",
      family: "primitive/default",
      title: "Primitive Circle Default",
      capabilities: ["circle", "fill", "stroke"],
      elements: [
        elem("circle_default", "circle", 800, 260, 320, 320, {
          fill: [0.96, 0.95, 0.88, 1],
          stroke: [0.82, 0.78, 0.36, 1],
          strokeWidth: 2
        })
      ]
    },
    {
      id: "primitive_line_default",
      family: "primitive/default",
      title: "Primitive Line Default",
      capabilities: ["line", "stroke", "strokeWidth"],
      elements: [
        elem("line_default", "line", 720, 240, 500, 420, {
          fill: [0, 0, 0, 0],
          stroke: [0.92, 0.94, 0.98, 1],
          strokeWidth: 10
        })
      ]
    },
    {
      id: "primitive_text_default",
      family: "primitive/default",
      title: "Primitive Text Default",
      capabilities: ["text", "fill", "stroke", "textSize", "textAlign"],
      elements: [
        elem("text_default", "text", 640, 300, 640, 280, {
          radius: 24,
          fill: [0, 0, 0, 0],
          stroke: [0, 0, 0, 0],
          strokeWidth: 0,
          textLines: ["Lua", "Painter"],
          textColor: [0.92, 0.96, 1, 1],
          textSize: 72,
          textAlign: "center"
        })
      ]
    },
    {
      id: "primitive_box_styled",
      family: "primitive/styled",
      title: "Primitive Box Styled",
      capabilities: ["box", "fill", "stroke", "strokeWidth", "alpha"],
      elements: [
        elem("box_styled", "box", 740, 300, 440, 280, {
          fill: [0.83, 0.83, 0.85, 0.96],
          stroke: [0.05, 0.96, 0.12, 1],
          strokeWidth: 12
        }),
        elem("box_styled_shadow", "box", 724, 284, 472, 312, {
          fill: [0, 0, 0, 0],
          stroke: [1, 0.1, 0.1, 0.55],
          strokeWidth: 18
        })
      ]
    },
    {
      id: "primitive_circle_styled",
      family: "primitive/styled",
      title: "Primitive Circle Styled",
      capabilities: ["circle", "fill", "stroke", "strokeWidth", "alpha"],
      elements: [
        elem("circle_styled", "circle", 790, 255, 340, 340, {
          fill: [1, 0.95, 0.02, 1],
          stroke: [1, 0.12, 0.08, 1],
          strokeWidth: 14
        }),
        elem("circle_styled_halo", "circle", 774, 239, 372, 372, {
          fill: [0, 0, 0, 0],
          stroke: [1, 1, 1, 0.5],
          strokeWidth: 18
        })
      ]
    },
    {
      id: "overlap_same_type_boxes",
      family: "overlap/same-type",
      title: "Overlap Same Type Boxes",
      capabilities: ["box", "fill", "stroke", "strokeWidth", "alpha", "zOrder"],
      elements: [
        elem("overlap_box_a", "box", 640, 260, 320, 320, {
          fill: [0.88, 0.12, 0.16, 0.78],
          stroke: [0.08, 0.16, 1, 0.95],
          strokeWidth: 14
        }),
        elem("overlap_box_b", "box", 720, 320, 320, 320, {
          fill: [0.28, 0.92, 0.02, 0.72],
          stroke: [0.95, 0.88, 0.08, 0.94],
          strokeWidth: 14
        }),
        elem("overlap_box_c", "box", 800, 280, 320, 320, {
          fill: [0.25, 0.92, 1, 0.66],
          stroke: [0.96, 0.2, 0.94, 0.92],
          strokeWidth: 14
        })
      ]
    },
    {
      id: "overlap_same_type_circles",
      family: "overlap/same-type",
      title: "Overlap Same Type Circles",
      capabilities: ["circle", "fill", "stroke", "strokeWidth", "alpha", "zOrder"],
      elements: [
        elem("overlap_circle_a", "circle", 680, 250, 340, 340, {
          fill: [0.1, 0.95, 0.08, 0.7],
          stroke: [0.94, 0.94, 0.1, 0.92],
          strokeWidth: 14
        }),
        elem("overlap_circle_b", "circle", 760, 300, 340, 340, {
          fill: [0.22, 0.4, 1, 0.7],
          stroke: [0.15, 0.96, 0.16, 0.92],
          strokeWidth: 14
        }),
        elem("overlap_circle_c", "circle", 720, 280, 340, 340, {
          fill: [1, 0.25, 0.15, 0.72],
          stroke: [0.4, 0.1, 1, 0.92],
          strokeWidth: 14
        })
      ]
    },
    {
      id: "overlap_mixed_shapes_basic",
      family: "overlap/mixed-type",
      title: "Overlap Mixed Shapes Basic",
      capabilities: ["boxRounded", "circle", "line", "text", "fill", "stroke", "alpha", "zOrder"],
      elements: [
        elem("mixed_backplate", "boxRounded", 610, 260, 380, 340, {
          radius: 46,
          fill: [0.18, 0.14, 0.94, 0.92],
          stroke: [0.05, 0.95, 1, 0.9],
          strokeWidth: 14
        }),
        elem("mixed_circle", "circle", 790, 300, 300, 300, {
          fill: [1, 0.78, 0.15, 0.94],
          stroke: [1, 0.15, 0.15, 0.96],
          strokeWidth: 12
        }),
        elem("mixed_line_a", "line", 720, 360, 320, 140, {
          fill: [0, 0, 0, 0],
          stroke: [0.06, 0.95, 1, 0.95],
          strokeWidth: 12
        }),
        elem("mixed_line_b", "line", 720, 500, 320, -140, {
          fill: [0, 0, 0, 0],
          stroke: [1, 0.92, 0.05, 0.95],
          strokeWidth: 12
        }),
        elem("mixed_text", "text", 1120, 285, 260, 300, {
          fill: [0, 0, 0, 0],
          stroke: [0, 0, 0, 0],
          strokeWidth: 0,
          textLines: ["E"],
          textColor: [1, 0.96, 0.08, 1],
          textSize: 170,
          textAlign: "center"
        })
      ]
    },
    {
      id: "effect_text_rgb_split",
      family: "effect/text-treatment",
      title: "Effect Text RGB Split",
      capabilities: ["text", "fill", "stroke", "textSize", "alpha", "zOrder"],
      elements: [
        elem("rgb_text_r", "text", 760, 300, 320, 320, {
          fill: [0, 0, 0, 0],
          stroke: [0, 0, 0, 0],
          strokeWidth: 0,
          textLines: ["E"],
          textColor: [1, 0.18, 0.18, 0.85],
          textSize: 210,
          textAlign: "center"
        }),
        elem("rgb_text_g", "text", 790, 300, 320, 320, {
          fill: [0, 0, 0, 0],
          stroke: [0, 0, 0, 0],
          strokeWidth: 0,
          textLines: ["E"],
          textColor: [0.1, 1, 0.2, 0.82],
          textSize: 210,
          textAlign: "center"
        }),
        elem("rgb_text_b", "text", 775, 280, 320, 320, {
          fill: [0, 0, 0, 0],
          stroke: [0, 0, 0, 0],
          strokeWidth: 0,
          textLines: ["E"],
          textColor: [0.18, 0.48, 1, 0.85],
          textSize: 210,
          textAlign: "center"
        })
      ]
    },
    buildShapesLuaDemoRecipe()
  ];

  function getRecipeIndex(id) {
    var target = String(id || "");
    for (var i = 0; i < RECIPES.length; i += 1) {
      if (RECIPES[i].id === target) return i;
    }
    return -1;
  }

  function getRecipe(id) {
    var index = getRecipeIndex(id);
    return index >= 0 ? deepCopy(RECIPES[index]) : null;
  }

  function listRecipes() {
    return RECIPES.map(function (recipe) {
      return {
        id: recipe.id,
        family: recipe.family,
        title: recipe.title,
        capabilities: recipe.capabilities.slice(),
        elementCount: Array.isArray(recipe.elements) ? recipe.elements.length : 0
      };
    });
  }

  function buildDocument(id) {
    var recipe = getRecipe(id);
    return recipe ? docFromRecipe(recipe) : null;
  }

  function loadDocument(id) {
    var doc = buildDocument(id);
    if (!doc) return null;
    APP.state.document = doc;
    APP.state.selectedElementId = null;
    APP.state.selectedElementIds = [];
    APP.state.isDirty = false;
    APP.emit("document-loaded", doc);
    if (typeof APP.goToEditor === "function") {
      APP.goToEditor();
    } else if (typeof APP.showScreen === "function") {
      APP.showScreen("editor");
    }
    return deepCopy(doc);
  }

  APP.shapeSnippets = {
    ids: RECIPES.map(function (recipe) { return recipe.id; }),
    list: listRecipes,
    get: getRecipe,
    buildDocument: buildDocument,
    loadDocument: loadDocument
  };
})();

// --- 083-screen-commands.js ---
// 083-screen-commands.js - Normalize editor elements into screen draw commands
(function hudEditorScreenCommands() {
  "use strict";

  var NS = "HudEditor";
  var APP = window[NS];
  if (!APP) return;

  var DEFAULT_FILL = [0.2, 0.2, 0.2, 1];
  var DEFAULT_STROKE = [1, 1, 1, 1];
  var DEFAULT_TEXT = [1, 1, 1, 1];
  var DEFAULT_SHADOW = [0, 0, 0, 0];

  function cloneDocument(doc) {
    return doc ? JSON.parse(JSON.stringify(doc)) : null;
  }

  function toFiniteNumber(value, fallback) {
    var numeric = Number(value);
    return isFinite(numeric) ? numeric : fallback;
  }

  function compactColor(color, fallback) {
    var source = Array.isArray(color) ? color : fallback;
    return [
      toFiniteNumber(source && source[0], fallback[0]),
      toFiniteNumber(source && source[1], fallback[1]),
      toFiniteNumber(source && source[2], fallback[2]),
      toFiniteNumber(source && source[3], fallback[3])
    ];
  }

  function compactTextLines(lines) {
    if (!Array.isArray(lines) || !lines.length) return null;
    return lines.map(function (line) {
      return String(line == null ? "" : line);
    });
  }

  function hasVisibleColor(color) {
    return Array.isArray(color) && toFiniteNumber(color[3], 0) > 0;
  }

  function normalizeType(rawType) {
    var type = String(rawType || "box");
    return type === "rounded" ? "boxRounded" : type;
  }

  function buildCommonStyle(raw, command) {
    var rotation = toFiniteNumber(raw.rotation, 0);
    var shadowBlur = Math.max(0, toFiniteNumber(raw.shadowBlur, 0));
    var shadowColor = compactColor(raw.shadowColor, DEFAULT_SHADOW);
    if (rotation) {
      command.rot = rotation;
    }
    if (shadowBlur > 0 && shadowColor[3] > 0) {
      command.sh = {
        b: shadowBlur,
        c: shadowColor
      };
    }
    return command;
  }

  function buildTextCommand(raw) {
    var lines = compactTextLines(raw.textLines);
    var command;
    if (!lines) return null;
    command = {
      o: "text",
      x: toFiniteNumber(raw.x, 0),
      y: toFiniteNumber(raw.y, 0),
      w: toFiniteNumber(raw.w, 0),
      h: toFiniteNumber(raw.h, 0),
      l: lines,
      tc: compactColor(raw.textColor, DEFAULT_TEXT),
      s: compactColor(raw.stroke, DEFAULT_STROKE),
      sw: toFiniteNumber(raw.strokeWidth, 0),
      ts: toFiniteNumber(raw.textSize, 16),
      ta: String(raw.textAlign || "left")
    };
    return buildCommonStyle(raw, command);
  }

  function buildShapeCommand(raw, shapeKind) {
    var command = {
      o: "shape",
      k: shapeKind,
      x: toFiniteNumber(raw.x, 0),
      y: toFiniteNumber(raw.y, 0),
      w: toFiniteNumber(raw.w, 0),
      h: toFiniteNumber(raw.h, 0),
      f: compactColor(raw.fill, DEFAULT_FILL),
      s: compactColor(raw.stroke, DEFAULT_STROKE),
      sw: toFiniteNumber(raw.strokeWidth, 0)
    };
    if (shapeKind === "boxRounded") {
      command.r = toFiniteNumber(raw.radius, 0);
    }
    if (shapeKind === "quad") {
      command.qi = toFiniteNumber(raw.quadInset, 0.125);
    }
    return buildCommonStyle(raw, command);
  }

  function buildBezierCommand(raw) {
    return buildCommonStyle(raw, {
      o: "bezier",
      x: toFiniteNumber(raw.x, 0),
      y: toFiniteNumber(raw.y, 0),
      w: toFiniteNumber(raw.w, 0),
      h: toFiniteNumber(raw.h, 0),
      s: compactColor(raw.stroke, DEFAULT_STROKE),
      sw: toFiniteNumber(raw.strokeWidth, 2)
    });
  }

  function buildImageCommand(raw) {
    var command = {
      o: "image",
      x: toFiniteNumber(raw.x, 0),
      y: toFiniteNumber(raw.y, 0),
      w: toFiniteNumber(raw.w, 0),
      h: toFiniteNumber(raw.h, 0),
      src: String(raw.imageSrc || ""),
      fit: String(raw.imageFit || "contain")
    };
    if (hasVisibleColor(raw.fill)) {
      command.f = compactColor(raw.fill, DEFAULT_FILL);
    }
    return buildCommonStyle(raw, command);
  }

  function buildLineCommand(raw) {
    return buildCommonStyle(raw, {
      o: "line",
      x: toFiniteNumber(raw.x, 0),
      y: toFiniteNumber(raw.y, 0),
      w: toFiniteNumber(raw.w, 0),
      h: toFiniteNumber(raw.h, 0),
      s: compactColor(raw.stroke, DEFAULT_STROKE),
      sw: toFiniteNumber(raw.strokeWidth, 2)
    });
  }

  function buildCommandsForElement(raw) {
    var commands = [];
    var type;
    var textCommand;
    if (!raw || typeof raw !== "object" || raw.visible === false) return commands;

    type = normalizeType(raw.type);
    if (type === "text") {
      textCommand = buildTextCommand(raw);
      if (textCommand) commands.push(textCommand);
      return commands;
    }

    if (type === "line") {
      commands.push(buildLineCommand(raw));
      textCommand = buildTextCommand(raw);
      if (textCommand) commands.push(textCommand);
      return commands;
    }

    if (type === "bezierArc") {
      commands.push(buildBezierCommand(raw));
      textCommand = buildTextCommand(raw);
      if (textCommand) commands.push(textCommand);
      return commands;
    }

    if (type === "image") {
      commands.push(buildImageCommand(raw));
      textCommand = buildTextCommand(raw);
      if (textCommand) commands.push(textCommand);
      return commands;
    }

    commands.push(buildShapeCommand(raw, type));
    textCommand = buildTextCommand(raw);
    if (textCommand) commands.push(textCommand);
    return commands;
  }

  function buildCommandDocument(doc) {
    var source = cloneDocument(doc);
    var commands = [];
    if (!source) return null;

    (Array.isArray(source.elements) ? source.elements : []).forEach(function (element) {
      Array.prototype.push.apply(commands, buildCommandsForElement(element));
    });

    return {
      w: toFiniteNumber(source.screenWidth, 1920),
      h: toFiniteNumber(source.screenHeight, 1080),
      c: commands
    };
  }

  APP.screenCommands = {
    buildCommandDocument: buildCommandDocument,
    buildCommandsForElement: buildCommandsForElement,
    normalizeType: normalizeType
  };
})();

// --- 085-ide-export.js ---
// 085-ide-export.js - Export generated board/screen code via mod IDE-import path
(function hudEditorIdeExport() {
  "use strict";

  var NS = "HudEditor";
  var APP = window[NS];
  if (!APP) return;
  if (!APP.screenCommands) return;

  var SCREEN_SCRIPT_LIMIT = 50000;

  function getRuntimeCtx() {
    return window.__HUD_EDITOR_RUNTIME_CTX__ || null;
  }

  function getDocument() {
    return APP.state && APP.state.document ? APP.state.document : null;
  }

  function luaEscapeString(value) {
    return JSON.stringify(String(value == null ? "" : value))
      .replace(/\u2028/g, "\\u2028")
      .replace(/\u2029/g, "\\u2029");
  }

  function toLua(value) {
    if (value === null || typeof value === "undefined") return "nil";
    if (typeof value === "number") {
      if (!isFinite(value)) return "0";
      if (Math.round(value) === value) return String(value);
      return String(Number(value.toFixed(4)));
    }
    if (typeof value === "boolean") return value ? "true" : "false";
    if (typeof value === "string") return luaEscapeString(value);
    if (Array.isArray(value)) {
      if (!value.length) return "{}";
      return "{" + value.map(toLua).join(",") + "}";
    }
    if (typeof value === "object") {
      var keys = Object.keys(value);
      if (!keys.length) return "{}";
      return "{" + keys.map(function (key) {
        var safeKey = /^[A-Za-z_][A-Za-z0-9_]*$/.test(key)
          ? key
          : "[" + luaEscapeString(key) + "]";
        return safeKey + "=" + toLua(value[key]);
      }).join(",") + "}";
    }
    return "nil";
  }

  function cloneDocument(doc) {
    return doc ? JSON.parse(JSON.stringify(doc)) : null;
  }

  function joinLuaArgs(values) {
    return values.map(function (value) {
      return toLua(value);
    }).join(", ");
  }

  function normalizeScreenCodeMode(options) {
    var mode = options;
    if (mode && typeof mode === "object") {
      mode = mode.mode;
    }
    mode = String(mode || "readable").toLowerCase();
    return mode === "compact" ? "compact" : "readable";
  }

  function buildReadableBaseStyle(command) {
    var style = {};
    if (command && command.rot) {
      style.rotation = command.rot;
    }
    if (command && command.sh) {
      style.shadow = {
        blur: command.sh.b,
        color: command.sh.c
      };
    }
    return style;
  }

  function buildReadableShapeStyle(command) {
    var style = buildReadableBaseStyle(command);
    style.fill = command && command.f ? command.f : [0.2, 0.2, 0.2, 1];
    style.stroke = command && command.s ? command.s : [1, 1, 1, 1];
    style.strokeWidth = command && command.sw != null ? command.sw : 0;
    return style;
  }

  function buildReadableStrokeStyle(command, defaultWidth) {
    var style = buildReadableBaseStyle(command);
    style.stroke = command && command.s ? command.s : [1, 1, 1, 1];
    style.strokeWidth = command && command.sw != null ? command.sw : defaultWidth;
    return style;
  }

  function buildReadableImageStyle(command) {
    var style = buildReadableBaseStyle(command);
    if (command && command.f) {
      style.fill = command.f;
    }
    return style;
  }

  function buildReadableTextStyle(command) {
    var style = buildReadableBaseStyle(command);
    style.stroke = command && command.s ? command.s : [0, 0, 0, 0];
    style.strokeWidth = command && command.sw != null ? command.sw : 0;
    style.textColor = command && command.tc ? command.tc : [1, 1, 1, 1];
    return style;
  }

  function appendReadableCommand(lines, command, index) {
    var kind;
    var style;
    if (!command) return;

    lines.push("");
    lines.push("-- Command " + index + ": " + String(command.o || "shape") + (command.k ? (" " + command.k) : ""));
    lines.push("resetStyle(layer)");

    if (command.o === "shape") {
      kind = String(command.k || "box");
      style = buildReadableShapeStyle(command);
      lines.push("applyShapeStyle(layer, " + toLua(style) + ")");
      if (kind === "circle") {
        lines.push("drawCircle(layer, " + joinLuaArgs([command.x, command.y, command.w, command.h]) + ")");
      } else if (kind === "boxRounded") {
        lines.push("drawBoxRounded(layer, " + joinLuaArgs([command.x, command.y, command.w, command.h, command.r != null ? command.r : 0]) + ")");
      } else if (kind === "triangle") {
        lines.push("drawTriangle(layer, " + joinLuaArgs([command.x, command.y, command.w, command.h]) + ")");
      } else if (kind === "quad") {
        lines.push("drawQuad(layer, " + joinLuaArgs([command.x, command.y, command.w, command.h, command.qi != null ? command.qi : 0.125]) + ")");
      } else {
        lines.push("drawBox(layer, " + joinLuaArgs([command.x, command.y, command.w, command.h]) + ")");
      }
      return;
    }

    if (command.o === "bezier") {
      lines.push("applyStrokeStyle(layer, " + toLua(buildReadableStrokeStyle(command, 2)) + ")");
      lines.push("drawBezierArc(layer, " + joinLuaArgs([command.x, command.y, command.w, command.h]) + ")");
      return;
    }

    if (command.o === "line") {
      lines.push("applyStrokeStyle(layer, " + toLua(buildReadableStrokeStyle(command, 2)) + ")");
      lines.push("drawLine(layer, " + joinLuaArgs([command.x, command.y, command.w, command.h]) + ")");
      return;
    }

    if (command.o === "image") {
      lines.push("applyImageStyle(layer, " + toLua(buildReadableImageStyle(command)) + ")");
      lines.push("drawImageRect(layer, " + joinLuaArgs([command.src || "", command.x, command.y, command.w, command.h]) + ")");
      return;
    }

    if (command.o === "text") {
      lines.push("applyTextStyle(layer, " + toLua(buildReadableTextStyle(command)) + ")");
      lines.push("drawTextBlock(layer, " + joinLuaArgs([
        command.l || [],
        command.x,
        command.y,
        command.w,
        command.h,
        {
          size: command.ts != null ? command.ts : 16,
          align: command.ta || "left",
          color: command.tc || [1, 1, 1, 1]
        }
      ]) + ")");
    }
  }

  function buildReadableRenderScriptFromCommands(commandDoc) {
    var commands = commandDoc && Array.isArray(commandDoc.c) ? commandDoc.c : [];
    var lines = [
      "-- Generated by HUD Editor",
      "-- Screen export mode: readable",
      "local FONT_CACHE = {}",
      "local IMAGE_CACHE = {}",
      "",
      "local function loadFontCached(size)",
      "    size = math.max(1, math.floor(tonumber(size) or 16))",
      "    local font = FONT_CACHE[size]",
      "    if not font then",
      "        font = loadFont(\"Play\", size)",
      "        FONT_CACHE[size] = font",
      "    end",
      "    return font",
      "end",
      "",
      "local function loadImageCached(path)",
      "    if type(path) ~= \"string\" or path == \"\" then",
      "        return nil",
      "    end",
      "    local image = IMAGE_CACHE[path]",
      "    if not image then",
      "        image = loadImage(path)",
      "        IMAGE_CACHE[path] = image",
      "    end",
      "    return image",
      "end",
      "",
      "local function applyFillColor(layer, color, fallback)",
      "    local source = color or fallback",
      "    setNextFillColor(",
      "        layer,",
      "        tonumber(source[1]) or fallback[1],",
      "        tonumber(source[2]) or fallback[2],",
      "        tonumber(source[3]) or fallback[3],",
      "        tonumber(source[4]) or fallback[4]",
      "    )",
      "end",
      "",
      "local function applyStrokeColor(layer, color, fallback)",
      "    local source = color or fallback",
      "    setNextStrokeColor(",
      "        layer,",
      "        tonumber(source[1]) or fallback[1],",
      "        tonumber(source[2]) or fallback[2],",
      "        tonumber(source[3]) or fallback[3],",
      "        tonumber(source[4]) or fallback[4]",
      "    )",
      "end",
      "",
      "local function resetStyle(layer)",
      "    setNextRotation(layer, 0)",
      "    setNextShadow(layer, 0, 0, 0, 0, 0)",
      "    setNextFillColor(layer, 0, 0, 0, 0)",
      "    setNextStrokeColor(layer, 0, 0, 0, 0)",
      "    setNextStrokeWidth(layer, 0)",
      "    setNextTextAlign(layer, AlignH_Left, AlignV_Middle)",
      "end",
      "",
      "local function applyRotationAndShadow(layer, style)",
      "    if type(style) ~= \"table\" then",
      "        return",
      "    end",
      "    local rotation = tonumber(style.rotation) or 0",
      "    if rotation ~= 0 then",
      "        setNextRotation(layer, rotation)",
      "    end",
      "    local shadow = style.shadow",
      "    local color = shadow and shadow.color or nil",
      "    local blur = shadow and tonumber(shadow.blur) or 0",
      "    if color and blur > 0 then",
      "        setNextShadow(",
      "            layer,",
      "            blur,",
      "            tonumber(color[1]) or 0,",
      "            tonumber(color[2]) or 0,",
      "            tonumber(color[3]) or 0,",
      "            tonumber(color[4]) or 0",
      "        )",
      "    end",
      "end",
      "",
      "local function applyShapeStyle(layer, style)",
      "    applyRotationAndShadow(layer, style)",
      "    applyFillColor(layer, style and style.fill, {0.2, 0.2, 0.2, 1})",
      "    applyStrokeColor(layer, style and style.stroke, {1, 1, 1, 1})",
      "    setNextStrokeWidth(layer, tonumber(style and style.strokeWidth) or 0)",
      "end",
      "",
      "local function applyStrokeStyle(layer, style)",
      "    applyRotationAndShadow(layer, style)",
      "    applyStrokeColor(layer, style and style.stroke, {1, 1, 1, 1})",
      "    setNextStrokeWidth(layer, tonumber(style and style.strokeWidth) or 0)",
      "end",
      "",
      "local function applyImageStyle(layer, style)",
      "    applyRotationAndShadow(layer, style)",
      "    if style and style.fill then",
      "        applyFillColor(layer, style.fill, {0.2, 0.2, 0.2, 1})",
      "    end",
      "end",
      "",
      "local function applyTextStyle(layer, style)",
      "    applyRotationAndShadow(layer, style)",
      "    applyStrokeColor(layer, style and style.stroke, {0, 0, 0, 0})",
      "    setNextStrokeWidth(layer, tonumber(style and style.strokeWidth) or 0)",
      "end",
      "",
      "local function drawBox(layer, x, y, w, h)",
      "    addBox(layer, x, y, w, h)",
      "end",
      "",
      "local function drawBoxRounded(layer, x, y, w, h, radius)",
      "    addBoxRounded(layer, x, y, w, h, tonumber(radius) or 0)",
      "end",
      "",
      "local function drawCircle(layer, x, y, w, h)",
      "    addCircle(layer, x + w * 0.5, y + h * 0.5, math.min(w, h) * 0.5)",
      "end",
      "",
      "local function drawTriangle(layer, x, y, w, h)",
      "    addTriangle(layer, x, y, x + w, y, x, y + h)",
      "end",
      "",
      "local function drawQuad(layer, x, y, w, h, inset)",
      "    local qi = tonumber(inset) or 0.125",
      "    addQuad(layer, x, y, x + w * (1 - qi), y + h * qi, x + w, y + h, x + w * qi, y + h * (1 - qi))",
      "end",
      "",
      "local function drawBezierArc(layer, x, y, w, h)",
      "    addBezier(layer, x, y + h, x + w * 0.5, y, x + w, y + h)",
      "end",
      "",
      "local function drawLine(layer, x, y, w, h)",
      "    addLine(layer, x, y, x + w, y + h)",
      "end",
      "",
      "local function drawImageRect(layer, path, x, y, w, h)",
      "    local image = loadImageCached(path)",
      "    if not image then",
      "        return",
      "    end",
      "    addImage(layer, image, x, y, w, h)",
      "end",
      "",
      "local function drawTextBlock(layer, lines, x, y, w, h, options)",
      "    if type(lines) ~= \"table\" or #lines == 0 then",
      "        return",
      "    end",
      "    local size = math.max(1, math.floor(tonumber(options and options.size) or 16))",
      "    local font = loadFontCached(size)",
      "    if not font then",
      "        return",
      "    end",
      "    local align = options and options.align or \"left\"",
      "    local textX = x + 12",
      "    local alignH = AlignH_Left",
      "    if align == \"center\" then",
      "        textX = x + w * 0.5",
      "        alignH = AlignH_Center",
      "    elseif align == \"right\" then",
      "        textX = x + w - 12",
      "        alignH = AlignH_Right",
      "    end",
      "    setNextTextAlign(layer, alignH, AlignV_Middle)",
      "    local gap = math.max(2, math.floor(size * 0.2))",
      "    local startY = y + h * 0.5 - ((#lines - 1) * (size + gap)) * 0.5",
      "    local color = options and options.color or {1, 1, 1, 1}",
      "    for index = 1, #lines do",
      "        applyFillColor(layer, color, {1, 1, 1, 1})",
      "        addText(layer, font, tostring(lines[index] or \"\"), textX, startY + (index - 1) * (size + gap))",
      "    end",
      "end",
      "",
      "setBackgroundColor(0, 0, 0)",
      "local layer = createLayer()"
    ];

    commands.forEach(function (command, index) {
      appendReadableCommand(lines, command, index + 1);
    });

    lines.push("");
    return lines.join("\n");
  }

  function buildCompactRenderScriptFromCommands(commandDoc) {
    return [
      "-- Generated by HUD Editor",
      "-- Screen export mode: compact",
      "local D=" + toLua(commandDoc),
      "local F={}",
      "local I={}",
      "local function G(s)",
      "    s=math.max(1,math.floor(tonumber(s) or 16))",
      "    local f=F[s]",
      "    if not f then",
      "        f=loadFont(\"Play\",s)",
      "        F[s]=f",
      "    end",
      "    return f",
      "end",
      "local function IM(p)",
      "    if type(p)~=\"string\" or p==\"\" then return nil end",
      "    local img=I[p]",
      "    if not img then",
      "        img=loadImage(p)",
      "        I[p]=img",
      "    end",
      "    return img",
      "end",
      "local function FC(l,c,d)",
      "    c=c or d",
      "    setNextFillColor(l,tonumber(c[1]) or d[1],tonumber(c[2]) or d[2],tonumber(c[3]) or d[3],tonumber(c[4]) or d[4])",
      "end",
      "local function SC(l,c,d)",
      "    c=c or d",
      "    setNextStrokeColor(l,tonumber(c[1]) or d[1],tonumber(c[2]) or d[2],tonumber(c[3]) or d[3],tonumber(c[4]) or d[4])",
      "end",
      "local function ST(l,c)",
      "    local r=tonumber(c.rot) or 0",
      "    if r~=0 then",
      "        setNextRotation(l,r)",
      "    end",
      "    local sh=c.sh",
      "    local sc=sh and sh.c or nil",
      "    local sb=sh and tonumber(sh.b) or 0",
      "    if sc and sb and sb>0 then",
      "        setNextShadow(l,sb,tonumber(sc[1]) or 0,tonumber(sc[2]) or 0,tonumber(sc[3]) or 0,tonumber(sc[4]) or 0)",
      "    end",
      "end",
      "local function TX(l,c)",
      "    local lines=c.l",
      "    if not lines or #lines==0 then return end",
      "    ST(l,c)",
      "    SC(l,c.s,{0,0,0,0})",
      "    setNextStrokeWidth(l,tonumber(c.sw) or 0)",
      "    local s=math.max(1,math.floor(tonumber(c.ts) or 16))",
      "    local f=G(s)",
      "    if not f then return end",
      "    local a=c.ta or \"left\"",
      "    local x=(tonumber(c.x) or 0)+12",
      "    local h=AlignH_Left",
      "    local w=tonumber(c.w) or 0",
      "    if a==\"center\" then",
      "        x=(tonumber(c.x) or 0)+w*0.5",
      "        h=AlignH_Center",
      "    elseif a==\"right\" then",
      "        x=(tonumber(c.x) or 0)+w-12",
      "        h=AlignH_Right",
      "    end",
      "    setNextTextAlign(l,h,AlignV_Middle)",
      "    local g=math.max(2,math.floor(s*0.2))",
      "    local y=(tonumber(c.y) or 0)+(tonumber(c.h) or 0)*0.5-((#lines-1)*(s+g))*0.5",
      "    local tc=c.tc or {1,1,1,1}",
      "    for i=1,#lines do",
      "        FC(l,tc,{1,1,1,1})",
      "        addText(l,f,tostring(lines[i] or \"\"),x,y+(i-1)*(s+g))",
      "    end",
      "end",
      "local function SH(l,c)",
      "    ST(l,c)",
      "    FC(l,c.f,{0.2,0.2,0.2,1})",
      "    SC(l,c.s,{1,1,1,1})",
      "    setNextStrokeWidth(l,tonumber(c.sw) or 0)",
      "    local x=tonumber(c.x) or 0",
      "    local y=tonumber(c.y) or 0",
      "    local w=tonumber(c.w) or 0",
      "    local h=tonumber(c.h) or 0",
      "    local k=c.k or \"box\"",
      "    if k==\"circle\" then",
      "        addCircle(l,x+w*0.5,y+h*0.5,math.min(w,h)*0.5)",
      "    elseif k==\"boxRounded\" then",
      "        addBoxRounded(l,x,y,w,h,tonumber(c.r) or 0)",
      "    elseif k==\"triangle\" then",
      "        addTriangle(l,x,y,x+w,y,x,y+h)",
      "    elseif k==\"quad\" then",
      "        local qi=tonumber(c.qi) or 0.125",
      "        addQuad(l,x,y,x+w*(1-qi),y+h*qi,x+w,y+h,x+w*qi,y+h*(1-qi))",
      "    else",
      "        addBox(l,x,y,w,h)",
      "    end",
      "end",
      "local function BZ(l,c)",
      "    ST(l,c)",
      "    SC(l,c.s,{1,1,1,1})",
      "    setNextStrokeWidth(l,tonumber(c.sw) or 2)",
      "    local x=tonumber(c.x) or 0",
      "    local y=tonumber(c.y) or 0",
      "    local w=tonumber(c.w) or 0",
      "    local h=tonumber(c.h) or 0",
      "    addBezier(l,x,y+h,x+w*0.5,y,x+w,y+h)",
      "end",
      "local function LN(l,c)",
      "    ST(l,c)",
      "    SC(l,c.s,{1,1,1,1})",
      "    setNextStrokeWidth(l,tonumber(c.sw) or 2)",
      "    local x=tonumber(c.x) or 0",
      "    local y=tonumber(c.y) or 0",
      "    addLine(l,x,y,x+(tonumber(c.w) or 0),y+(tonumber(c.h) or 0))",
      "end",
      "local function IG(l,c)",
      "    if c.f then",
      "        FC(l,c.f,{0.2,0.2,0.2,1})",
      "    end",
      "    ST(l,c)",
      "    local img=IM(c.src)",
      "    if not img then return end",
      "    addImage(l,img,tonumber(c.x) or 0,tonumber(c.y) or 0,tonumber(c.w) or 0,tonumber(c.h) or 0)",
      "end",
      "setBackgroundColor(0,0,0)",
      "local layer=createLayer()",
      "for i=1,#(D.c or {}) do",
      "    local c=D.c[i]",
      "    if c then",
      "        local op=c.o or \"shape\"",
      "        if op==\"text\" then",
      "            TX(layer,c)",
      "        elseif op==\"line\" then",
      "            LN(layer,c)",
      "        elseif op==\"bezier\" then",
      "            BZ(layer,c)",
      "        elseif op==\"image\" then",
      "            IG(layer,c)",
      "        else",
      "            SH(layer,c)",
      "        end",
      "    end",
      "end",
      ""
    ].join("\n");
  }

  function buildRenderScriptFromCommands(commandDoc, options) {
    var mode = normalizeScreenCodeMode(options);
    if (mode === "compact") {
      return buildCompactRenderScriptFromCommands(commandDoc);
    }
    return buildReadableRenderScriptFromCommands(commandDoc);
  }

  function buildBoardOnStartCode(doc) {
    var embedded = toLua(cloneDocument(doc));
    return [
      "-- Generated by HUD Editor",
      "-- Paste into the programming board onStart filter",
      "-- Requires HudEditorBoard.lua in library.onStart",
      "",
      "local HUD_EDITOR_BOOT_DOCUMENT = " + embedded,
      "",
      "if not HudEditorBoard then",
      "    system.print(\"ERROR: Failed to load HudEditorBoard module\")",
      "    return",
      "end",
      "",
      "HudEditorBoard.init(HUD_EDITOR_BOOT_DOCUMENT)",
      "",
      "function onInputReceived(input)",
      "    return HudEditorBoard.onInputReceived(input)",
      "end",
      "",
      "function onTimer(timerName)",
      "    HudEditorBoard.onTimer(timerName)",
      "end",
      "",
      "unit.hideWidget()",
      "system.print(\"HudEditorBoard initialized\")",
      ""
    ].join("\n");
  }

  function buildScreenCode(doc, options) {
    var commandDoc = APP.screenCommands.buildCommandDocument(doc);
    return commandDoc ? buildRenderScriptFromCommands(commandDoc, options) : "";
  }

  function buildScreenCodeReadable(doc) {
    return buildScreenCode(doc, { mode: "readable" });
  }

  function buildScreenCodeCompact(doc) {
    return buildScreenCode(doc, { mode: "compact" });
  }

  function queueIdeImport(targetKind, code) {
    var ctx = getRuntimeCtx();
    if (!ctx || typeof ctx.sendPacket !== "function") {
      return { ok: false, error: "runtime_ctx_unavailable" };
    }
    var requestId = "hud-editor-" + targetKind + "-" + Date.now() + "-" + Math.floor(Math.random() * 1000000);
    ctx.sendPacket("hud_editor_ide_export", {
      requestId: requestId,
      targetKind: targetKind,
      code: String(code || "")
    });
    return { ok: true, requestId: requestId };
  }

  function exportBoard() {
    var doc = getDocument();
    if (!doc) return { ok: false, error: "no_document" };
    return queueIdeImport("lua_editor", buildBoardOnStartCode(doc));
  }

  function exportScreen(options) {
    var doc = getDocument();
    var code;
    if (!doc) return { ok: false, error: "no_document" };
    code = buildScreenCode(doc, options);
    if (!code) return { ok: false, error: "no_document" };
    if (code.length > SCREEN_SCRIPT_LIMIT) {
      return { ok: false, error: "screen_script_too_long", length: code.length };
    }
    return queueIdeImport("screen_editor", code);
  }

  APP.ideExport = {
    toLua: toLua,
    buildBoardOnStartCode: buildBoardOnStartCode,
    buildRenderScriptFromCommands: buildRenderScriptFromCommands,
    buildReadableRenderScriptFromCommands: buildReadableRenderScriptFromCommands,
    buildCompactRenderScriptFromCommands: buildCompactRenderScriptFromCommands,
    buildScreenCommandDocument: APP.screenCommands.buildCommandDocument,
    buildScreenCode: buildScreenCode,
    buildScreenCodeReadable: buildScreenCodeReadable,
    buildScreenCodeCompact: buildScreenCodeCompact,
    exportBoard: exportBoard,
    exportScreen: exportScreen
  };

  APP.on("export-board", function () {
    var result = exportBoard();
    if (result && result.ok) {
      APP.emit("toast", { type: "success", text: "Board export queued" });
    } else {
      APP.emit("toast", { type: "error", text: "Board export failed" });
    }
  });

  APP.on("export-screen", function () {
    var result = exportScreen();
    if (result && result.ok) {
      APP.emit("toast", { type: "success", text: "Screen export queued" });
    } else if (result && result.error === "screen_script_too_long") {
      APP.emit("toast", { type: "error", text: "Screen export too long: " + result.length });
    } else {
      APP.emit("toast", { type: "error", text: "Screen export failed" });
    }
  });
})();

// --- 090-databank-sync.js ---
// 090-databank-sync.js - Ingame-only persistence via the live Lua editor
(function hudEditorDatabankSync() {
  "use strict";

  var NS = "HudEditor";
  var APP = window[NS];
  if (!APP) return;

  var pendingLoadToEditor = false;

  function hasBridge() {
    return !!(APP.bridge && typeof APP.bridge.isAvailable === "function" && APP.bridge.isAvailable());
  }

  function readEditorContext() {
    var fallback = {
      available: hasBridge(),
      visible: false,
      selectedSlot: null,
      selectedFilter: null,
      canAccessOnStart: false
    };
    var status = APP.bridge && typeof APP.bridge.getEditorStatus === "function"
      ? (APP.bridge.getEditorStatus() || fallback)
      : fallback;
    APP.state.editorContext = status;
    APP.emit("editor-context", status);
    return status;
  }

  function ensureVisibleEditorForBoardAction() {
    var status = readEditorContext();
    if (status && status.canAccessOnStart) {
      return true;
    }
    APP.emit("toast", {
      type: "error",
      text: "Open the programming board Lua editor and keep it visible for load/save"
    });
    return false;
  }

  function handlePostSaveEditorClose(message) {
    if (APP.state && APP.state.editModeActive && typeof APP.exitEditMode === "function") {
      APP.exitEditMode();
      if (typeof APP.updateToggleButton === "function") {
        APP.updateToggleButton();
      }
      APP.emit("toast", {
        type: "info",
        text: message || "Lua editor applied and closed; HUD editor closed too"
      });
      return;
    }
    if (typeof APP.goToStart === "function") {
      APP.goToStart();
    }
  }

  function applyLoadedDocument(doc, options) {
    if (!doc) return false;
    APP.state.document = doc;
    APP.state.selectedElementId = null;
    APP.state.selectedElementIds = [];
    APP.state.isDirty = false;
    APP.emit("document-loaded", doc);

    if (options && options.enterEditor && typeof APP.goToEditor === "function") {
      APP.goToEditor();
    }

    setTimeout(function () {
      if (APP.canvas && typeof APP.canvas.render === "function") {
        APP.canvas.render();
      }
    }, 0);
    return true;
  }

  function requestSync() {
    if (hasBridge() && APP.bridge.sync) {
      APP.bridge.sync();
      return true;
    }
    return false;
  }

  function requestLoad(scriptId) {
    if (hasBridge() && APP.bridge.loadDocument) {
      APP.bridge.loadDocument(scriptId || "_current");
      return true;
    }
    return false;
  }

  function requestList() {
    if (hasBridge() && APP.bridge.listScripts) {
      APP.bridge.listScripts();
      return true;
    }
    return false;
  }

  function requestSave() {
    if (hasBridge() && APP.bridge.saveDocument) {
      APP.bridge.saveDocument();
      return true;
    }
    return false;
  }

  APP.on("save", function () {
    if (!ensureVisibleEditorForBoardAction()) {
      return;
    }
    if (!requestSave()) {
      APP.emit("toast", { type: "error", text: "Lua editor bridge unavailable" });
    }
  });

  APP.on("saveas-confirm", function (name) {
    if (APP.state.document) {
      APP.state.document.name = String(name || "").trim() || "Layout";
    }
    if (!ensureVisibleEditorForBoardAction()) {
      return;
    }
    if (!requestSave()) {
      APP.emit("toast", { type: "error", text: "Lua editor bridge unavailable" });
    }
  });

  APP.on("load-confirm", function (id) {
    pendingLoadToEditor = true;
    if (!ensureVisibleEditorForBoardAction()) {
      pendingLoadToEditor = false;
      return;
    }
    if (!requestLoad(id)) {
      pendingLoadToEditor = false;
      APP.emit("toast", { type: "error", text: "Lua editor bridge unavailable" });
    }
  });

  APP.on("request-script-list", function () {
    if (!ensureVisibleEditorForBoardAction()) {
      APP.emit("script-list-response", []);
      return;
    }
    if (!requestList()) {
      APP.emit("script-list-response", []);
    }
  });

  APP.on("enter-edit", function () {
    readEditorContext();
    if (!APP.state.document) {
      requestSync();
    }
  });

  APP.on("board-sync", function (result) {
    readEditorContext();
    if (result && result.document && !APP.state.document) {
      applyLoadedDocument(result.document, { enterEditor: false });
    }
  });

  APP.on("board-load", function (result) {
    readEditorContext();
    var loaded = !!(result && result.document && applyLoadedDocument(result.document, {
      enterEditor: pendingLoadToEditor
    }));
    pendingLoadToEditor = false;

    if (loaded) {
      var count = Array.isArray(result.document.elements) ? result.document.elements.length : 0;
      APP.emit("toast", {
        type: "success",
        text: "Loaded " + count + " element" + (count === 1 ? "" : "s") + " from unit.onStart"
      });
    } else {
      APP.emit("toast", { type: "error", text: "Load from unit.onStart failed" });
    }
  });

  APP.on("board-save", function (result) {
    readEditorContext();
    if (result && result.ok) {
      APP.state.isDirty = false;
      APP.emit("toast", { type: "success", text: "Saved to unit.onStart" });
      handlePostSaveEditorClose();
    } else {
      APP.emit("toast", { type: "error", text: "Save to unit.onStart failed" });
    }
  });

  APP.on("board-list", function (result) {
    APP.emit("script-list-response", result && result.scripts ? result.scripts : []);
  });

  APP.on("board-error", function (err) {
    readEditorContext();
    var message = String((err && err.message) || err || "unknown");
    if (message === "lua editor not visible") {
      APP.emit("toast", {
        type: "error",
        text: "Open the programming board Lua editor and keep it visible for load/save"
      });
      return;
    }
    APP.emit("toast", { type: "error", text: "Lua editor error: " + message });
  });

  APP.databank = {
    save: requestSave,
    load: requestLoad,
    list: requestList,
    sync: requestSync
  };

  readEditorContext();
})();

// --- 110-undo-redo.js ---
// 110-undo-redo.js - Undo/redo stack
(function hudEditorUndoRedo() {
  "use strict";

  var NS = "HudEditor";
  var APP = window[NS];
  if (!APP) return;

  // ─── Undo/Redo state ─────────────────────────────────────────────

  var undoStack = [];
  var redoStack = [];
  var maxStackSize = 50;
  var isUndoRedoAction = false;

  // ─── Push state to undo stack ───────────────────────────────────

  function pushUndo() {
    if (isUndoRedoAction) return;
    if (!APP.state.document) return;

    var snapshot = deepCopyDocument(APP.state.document);
    undoStack.push(snapshot);

    // Limit stack size
    if (undoStack.length > maxStackSize) {
      undoStack.shift();
    }

    // Clear redo on new action
    redoStack = [];
  }

  function deepCopyDocument(doc) {
    if (!doc) return null;
    return JSON.parse(JSON.stringify(doc));
  }

  // ─── Perform undo ────────────────────────────────────────────────

  function undo() {
    if (undoStack.length === 0) {
      APP.emit("toast", { type: "info", text: "Nothing to undo" });
      return false;
    }

    isUndoRedoAction = true;

    // Save current state to redo
    if (APP.state.document) {
      redoStack.push(deepCopyDocument(APP.state.document));
    }

    // Restore previous state
    var snapshot = undoStack.pop();
    APP.state.document = snapshot;
    APP.state.selectedElementId = null;
    APP.state.selectedElementIds = [];
    APP.state.isDirty = true;
    APP.emit("selection-changed", null);
    APP.emit("document-loaded", snapshot);
    APP.emit("toast", { type: "info", text: "Undone" });

    isUndoRedoAction = false;
    return true;
  }

  // ─── Perform redo ───────────────────────────────────────────────

  function redo() {
    if (redoStack.length === 0) {
      APP.emit("toast", { type: "info", text: "Nothing to redo" });
      return false;
    }

    isUndoRedoAction = true;

    // Save current state to undo
    if (APP.state.document) {
      undoStack.push(deepCopyDocument(APP.state.document));
    }

    // Restore next redo state
    var snapshot = redoStack.pop();
    APP.state.document = snapshot;
    APP.state.selectedElementId = null;
    APP.state.selectedElementIds = [];
    APP.state.isDirty = true;
    APP.emit("selection-changed", null);
    APP.emit("document-loaded", snapshot);
    APP.emit("toast", { type: "info", text: "Redone" });

    isUndoRedoAction = false;
    return true;
  }

  // ─── Clear stacks ───────────────────────────────────────────────

  function clear() {
    undoStack = [];
    redoStack = [];
  }

  // ─── Event listeners ────────────────────────────────────────────

  // Push undo before element changes
  APP.on("before-element-change", function() {
    pushUndo();
  });

  // Keyboard shortcuts
  APP.on("undo", function() {
    undo();
  });

  APP.on("redo", function() {
    redo();
  });

  // Clear on new document (but not during undo/redo which also emits document-loaded)
  APP.on("document-created", function() {
    if (!isUndoRedoAction) clear();
  });

  APP.on("document-loaded", function() {
    if (!isUndoRedoAction) clear();
  });

  // ─── Public API ─────────────────────────────────────────────────

  APP.undoRedo = {
    undo: undo,
    redo: redo,
    push: pushUndo,
    clear: clear,
    canUndo: function() { return undoStack.length > 0; },
    canRedo: function() { return redoStack.length > 0; },
  };

})();

// --- 120-dialogs.js ---
// 120-dialogs.js - Dialog components (load, saveas, close confirm)
(function hudEditorDialogs() {
  "use strict";

  var NS = "HudEditor";
  var APP = window[NS];
  if (!APP) return;

  var el = APP.el;
  var qs = APP.qs;
  var qsa = APP.qsa;

  // ─── Dialog registry ───────────────────────────────────────────────

  var activeDialog = null;
  var colorDialogState = {
    prop: null,
    rgba: [1, 1, 1, 1],
    hue: 0
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function toFiniteNumber(value, fallback) {
    var num = Number(value);
    return isFinite(num) ? num : fallback;
  }

  function normalizeRgba(value) {
    var rgba = Array.isArray(value) ? value.slice(0, 4) : [];
    return [
      clamp(toFiniteNumber(rgba[0], 1), 0, 1),
      clamp(toFiniteNumber(rgba[1], 1), 0, 1),
      clamp(toFiniteNumber(rgba[2], 1), 0, 1),
      clamp(toFiniteNumber(rgba[3], 1), 0, 1)
    ];
  }

  function rgbaToCss(rgba) {
    var value = normalizeRgba(rgba);
    return "rgba(" +
      Math.round(value[0] * 255) + "," +
      Math.round(value[1] * 255) + "," +
      Math.round(value[2] * 255) + "," +
      value[3] + ")";
  }

  function rgbToHsv(rgba) {
    var value = normalizeRgba(rgba);
    var r = value[0], g = value[1], b = value[2];
    var max = Math.max(r, g, b);
    var min = Math.min(r, g, b);
    var delta = max - min;
    var h = 0;
    var s = max === 0 ? 0 : delta / max;
    var v = max;

    if (delta !== 0) {
      if (max === r) h = ((g - b) / delta) % 6;
      else if (max === g) h = ((b - r) / delta) + 2;
      else h = ((r - g) / delta) + 4;
      h *= 60;
      if (h < 0) h += 360;
    }

    return { h: h, s: s, v: v };
  }

  function hsvToRgb(h, s, v, a) {
    var hue = ((Number(h) % 360) + 360) % 360;
    var sat = clamp(toFiniteNumber(s, 1), 0, 1);
    var val = clamp(toFiniteNumber(v, 1), 0, 1);
    var c = val * sat;
    var x = c * (1 - Math.abs((hue / 60) % 2 - 1));
    var m = val - c;
    var r = 0, g = 0, b = 0;

    if (hue < 60) { r = c; g = x; b = 0; }
    else if (hue < 120) { r = x; g = c; b = 0; }
    else if (hue < 180) { r = 0; g = c; b = x; }
    else if (hue < 240) { r = 0; g = x; b = c; }
    else if (hue < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }

    return [
      clamp(r + m, 0, 1),
      clamp(g + m, 0, 1),
      clamp(b + m, 0, 1),
      clamp(toFiniteNumber(a, 1), 0, 1)
    ];
  }

  function formatAlpha(value) {
    var alpha = clamp(toFiniteNumber(value, 1), 0, 1);
    var text = alpha.toFixed(2);
    text = text.replace(/0+$/, "").replace(/\.$/, "");
    return text || "0";
  }

  function syncColorFields() {
    var rgba = normalizeRgba(colorDialogState.rgba);
    var rInput = qs("#color-r-input");
    var gInput = qs("#color-g-input");
    var bInput = qs("#color-b-input");
    var aInput = qs("#color-a-input");
    if (rInput) rInput.value = String(Math.round(rgba[0] * 255));
    if (gInput) gInput.value = String(Math.round(rgba[1] * 255));
    if (bInput) bInput.value = String(Math.round(rgba[2] * 255));
    if (aInput) aInput.value = formatAlpha(rgba[3]);
  }

  function updateColorDialogUi() {
    var rgba = normalizeRgba(colorDialogState.rgba);
    var preview = qs("#color-preview");
    var strip = qs("#color-strip-range");
    if (preview) preview.style.background = rgbaToCss(rgba);
    if (strip) strip.value = String(Math.round(colorDialogState.hue || 0));
    syncColorFields();
  }

  function updateColorStateFromInputs() {
    var rInput = qs("#color-r-input");
    var gInput = qs("#color-g-input");
    var bInput = qs("#color-b-input");
    var aInput = qs("#color-a-input");
    var rgba = [
      clamp(toFiniteNumber(rInput && rInput.value, 255), 0, 255) / 255,
      clamp(toFiniteNumber(gInput && gInput.value, 255), 0, 255) / 255,
      clamp(toFiniteNumber(bInput && bInput.value, 255), 0, 255) / 255,
      clamp(toFiniteNumber(aInput && aInput.value, 1), 0, 1)
    ];
    colorDialogState.rgba = rgba;
    colorDialogState.hue = rgbToHsv(rgba).h;
    updateColorDialogUi();
  }

  function showDialog(name) {
    if (activeDialog) hideDialog();
    var dlg = qs("#dialog-" + name);
    if (!dlg) return;
    dlg.style.display = "flex";
    activeDialog = dlg;
  }

  function hideDialog() {
    if (!activeDialog) return;
    activeDialog.style.display = "none";
    activeDialog = null;
  }

  // ─── Build all dialogs ────────────────────────────────────────────

  function buildDialogs() {
    var root = APP.getRoot();

    // ── Load dialog ──────────────────────────────────────────────
    var loadD = el("div", {
      id: "dialog-load",
      className: "dialog-overlay",
      style: { display: "none" },
    }, [
      el("div", { className: "dialog" }, [
        el("div", { className: "dialog-header" }, [
          el("h3", { textContent: "Load Script" }),
          el("button", {
            className: "dialog-close",
            dataset: { action: "close-load" },
            textContent: "\u00D7",
          }),
        ]),
        el("div", { className: "dialog-content" }, [
          el("div", { id: "script-list", className: "script-list" }),
        ]),
        el("div", { className: "dialog-footer" }, [
          el("button", {
            className: "btn secondary",
            dataset: { action: "close-load" },
            textContent: "Cancel",
          }),
        ]),
      ]),
    ]);
    root.appendChild(loadD);

    // ── Save As dialog ────────────────────────────────────────────
    var saveasD = el("div", {
      id: "dialog-saveas",
      className: "dialog-overlay",
      style: { display: "none" },
    }, [
      el("div", { className: "dialog" }, [
        el("div", { className: "dialog-header" }, [
          el("h3", { textContent: "Save As" }),
          el("button", {
            className: "dialog-close",
            dataset: { action: "close-saveas" },
            textContent: "\u00D7",
          }),
        ]),
        el("div", { className: "dialog-content" }, [
          el("label", { textContent: "Script Name" }),
          el("input", {
            type: "text",
            id: "saveas-name",
            className: "saveas-input",
            placeholder: "my-layout",
          }),
          el("p", { className: "save-note", textContent: "Saves the current layout" }),
        ]),
        el("div", { className: "dialog-footer" }, [
          el("button", {
            className: "btn secondary",
            dataset: { action: "close-saveas" },
            textContent: "Cancel",
          }),
          el("button", {
            className: "btn primary",
            dataset: { action: "confirm-saveas" },
            textContent: "Save",
          }),
        ]),
      ]),
    ]);
    root.appendChild(saveasD);

    var colorD = el("div", {
      id: "dialog-color",
      className: "dialog-overlay",
      style: { display: "none" },
    }, [
      el("div", { className: "dialog" }, [
        el("div", { className: "dialog-header" }, [
          el("h3", { textContent: "Choose Color" }),
          el("button", {
            className: "dialog-close",
            dataset: { action: "close-color" },
            textContent: "\u00D7",
          }),
        ]),
        el("div", { className: "dialog-content" }, [
          el("div", { id: "color-preview", className: "dialog-color-preview" }),
          el("label", { className: "color-strip-label", textContent: "Color Strip" }),
          el("input", {
            type: "range",
            id: "color-strip-range",
            className: "color-strip-range",
            min: "0",
            max: "360",
            step: "1",
            value: "0",
          }),
          el("div", { className: "color-field-row" }, [
            el("label", { className: "color-field", for: "color-r-input" }, [
              el("span", { className: "color-field-label", textContent: "R" }),
              el("input", { type: "text", id: "color-r-input", className: "color-number-input", inputmode: "numeric", maxlength: "4" }),
            ]),
            el("label", { className: "color-field", for: "color-g-input" }, [
              el("span", { className: "color-field-label", textContent: "G" }),
              el("input", { type: "text", id: "color-g-input", className: "color-number-input", inputmode: "numeric", maxlength: "4" }),
            ]),
            el("label", { className: "color-field", for: "color-b-input" }, [
              el("span", { className: "color-field-label", textContent: "B" }),
              el("input", { type: "text", id: "color-b-input", className: "color-number-input", inputmode: "numeric", maxlength: "4" }),
            ]),
            el("label", { className: "color-field", for: "color-a-input" }, [
              el("span", { className: "color-field-label", textContent: "A" }),
              el("input", { type: "text", id: "color-a-input", className: "color-number-input", inputmode: "decimal", maxlength: "4" }),
            ]),
          ]),
          el("p", { className: "save-note", textContent: "R, G, B use 0-255. A uses 0-1." }),
        ]),
        el("div", { className: "dialog-footer" }, [
          el("button", {
            className: "btn secondary",
            dataset: { action: "close-color" },
            textContent: "Cancel",
          }),
          el("button", {
            className: "btn primary",
            dataset: { action: "confirm-color" },
            textContent: "Apply",
          }),
        ]),
      ]),
    ]);
    root.appendChild(colorD);

    // ── Close confirmation dialog ─────────────────────────────────
    var closeD = el("div", {
      id: "dialog-close",
      className: "dialog-overlay",
        style: { display: "none" },
      }, [
        el("div", { className: "dialog" }, [
          el("div", { className: "dialog-content centered" }, [
          el("div", { className: "confirm-icon", "aria-hidden": "true" }),
          el("h3", { textContent: "Unsaved Changes" }),
          el("p", { textContent: "You have unsaved changes. What would you like to do?" }),
        ]),
        el("div", { className: "dialog-footer centered" }, [
          el("button", {
            className: "btn secondary",
            dataset: { action: "close-cancel" },
            textContent: "Keep Editing",
          }),
          el("button", {
            className: "btn danger",
            dataset: { action: "close-discard" },
            textContent: "Discard",
          }),
          el("button", {
            className: "btn primary",
            dataset: { action: "close-save" },
            textContent: "Save & Close",
          }),
        ]),
      ]),
    ]);
    root.appendChild(closeD);
  }

  // ─── Load dialog content ───────────────────────────────────────────

  function populateScriptList(scripts) {
    var list = qs("#script-list");
    if (!list) return;

    // Clear existing
    while (list.firstChild) {
      list.removeChild(list.firstChild);
    }

    if (!scripts || scripts.length === 0) {
      var empty = el("div", {
        className: "empty-state",
        style: { padding: "20px", textAlign: "center", color: "#666" },
      }, [
        el("p", { textContent: "No saved scripts found." }),
      ]);
      list.appendChild(empty);
      return;
    }

    scripts.forEach(function (script) {
      var item = el("div", {
        className: "script-item",
        dataset: { scriptId: script.id },
      }, [
        el("div", { className: "script-name", textContent: script.name || script.id }),
        el("div", { className: "script-meta", textContent: formatDate(script.modified) }),
      ]);
      list.appendChild(item);
    });
  }

  function formatDate(timestamp) {
    if (!timestamp) return "";
    var d = new Date(timestamp * 1000);
    return d.toLocaleDateString() + " " + d.toLocaleTimeString();
  }

  // ─── Click delegation ───────────────────────────────────────────────

  function onDialogClick(e) {
    var action = e.target.dataset.action;
    if (!action) return;

    if (action === "close-load") {
      hideDialog();
    } else if (action === "close-saveas") {
      hideDialog();
    } else if (action === "close-color") {
      hideDialog();
    } else if (action === "close-cancel") {
      hideDialog();
    } else if (action === "close-discard") {
      APP.state.isDirty = false;
      hideDialog();
      APP.goToStart();
    } else if (action === "close-save") {
      hideDialog();
      if (APP.state && APP.state.editorContext && APP.state.editorContext.canAccessOnStart) {
        APP.emit("save");
      } else if (APP.fileSync && typeof APP.fileSync.save === "function") {
        var id = APP.fileSync.save(APP.state.document && APP.state.document.name || "Layout");
        if (id) {
          APP.emit("toast", { type: "success", text: "Layout saved" });
          APP.goToStart();
        } else {
          APP.emit("toast", { type: "error", text: "Save failed" });
        }
      } else {
        APP.emit("save");
      }
    } else if (action === "confirm-saveas") {
      var nameInput = qs("#saveas-name");
      var name = nameInput ? nameInput.value.trim() : "";
      if (name) {
        APP.emit("saveas-confirm", name);
        hideDialog();
      }
    } else if (action === "confirm-color") {
      if (!colorDialogState.prop) return;
      updateColorStateFromInputs();
      APP.emit("color-picked", {
        prop: colorDialogState.prop,
        rgba: normalizeRgba(colorDialogState.rgba)
      });
      hideDialog();
    }
  }

  function onDialogInput(e) {
    if (!e.target) return;
    if (e.target.id === "color-strip-range") {
      colorDialogState.hue = clamp(toFiniteNumber(e.target.value, 0), 0, 360);
      colorDialogState.rgba = hsvToRgb(colorDialogState.hue, 1, 1, colorDialogState.rgba[3]);
      updateColorDialogUi();
      return;
    }
    if (
      e.target.id === "color-r-input" ||
      e.target.id === "color-g-input" ||
      e.target.id === "color-b-input" ||
      e.target.id === "color-a-input"
    ) {
      updateColorStateFromInputs();
    }
  }

  // ─── Script item click ─────────────────────────────────────────────

  function onScriptListClick(e) {
    var item = e.target.closest(".script-item");
    if (!item) return;
    var scriptId = item.dataset.scriptId;
    if (scriptId) {
      APP.emit("load-confirm", scriptId);
      hideDialog();
    }
  }

  // ─── Event listeners ───────────────────────────────────────────────

  APP.on("load-dialog-open", function () {
    showDialog("load");
    // Emit event to request script list (board/databank will respond)
    APP.emit("request-script-list");
  });

  APP.on("saveas-dialog-open", function () {
    showDialog("saveas");
    var input = qs("#saveas-name");
    if (input) input.value = "";
  });

  APP.on("color-dialog-open", function (payload) {
    colorDialogState.prop = payload && payload.prop ? String(payload.prop) : null;
    colorDialogState.rgba = normalizeRgba(payload && payload.rgba);
    colorDialogState.hue = rgbToHsv(colorDialogState.rgba).h;
    showDialog("color");
    updateColorDialogUi();
    var input = qs("#color-r-input");
    if (input) {
      if (typeof input.focus === "function") input.focus();
      if (typeof input.select === "function") input.select();
    }
  });

  APP.on("close-editor", function () {
    if (APP.state.isDirty) {
      showDialog("close");
    } else {
      APP.goToStart();
    }
  });

  // Receive script list from board/databank
  APP.on("script-list-response", function (scripts) {
    populateScriptList(scripts);
  });

  APP.on("close-dialog", function () {
    hideDialog();
  });

  // ─── Bootstrap ─────────────────────────────────────────────────────

  APP.init = (function (origInit) {
    return function () {
      origInit();
      buildDialogs();

      // Attach click delegation to dialogs
      var root = APP.getRoot();
      root.addEventListener("click", onDialogClick);
      root.addEventListener("input", onDialogInput);
      var scriptList = qs("#script-list", root);
      if (scriptList) {
        scriptList.addEventListener("click", onScriptListClick);
      }
    };
  })(APP.init);

  // If already initialized, build now
  if (APP.getRoot().childElementCount > 0) {
    buildDialogs();
    var root = APP.getRoot();
    root.addEventListener("click", onDialogClick);
    root.addEventListener("input", onDialogInput);
    var scriptList = qs("#script-list", root);
    if (scriptList) {
      scriptList.addEventListener("click", onScriptListClick);
    }
  }

})();

