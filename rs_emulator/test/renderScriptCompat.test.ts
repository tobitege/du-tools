import { describe, expect, it } from "vitest";
import {
  DU_ALIGN_H,
  DU_ALIGN_V,
  DU_FONT_CATALOG,
  DU_RENDER_COST_MAX,
  DU_RS_VERSION,
  DU_SHAPE,
  costAddBox,
  costAddText,
  costCreateLayer,
  getDUFontMetadata,
} from "../src/emulator/renderScriptCompat";
import { RSAlignHor, RSAlignVer, RSShape, buildDefaultLayerStyles } from "../src/emulator/types";

describe("renderScriptCompat core contract", () => {
  it("keeps DU constants aligned across compat and exported types", () => {
    expect(DU_RS_VERSION).toBe(2);
    expect(DU_RENDER_COST_MAX).toBe(10_000);

    expect(RSShape).toEqual(DU_SHAPE);
    expect(RSAlignHor).toEqual(DU_ALIGN_H);
    expect(RSAlignVer).toEqual(DU_ALIGN_V);
  });

  it("exposes the DU font catalog in the documented order", () => {
    expect(DU_FONT_CATALOG).toEqual([
      "FiraMono",
      "FiraMono-Bold",
      "Montserrat",
      "Montserrat-Bold",
      "Montserrat-Light",
      "Play",
      "Play-Bold",
      "RefrigeratorDeluxe",
      "RefrigeratorDeluxe-Light",
      "RobotoCondensed",
      "RobotoMono",
      "RobotoMono-Bold",
    ]);
  });

  it("stores deterministic metadata for supported DU fonts", () => {
    const mono = getDUFontMetadata("RobotoMono");
    const play = getDUFontMetadata("Play");

    expect(mono).toMatchObject({
      displayFamily: '"Roboto Mono", monospace',
      ascenderMultiplier: expect.any(Number),
      descenderMultiplier: expect.any(Number),
    });
    expect(play).toMatchObject({
      displayFamily: '"Play", sans-serif',
      averageWidthMultiplier: expect.any(Number),
      averageHeightMultiplier: expect.any(Number),
    });
    expect(getDUFontMetadata("Arial")).toBeNull();
  });

  it("builds DU per-shape defaults for line, bezier, and text", () => {
    const styles = buildDefaultLayerStyles();

    expect(styles[DU_SHAPE.Line]).toMatchObject({
      strokeWidth: 1,
      strokeColor: [1, 1, 1, 1],
    });
    expect(styles[DU_SHAPE.Bezier]).toMatchObject({
      strokeWidth: 1,
      strokeColor: [1, 1, 1, 1],
    });
    expect(styles[DU_SHAPE.Text]).toMatchObject({
      strokeWidth: 0,
      textAlign: { hor: DU_ALIGN_H.Left, ver: DU_ALIGN_V.Baseline },
    });
  });

  it("uses the emulator's lightweight render cost helpers", () => {
    expect(costCreateLayer()).toBe(0);
    expect(costAddBox(10, 10)).toBe(1);
    expect(costAddBox(10, 10, 1)).toBe(1);
    expect(costAddBox(10, 10, 5, 5)).toBe(1);
    expect(costAddText(5.39, 20.63)).toBe(1);
    expect(costAddText(17.55, 20.63)).toBe(1);
    expect(costAddText(17.55, 20.63, 1)).toBe(1);
    expect(costAddText(17.55, 20.63, 5, 5)).toBe(1);
  });
});
