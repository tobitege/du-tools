import { vi } from "vitest";

class MockImage {
  crossOrigin = "";
  naturalWidth = 0;
  naturalHeight = 0;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  set src(_value: string) {
    // Tests can trigger load manually if needed.
  }
}

vi.stubGlobal("Image", MockImage);
