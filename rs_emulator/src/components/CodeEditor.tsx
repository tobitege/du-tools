import { forwardRef, useRef, useCallback, useEffect, useImperativeHandle, useMemo } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  fontSize: number;
  theme: "vs" | "vs-dark";
}

export interface CodeEditorHandle {
  highlightErrorLine: (lineNumber: number | null) => void;
}

// RenderScript API completions
const RS_COMPLETIONS: { label: string; kind: string; insertText: string; detail: string }[] = [
  { label: "createLayer", kind: "Function", insertText: "createLayer()", detail: "Create a new render layer" },
  { label: "addBox", kind: "Function", insertText: "addBox(${1:layer}, ${2:x}, ${3:y}, ${4:width}, ${5:height})", detail: "Add a box shape" },
  { label: "addBoxRounded", kind: "Function", insertText: "addBoxRounded(${1:layer}, ${2:x}, ${3:y}, ${4:width}, ${5:height}, ${6:radius})", detail: "Add a rounded box" },
  { label: "addCircle", kind: "Function", insertText: "addCircle(${1:layer}, ${2:x}, ${3:y}, ${4:radius})", detail: "Add a circle" },
  { label: "addLine", kind: "Function", insertText: "addLine(${1:layer}, ${2:x1}, ${3:y1}, ${4:x2}, ${5:y2})", detail: "Add a line" },
  { label: "addBezier", kind: "Function", insertText: "addBezier(${1:layer}, ${2:x1}, ${3:y1}, ${4:x2}, ${5:y2}, ${6:x3}, ${7:y3})", detail: "Add a bezier curve" },
  { label: "addQuad", kind: "Function", insertText: "addQuad(${1:layer}, ${2:x1}, ${3:y1}, ${4:x2}, ${5:y2}, ${6:x3}, ${7:y3}, ${8:x4}, ${9:y4})", detail: "Add a quad" },
  { label: "addTriangle", kind: "Function", insertText: "addTriangle(${1:layer}, ${2:x1}, ${3:y1}, ${4:x2}, ${5:y2}, ${6:x3}, ${7:y3})", detail: "Add a triangle" },
  { label: "addText", kind: "Function", insertText: "addText(${1:layer}, ${2:font}, \"${3:text}\", ${4:x}, ${5:y})", detail: "Add text" },
  { label: "addImage", kind: "Function", insertText: "addImage(${1:layer}, ${2:image}, ${3:x}, ${4:y}, ${5:width}, ${6:height})", detail: "Add an image" },
  { label: "loadFont", kind: "Function", insertText: "loadFont(\"${1:Arial}\", ${2:16})", detail: "Load a font" },
  { label: "loadImage", kind: "Function", insertText: "loadImage(\"${1:url}\")", detail: "Load an image from URL" },
  { label: "setBackgroundColor", kind: "Function", insertText: "setBackgroundColor(${1:r}, ${2:g}, ${3:b})", detail: "Set background color" },
  { label: "setDefaultFillColor", kind: "Function", insertText: "setDefaultFillColor(${1:layer}, ${2:shape}, ${3:r}, ${4:g}, ${5:b}, ${6:a})", detail: "Set default fill color" },
  { label: "setDefaultStrokeColor", kind: "Function", insertText: "setDefaultStrokeColor(${1:layer}, ${2:shape}, ${3:r}, ${4:g}, ${5:b}, ${6:a})", detail: "Set default stroke color" },
  { label: "setDefaultStrokeWidth", kind: "Function", insertText: "setDefaultStrokeWidth(${1:layer}, ${2:shape}, ${3:width})", detail: "Set default stroke width" },
  { label: "setDefaultShadow", kind: "Function", insertText: "setDefaultShadow(${1:layer}, ${2:shape}, ${3:radius}, ${4:r}, ${5:g}, ${6:b}, ${7:a})", detail: "Set default shadow" },
  { label: "setDefaultRotation", kind: "Function", insertText: "setDefaultRotation(${1:layer}, ${2:shape}, ${3:radians})", detail: "Set default rotation" },
  { label: "setDefaultTextAlign", kind: "Function", insertText: "setDefaultTextAlign(${1:layer}, ${2:hor}, ${3:ver})", detail: "Set default text alignment" },
  { label: "setNextFillColor", kind: "Function", insertText: "setNextFillColor(${1:layer}, ${2:r}, ${3:g}, ${4:b}, ${5:a})", detail: "Set next fill color" },
  { label: "setNextStrokeColor", kind: "Function", insertText: "setNextStrokeColor(${1:layer}, ${2:r}, ${3:g}, ${4:b}, ${5:a})", detail: "Set next stroke color" },
  { label: "setNextStrokeWidth", kind: "Function", insertText: "setNextStrokeWidth(${1:layer}, ${2:width})", detail: "Set next stroke width" },
  { label: "setNextShadow", kind: "Function", insertText: "setNextShadow(${1:layer}, ${2:radius}, ${3:r}, ${4:g}, ${5:b}, ${6:a})", detail: "Set next shadow" },
  { label: "setNextRotation", kind: "Function", insertText: "setNextRotation(${1:layer}, ${2:radians})", detail: "Set next rotation" },
  { label: "setNextRotationDegrees", kind: "Function", insertText: "setNextRotationDegrees(${1:layer}, ${2:degrees})", detail: "Set next rotation in degrees" },
  { label: "setNextTextAlign", kind: "Function", insertText: "setNextTextAlign(${1:layer}, ${2:hor}, ${3:ver})", detail: "Set next text alignment" },
  { label: "setLayerClipRect", kind: "Function", insertText: "setLayerClipRect(${1:layer}, ${2:x}, ${3:y}, ${4:width}, ${5:height})", detail: "Set layer clip rect" },
  { label: "setLayerOrigin", kind: "Function", insertText: "setLayerOrigin(${1:layer}, ${2:x}, ${3:y})", detail: "Set layer transform origin" },
  { label: "setLayerRotation", kind: "Function", insertText: "setLayerRotation(${1:layer}, ${2:radians})", detail: "Set layer rotation" },
  { label: "setLayerScale", kind: "Function", insertText: "setLayerScale(${1:layer}, ${2:sx}, ${3:sy})", detail: "Set layer scale" },
  { label: "setLayerTranslation", kind: "Function", insertText: "setLayerTranslation(${1:layer}, ${2:tx}, ${3:ty})", detail: "Set layer translation" },
  { label: "getCursor", kind: "Function", insertText: "local x, y = getCursor()", detail: "Get cursor position" },
  { label: "getCursorDown", kind: "Function", insertText: "local down = getCursorDown()", detail: "Get cursor down state" },
  { label: "getCursorPressed", kind: "Function", insertText: "local pressed = getCursorPressed()", detail: "Get cursor pressed event" },
  { label: "getCursorReleased", kind: "Function", insertText: "local released = getCursorReleased()", detail: "Get cursor released event" },
  { label: "getDeltaTime", kind: "Function", insertText: "local dt = getDeltaTime()", detail: "Get delta time" },
  { label: "getTime", kind: "Function", insertText: "local t = getTime()", detail: "Get elapsed time" },
  { label: "getResolution", kind: "Function", insertText: "local w, h = getResolution()", detail: "Get screen resolution" },
  { label: "getTextBounds", kind: "Function", insertText: "local bw, bh = getTextBounds(${1:font}, \"${2:text}\")", detail: "Get text bounding box" },
  { label: "getInput", kind: "Function", insertText: "local input = getInput()", detail: "Get script input" },
  { label: "setOutput", kind: "Function", insertText: "setOutput(\"${1:output}\")", detail: "Set script output" },
  { label: "logMessage", kind: "Function", insertText: "logMessage(\"${1:message}\")", detail: "Log a debug message" },
  { label: "requestAnimationFrame", kind: "Function", insertText: "requestAnimationFrame(${1:1})", detail: "Request animation frame" },
  { label: "setFontSize", kind: "Function", insertText: "setFontSize(${1:font}, ${2:size})", detail: "Set font size" },
  { label: "getFontSize", kind: "Function", insertText: "local size = getFontSize(${1:font})", detail: "Get font size" },
  { label: "getFontMetrics", kind: "Function", insertText: "local asc, desc = getFontMetrics(${1:font})", detail: "Get font metrics" },
];

