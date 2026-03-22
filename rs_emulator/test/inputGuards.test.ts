import { describe, expect, it } from "vitest";
import {
  normalizeImageSource,
  sanitizeLuaFileStem,
  sanitizeSessionName,
  validateGitHubLuaUrl,
  validateImportedSessionFile,
  validateImportedSessionText,
} from "../src/security/inputGuards";

describe("input guards", () => {
  it("accepts safe imported Lua files", () => {
    const result = validateImportedSessionFile(new File(["print('ok')"], "screen.lua", { type: "text/plain" }));

    expect(result).toEqual({
      ok: true,
      value: {
        safeFileName: "screen.lua",
        sessionName: "screen",
      },
    });
  });

  it("rejects imported files with path-like names", () => {
    const suspiciousFiles = [
      new File(["print('ok')"], "../screen.lua", { type: "text/plain" }),
      new File(["print('ok')"], "..\\screen.lua", { type: "text/plain" }),
      new File(["print('ok')"], "\\\\server\\share\\screen.lua", { type: "text/plain" }),
      new File(["print('ok')"], "C:\\temp\\screen.lua", { type: "text/plain" }),
      new File(["print('ok')"], "screen.lua\u0000.txt", { type: "text/plain" }),
    ];

    for (const file of suspiciousFiles) {
      expect(validateImportedSessionFile(file)).toEqual({
        ok: false,
        reason: "unsafe file name or path",
      });
    }
  });

  it("rejects imported files with disallowed extensions or oversized payloads", () => {
    expect(validateImportedSessionFile(new File(["not lua"], "payload.exe", { type: "application/octet-stream" }))).toEqual({
      ok: false,
      reason: "only .lua or .txt files are allowed",
    });

    expect(validateImportedSessionFile(new File(["x".repeat(1024 * 1024 + 1)], "screen.lua", { type: "text/plain" }))).toEqual({
      ok: false,
      reason: "file is too large",
    });
  });

  it("accepts GitHub blob and raw URLs for Lua files", () => {
    expect(validateGitHubLuaUrl("https://github.com/example/render-scripts/blob/main/screens/ship.lua")).toEqual({
      ok: true,
      value: {
        safeFileName: "ship.lua",
        sessionName: "ship",
        remoteSourceUrl: "https://raw.githubusercontent.com/example/render-scripts/main/screens/ship.lua",
      },
    });

    expect(validateGitHubLuaUrl("https://raw.githubusercontent.com/example/render-scripts/main/screens/ship.lua")).toEqual({
      ok: true,
      value: {
        safeFileName: "ship.lua",
        sessionName: "ship",
        remoteSourceUrl: "https://raw.githubusercontent.com/example/render-scripts/main/screens/ship.lua",
      },
    });
  });

  it("rejects unsupported GitHub URLs", () => {
    const blocked = [
      "http://github.com/example/render-scripts/blob/main/ship.lua",
      "https://github.com/example/render-scripts/blob/main/ship.txt",
      "https://github.com/example/render-scripts/blob/main/%2e%2e/ship.lua",
      "https://github.com/example/render-scripts/blob/main/folder%2Fship.lua",
      "https://github.com/example/render-scripts/blob/main/ship.lua?raw=1",
      "https://gitlab.com/example/render-scripts/-/blob/main/ship.lua",
    ];

    for (const source of blocked) {
      expect(validateGitHubLuaUrl(source).ok).toBe(false);
    }
  });

  it("rejects loadImage path traversal and local-path inputs", () => {
    const blocked = [
      "assets.prod.novaquark.com/../secret.png",
      "assets.prod.novaquark.com/%2e%2e/secret.png",
      "assets.prod.novaquark.com/%2E%2E%2Fsecret.png",
      "assets.prod.novaquark.com/4745/%2fsecret.png",
      "assets.prod.novaquark.com/4745/%5csecret.png",
      "assets.prod.novaquark.com\\4745\\example.jpg",
      "file:///C:/Windows/win.ini",
      "C:\\Windows\\win.ini",
      "\\\\server\\share\\image.png",
      "//server/share/image.png",
      "/etc/passwd",
      "assets.prod.novaquark.com/4745/example.jpg?x=1",
      "assets.prod.novaquark.com/4745/example.jpg#frag",
      "assets.prod.novaquark.com:443/4745/example.jpg",
      "assets.prod.novaquark.com@evil.com/4745/example.jpg",
    ];

    for (const source of blocked) {
      expect(normalizeImageSource(source)).toBeNull();
    }
  });

  it("rejects unsafe data image payloads while keeping safe raster payloads", () => {
    expect(normalizeImageSource("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=")).toBeNull();
    expect(normalizeImageSource("data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==")).toBeNull();
    expect(normalizeImageSource("data:image/png,raw")).toBeNull();
    expect(normalizeImageSource("data:image/png;base64,AAAA BBBB")).toBeNull();
    expect(normalizeImageSource("data:image/png;base64,iVBORw0KGgo=")).toBe("data:image/png;base64,iVBORw0KGgo=");
    expect(normalizeImageSource("data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==")).toBe("data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==");
  });

  it("sanitizes session names entered by the user", () => {
    expect(sanitizeSessionName("  My Cool Screen  ")).toBe("My Cool Screen");
    expect(sanitizeSessionName("../..\\CON:<bad>?name|")).toBe("CON bad name");
    expect(sanitizeSessionName("...\u0000   ")).toBe("Untitled");
  });

  it("sanitizes Lua file stems derived from session names", () => {
    expect(sanitizeLuaFileStem("My Cool Screen")).toBe("My_Cool_Screen");
    expect(sanitizeLuaFileStem("C:\\temp\\payload")).toBe("C_temp_payload");
    expect(sanitizeLuaFileStem("CON")).toBe("file-CON");
  });

  it("rejects oversized imported text payloads", () => {
    expect(validateImportedSessionText("print('ok')")).toEqual({ ok: true });
    expect(validateImportedSessionText("x".repeat(1024 * 1024 + 1))).toEqual({
      ok: false,
      reason: "file is too large",
    });
  });
});
