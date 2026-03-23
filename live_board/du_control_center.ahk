#Requires AutoHotkey v2.0
#SingleInstance Force

SetTitleMatchMode(2)
DetectHiddenWindows(false)
#Include du_view_common.ahk

GetMacroSpec(macroName) {
    specs := Map()
    specs["focus_center"] := { action: "focus_center" }
    specs["open_screen_editor"] := { action: "nudge_key", moveX: 0, moveY: -30, settleMs: 350, key: "{LCtrl down}l{LCtrl up}", actionName: "focus_nudge_and_ctrl_l", postKeyDelayMs: 300 }
    specs["close_screen_editor"] := { action: "key_repeat", key: "{Escape}", actionName: "focus_and_close_screen_editor", settleMs: 250, repeatCount: 2, repeatDelayMs: 200 }
    specs["press_f"] := { action: "key", key: "f", actionName: "focus_and_press_f", settleMs: 120 }
    specs["press_esc"] := { action: "key", key: "{Escape}", actionName: "focus_and_press_escape", settleMs: 120 }
    specs["open_options"] := { action: "key", key: "{Escape}", actionName: "focus_and_open_options", settleMs: 120 }
    specs["close_options"] := { action: "key", key: "{Escape}", actionName: "focus_and_close_options", settleMs: 120 }
    specs["click_client_percent"] := { action: "click_client_percent", settleMs: 120 }
    specs["click_client_px"] := { action: "click_client_px", settleMs: 120 }
    specs["ui_calibrate"] := { action: "ui_calibrate", settleMs: 120 }

    normalized := StrLower(Trim(String(macroName)))
    return specs.Has(normalized) ? specs[normalized] : ""
}

PrintUsage() {
    StdOut('Usage: du_control_center.ahk <macro-name> [--window-title "Dual Universe"] [--dpi 1600] [--baseline-dpi 1600]')
    StdOut("Macros: focus_center, open_screen_editor, close_screen_editor, press_f, press_esc, open_options, close_options, click_client_percent, click_client_px, ui_calibrate")
    StdOut('Extra for click_client_percent: --x-percent <0-100> --y-percent <0-100>')
    StdOut('Extra for click_client_px/ui_calibrate: --client-x <px> --client-y <px>')
}

Main() {
    if (A_Args.Length < 1) {
        PrintUsage()
        ExitApp(64)
    }

    macroName := StrLower(Trim(String(A_Args[1])))
    if (macroName = "help" || macroName = "--help" || macroName = "-h" || macroName = "list") {
        PrintUsage()
        ExitApp(0)
    }

    macroSpec := GetMacroSpec(macroName)
    if (macroSpec = "") {
        EmitResult({
            ok: false,
            action: "unknown_macro",
            windowTitle: "",
            targetHwnd: "",
            activeBefore: false,
            activeAfter: false,
            moveX: 0,
            moveY: 0,
            settleMs: 0,
            cursorX: 0,
            cursorY: 0,
            clientX: 0,
            clientY: 0,
            sendMode: "",
            error: "unknown_macro:" . macroName
        })
        ExitApp(64)
    }

    windowTitle := ReadOption("--window-title", "Dual Universe")
    dpi := ToInteger(ReadOption("--dpi", "1600"), 1600)
    baselineDpi := ToInteger(ReadOption("--baseline-dpi", "1600"), 1600)
    xPercent := ToInteger(ReadOption("--x-percent", "50"), 50)
    yPercent := ToInteger(ReadOption("--y-percent", "50"), 50)
    clientX := ToInteger(ReadOption("--client-x", "0"), 0)
    clientY := ToInteger(ReadOption("--client-y", "0"), 0)

    switch macroSpec.action {
        case "focus_center":
            result := FocusClientCenter(windowTitle)
            result.action := "focus_center"
        case "key":
            result := FocusAndSendKey(windowTitle, macroSpec.key, macroSpec.actionName, macroSpec.settleMs)
            result.action := macroName
        case "key_repeat":
            result := FocusAndSendKey(windowTitle, macroSpec.key, macroSpec.actionName, macroSpec.settleMs, macroSpec.repeatCount, macroSpec.repeatDelayMs)
            result.action := macroName
        case "nudge_key":
            moveX := ScaleDeltaForDpi(macroSpec.moveX, dpi, baselineDpi)
            moveY := ScaleDeltaForDpi(macroSpec.moveY, dpi, baselineDpi)
            result := FocusNudgeAndSendKey(windowTitle, moveX, moveY, macroSpec.key, macroSpec.actionName, macroSpec.settleMs, macroSpec.postKeyDelayMs)
            result.action := macroName
        case "click_client_percent":
            result := FocusAndClickClientPercent(windowTitle, xPercent, yPercent, macroSpec.settleMs)
            result.action := macroName
        case "click_client_px":
            result := FocusAndClickClientPoint(windowTitle, clientX, clientY, macroSpec.settleMs)
            result.action := macroName
        case "ui_calibrate":
            result := FocusAndMoveClientPoint(windowTitle, clientX, clientY, macroSpec.settleMs)
            result.action := macroName
        default:
            result := {
                ok: false,
                action: macroName,
                windowTitle: windowTitle,
                targetHwnd: "",
                activeBefore: false,
                activeAfter: false,
                moveX: 0,
                moveY: 0,
                settleMs: 0,
                cursorX: 0,
                cursorY: 0,
                clientX: 0,
                clientY: 0,
                sendMode: "",
                error: "unsupported_macro_action"
            }
    }

    EmitResult(result)
    ExitApp(result.ok ? 0 : 1)
}

Main()