const RS_SNIPPETS = [
  {
    label: "rs-boilerplate",
    insertText: [
      "local layer = createLayer()",
      "local font = loadFont(\"Arial\", 20)",
      "",
      "setBackgroundColor(0.1, 0.1, 0.15)",
      "",
      "-- your code here",
      "setNextFillColor(layer, 1, 1, 1, 1)",
      "addBox(layer, 100, 100, 200, 100)",
      "",
      "addText(layer, font, \"Hello RenderScript\", 100, 250)",
    ].join("\n"),
    detail: "RenderScript boilerplate",
  },
  {
    label: "rs-animated-circle",
    insertText: [
      "local layer = createLayer()",
      "",
      "setBackgroundColor(0.05, 0.05, 0.1)",
      "",
      "local t = getTime()",
      "local w, h = getResolution()",
      "local cx = w / 2 + math.sin(t * 2) * 100",
      "local cy = h / 2 + math.cos(t * 2) * 100",
      "",
      "setNextFillColor(layer, 0.3, 0.7, 1, 1)",
      "addCircle(layer, cx, cy, 40)",
      "",
      "requestAnimationFrame(1)",
    ].join("\n"),
    detail: "Animated bouncing circle",
  },
];

export const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(function CodeEditor({ value, onChange, onRun, fontSize, theme }, ref) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import("monaco-editor") | null>(null);
  const decorationIdsRef = useRef<string[]>([]);
  const clearHighlightTimerRef = useRef<number>(0);
  const editorOptions = useMemo(() => ({
    fontSize,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    wordWrap: "on" as const,
    tabSize: 2,
    automaticLayout: true,
    suggest: { showKeywords: true },
    padding: { top: 12 },
  }), [fontSize]);

  useEffect(() => {
    editorRef.current?.updateOptions(editorOptions);
  }, [editorOptions]);

  const clearHighlightedLine = useCallback(() => {
    const editorInstance = editorRef.current;
    if (!editorInstance) {
      return;
    }

    decorationIdsRef.current = editorInstance.deltaDecorations(decorationIdsRef.current, []);

    if (clearHighlightTimerRef.current) {
      window.clearTimeout(clearHighlightTimerRef.current);
      clearHighlightTimerRef.current = 0;
    }
  }, []);

  useEffect(() => () => {
    if (clearHighlightTimerRef.current) {
      window.clearTimeout(clearHighlightTimerRef.current);
    }
  }, []);

  useImperativeHandle(ref, () => ({
    highlightErrorLine(lineNumber) {
      const editorInstance = editorRef.current;
      const monaco = monacoRef.current;
      const model = editorInstance?.getModel();

      if (!editorInstance || !model || !monaco) {
        return;
      }

      const maxLineNumber = model.getLineCount();
      const safeLineNumber = lineNumber && lineNumber > 0 && lineNumber <= maxLineNumber ? lineNumber : null;

      if (!safeLineNumber) {
        clearHighlightedLine();
        return;
      }

      decorationIdsRef.current = editorInstance.deltaDecorations(decorationIdsRef.current, [{
        range: new monaco.Range(safeLineNumber, 1, safeLineNumber, 1),
        options: {
          isWholeLine: true,
          className: "rs-editor-error-line",
          linesDecorationsClassName: "rs-editor-error-line-gutter",
        },
      }]);

      if (clearHighlightTimerRef.current) {
        window.clearTimeout(clearHighlightTimerRef.current);
      }
      clearHighlightTimerRef.current = window.setTimeout(() => {
        clearHighlightedLine();
      }, 4000);

      editorInstance.setPosition({ lineNumber: safeLineNumber, column: 1 });
      const visible = editorInstance.getVisibleRanges().some((range) => (
        safeLineNumber >= range.startLineNumber && safeLineNumber <= range.endLineNumber
      ));

      if (!visible) {
        editorInstance.revealLineInCenter(safeLineNumber);
      }
    },
  }), [clearHighlightedLine]);

  const handleMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;

      // Register Lua language if not already
      monaco.languages.register({ id: "lua" });

      // Simple Lua tokenizer
      monaco.languages.setMonarchTokensProvider("lua", {
        defaultToken: "",
        tokenPostfix: ".lua",
        keywords: [
          "and", "break", "do", "else", "elseif", "end", "false", "for",
          "function", "goto", "if", "in", "local", "nil", "not", "or",
          "repeat", "return", "then", "true", "until", "while",
        ],
        builtins: [
          "assert", "collectgarbage", "dofile", "error", "getmetatable",
          "ipairs", "load", "loadfile", "next", "pairs", "pcall", "print",
          "rawequal", "rawget", "rawlen", "rawset", "require", "select",
          "setmetatable", "tonumber", "tostring", "type", "warn", "xpcall",
          "math", "string", "table", "io", "os",
          // RenderScript globals
          "RSShape", "RSAlignHor", "RSAlignVer",
          "createLayer", "addBox", "addBoxRounded", "addCircle", "addLine",
          "addBezier", "addQuad", "addTriangle", "addText", "addImage", "addImageSub",
          "loadFont", "loadImage", "setBackgroundColor",
          "setDefaultFillColor", "setDefaultStrokeColor", "setDefaultStrokeWidth",
          "setDefaultShadow", "setDefaultRotation", "setDefaultTextAlign",
          "setNextFillColor", "setNextStrokeColor", "setNextStrokeWidth",
          "setNextShadow", "setNextRotation", "setNextRotationDegrees", "setNextTextAlign",
          "setLayerClipRect", "setLayerOrigin", "setLayerRotation", "setLayerScale", "setLayerTranslation",
          "getCursor", "getCursorDown", "getCursorPressed", "getCursorReleased",
          "getDeltaTime", "getTime", "getResolution", "getTextBounds", "getInput",
          "getFontSize", "setFontSize", "getFontMetrics", "getAvailableFontCount", "getAvailableFontName",
          "isImageLoaded", "getImageSize",
          "setOutput", "logMessage", "requestAnimationFrame",
        ],
        brackets: [
          { open: "{", close: "}", token: "delimiter.curly" },
          { open: "[", close: "]", token: "delimiter.bracket" },
          { open: "(", close: ")", token: "delimiter.parenthesis" },
        ],
        tokenizer: {
          root: [
            [/--\[\[/, "comment", "@comment_multi"],
            [/--.*$/, "comment"],
            [/"([^"\\]|\\.)*"/, "string"],
            [/'([^'\\]|\\.)*'/, "string"],
            [/\[\[([^\]]|\][^\]])*\]\]/, "string"],
            [/\d+(\.\d*)?([eE][\-+]?\d+)?/, "number"],
            [/\.\d+([eE][\-+]?\d+)?/, "number"],
            [/[a-zA-Z_]\w*/, {
              cases: {
                "@keywords": "keyword",
                "@builtins": "identifier",
                "@default": "identifier",
              },
            }],
            [/[{}()\[\]]/, "@brackets"],
            [/[<>!~=+\-*\/%#^]/, "operator"],
            [/[;,.]/, "delimiter"],
          ],
          comment_multi: [
            [/\]\]/, "comment", "@pop"],
            [/./, "comment"],
          ],
        },
      });

      // Register completions
      monaco.languages.registerCompletionItemProvider("lua", {
        provideCompletionItems(model: any, position: any) {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };

          const items: any[] = RS_COMPLETIONS.map((c) => ({
            label: c.label,
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: c.insertText,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: c.detail,
            range,
          }));

          // Add snippets
          for (const s of RS_SNIPPETS) {
            items.push({
              label: s.label,
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: s.insertText,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              detail: s.detail,
              range,
            });
          }

          return { suggestions: items };
        },
      });

      // Ctrl+Enter to run
      editor.addAction({
        id: "run-script",
        label: "Run RenderScript",
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
        run: () => onRun(),
      });
    },
    [onRun]
  );

  return (
    <Editor
      height="100%"
      language="lua"
      theme={theme}
      value={value}
      onChange={(v) => onChange(v ?? "")}
      onMount={handleMount}
      options={editorOptions}
    />
  );
});
