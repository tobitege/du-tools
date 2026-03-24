#Requires AutoHotkey v2.0
#SingleInstance Force

SetTitleMatchMode(2)
DetectHiddenWindows(false)

StdOut(text) {
    FileAppend(text . "`n", "*")
}

JsonEscape(value) {
    text := String(value)
    text := StrReplace(text, "\", "\\")
    text := StrReplace(text, '"', '\"')
    text := StrReplace(text, "`r", "\r")
    text := StrReplace(text, "`n", "\n")
    text := StrReplace(text, "`t", "\t")
    return text
}

JsonBool(value) {
    return value ? "true" : "false"
}

EmitResult(result) {
    json := "{"
        . '"ok":' . JsonBool(result.ok)
        . ',"action":"' . JsonEscape(result.action) . '"'
        . ',"windowTitle":"' . JsonEscape(result.windowTitle) . '"'
        . ',"targetHwnd":"' . JsonEscape(result.targetHwnd) . '"'
        . ',"activeBefore":' . JsonBool(result.activeBefore)
        . ',"activeAfter":' . JsonBool(result.activeAfter)
        . ',"moveX":' . result.moveX
        . ',"moveY":' . result.moveY
        . ',"settleMs":' . result.settleMs
        . ',"cursorX":' . result.cursorX
        . ',"cursorY":' . result.cursorY
        . ',"sendMode":"' . JsonEscape(result.sendMode) . '"'
        . ',"key":"' . JsonEscape(result.key) . '"'
        . ',"repeatCount":' . result.repeatCount
        . ',"error":"' . JsonEscape(result.error) . '"'
        . "}"
    StdOut(json)
}

ReadOption(optionName, defaultValue := "") {
    index := 2
    while (index <= A_Args.Length) {
        if (A_Args[index] = optionName) {
            if (index + 1 <= A_Args.Length) {
                return A_Args[index + 1]
            }
            return defaultValue
        }
        index += 1
    }
    return defaultValue
}

ToBool(value, defaultValue := false) {
    normalized := StrLower(Trim(String(value)))
    if (normalized = "1" || normalized = "true" || normalized = "yes" || normalized = "on") {
        return true
    }
    if (normalized = "0" || normalized = "false" || normalized = "no" || normalized = "off") {
        return false
    }
    return defaultValue
}

GetClientCenterScreen(targetHwnd, &centerX, &centerY) {
    rect := Buffer(16, 0)
    if (!DllCall("GetClientRect", "ptr", targetHwnd, "ptr", rect, "Int")) {
        return false
    }

    clientWidth := NumGet(rect, 8, "Int")
    clientHeight := NumGet(rect, 12, "Int")
    point := Buffer(8, 0)
    NumPut("Int", clientWidth // 2, point, 0)
    NumPut("Int", clientHeight // 2, point, 4)

    if (!DllCall("ClientToScreen", "ptr", targetHwnd, "ptr", point, "Int")) {
        return false
    }

    centerX := NumGet(point, 0, "Int")
    centerY := NumGet(point, 4, "Int")
    return true
}

FocusClientCenter(windowTitle, activateWindow := true) {
    result := {
        ok: false,
        action: "focus_client_center",
        windowTitle: windowTitle,
        targetHwnd: "",
        activeBefore: false,
        activeAfter: false,
        moveX: 0,
        moveY: 0,
        settleMs: 0,
        cursorX: 0,
        cursorY: 0,
        sendMode: "",
        key: "",
        repeatCount: 1,
        error: ""
    }

    targetHwnd := WinExist(windowTitle)
    if (!targetHwnd) {
        result.error := "window_not_found"
        return result
    }

    targetSpec := "ahk_id " . targetHwnd
    result.targetHwnd := String(targetHwnd)
    result.activeBefore := !!WinActive(targetSpec)

    if (activateWindow) {
        try {
            WinActivate(targetSpec)
            WinWaitActive(targetSpec, , 1)
        } catch as err {
            result.error := "activate_failed:" . err.Message
            return result
        }
    }

    result.activeAfter := !!WinActive(targetSpec)
    if (!result.activeAfter) {
        result.error := "window_not_active"
        return result
    }

    if (!GetClientCenterScreen(targetHwnd, &centerX, &centerY)) {
        result.error := "client_center_lookup_failed"
        return result
    }

    DllCall("SetCursorPos", "Int", centerX, "Int", centerY)
    result.cursorX := centerX
    result.cursorY := centerY
    result.ok := true
    return result
}

SendCtrlL(windowTitle, activateWindow := true, sendEscapeFirst := false) {
    result := {
        ok: false,
        action: "ctrl_l",
        windowTitle: windowTitle,
        targetHwnd: "",
        activeBefore: false,
        activeAfter: false,
        moveX: 0,
        moveY: 0,
        settleMs: 0,
        cursorX: 0,
        cursorY: 0,
        sendMode: "",
        key: "",
        repeatCount: 1,
        error: ""
    }

    targetHwnd := WinExist(windowTitle)
    if (!targetHwnd) {
        result.error := "window_not_found"
        return result
    }

    targetSpec := "ahk_id " . targetHwnd
    result.targetHwnd := String(targetHwnd)
    result.activeBefore := !!WinActive(targetSpec)

    if (activateWindow) {
        try {
            WinActivate(targetSpec)
            WinWaitActive(targetSpec, , 1)
            Sleep(50)  ; Give the game window time to fully activate
        } catch as err {
            result.error := "activate_failed:" . err.Message
        }
    }

    result.activeAfter := !!WinActive(targetSpec)

    ctrlLSequence := "{LCtrl down}l{LCtrl up}"  ; Explicit modifier syntax for ControlSend

    if (result.activeAfter) {
        try {
            if (sendEscapeFirst) {
                ControlSend("{Escape}", , targetSpec)
                Sleep(120)
            }
            ; Try with a small delay before and after to ensure modifier is processed
            Sleep(20)
            ControlSend(ctrlLSequence, , targetSpec)
            Sleep(20)
            result.sendMode := sendEscapeFirst ? "control_send_escape_then_lctrl" : "control_send_lctrl"
            result.ok := true
            result.error := ""
            return result
        } catch as err {
            result.error := "control_send_failed:" . err.Message
        }
    }

    try {
        if (sendEscapeFirst) {
            ControlSend("{Escape}", , targetSpec)
            Sleep(120)
        }
        Sleep(20)
        ControlSend(ctrlLSequence, , targetSpec)
        Sleep(20)
        result.sendMode := sendEscapeFirst ? "control_send_escape_then_lctrl" : "control_send_lctrl"
        result.ok := true
        result.error := ""
        return result
    } catch as err {
        result.error := "control_send_failed:" . err.Message
        return result
    }
}

GetKeySequence(keyName) {
    normalized := StrUpper(Trim(String(keyName)))
    if (RegExMatch(normalized, "^[A-Z]$")) {
        return normalized
    }
    if (normalized = "ESCAPE") {
        return "{Escape}"
    }
    if (normalized = "TAB") {
        return "{Tab}"
    }
    if (normalized = "ENTER") {
        return "{Enter}"
    }
    if (normalized = "CTRL+L") {
        return "{LCtrl down}l{LCtrl up}"
    }
    if (RegExMatch(normalized, "^F([1-9]|1[0-2])$")) {
        return "{" . normalized . "}"
    }
    return ""
}

SendNativeKey(windowTitle, keyName, repeatCount := 1, delayMs := 120, activateWindow := true) {
    result := {
        ok: false,
        action: "send_key",
        windowTitle: windowTitle,
        targetHwnd: "",
        activeBefore: false,
        activeAfter: false,
        moveX: 0,
        moveY: 0,
        settleMs: 0,
        cursorX: 0,
        cursorY: 0,
        sendMode: "",
        key: keyName,
        repeatCount: repeatCount,
        error: ""
    }

    targetHwnd := WinExist(windowTitle)
    if (!targetHwnd) {
        result.error := "window_not_found"
        return result
    }

    sequence := GetKeySequence(keyName)
    if (sequence = "") {
        result.error := "unsupported_key"
        return result
    }

    targetSpec := "ahk_id " . targetHwnd
    result.targetHwnd := String(targetHwnd)
    result.activeBefore := !!WinActive(targetSpec)

    if (activateWindow) {
        try {
            WinActivate(targetSpec)
            WinWaitActive(targetSpec, , 1)
        } catch as err {
            result.error := "activate_failed:" . err.Message
        }
    }

    result.activeAfter := !!WinActive(targetSpec)
    attempts := Max(1, Integer(repeatCount))
    pauseMs := Max(0, Integer(delayMs))

    if (result.activeAfter) {
        try {
            Loop attempts {
                SendEvent(sequence)
                if (A_Index < attempts && pauseMs > 0) {
                    Sleep(pauseMs)
                }
            }
            result.sendMode := "send_event_active_key"
            result.ok := true
            result.error := ""
            return result
        } catch as err {
            result.error := "send_event_failed:" . err.Message
        }
    }

    try {
        Loop attempts {
            ControlSend(sequence, , targetSpec)
            if (A_Index < attempts && pauseMs > 0) {
                Sleep(pauseMs)
            }
        }
        result.sendMode := "control_send_key"
        result.ok := true
        result.error := ""
        return result
    } catch as err {
        result.error := "control_send_failed:" . err.Message
        return result
    }
}

MoveCamera(windowTitle, moveX, moveY, settleMs := 400, activateWindow := true) {
    result := FocusClientCenter(windowTitle, activateWindow)
    result.action := "camera_move"
    result.moveX := moveX
    result.moveY := moveY
    result.settleMs := settleMs
    if (!result.ok) {
        return result
    }

    Sleep(120)
    DllCall("mouse_event", "UInt", 0x0001, "Int", moveX, "Int", moveY, "UInt", 0, "UPtr", 0)
    if (settleMs > 0) {
        Sleep(settleMs)
    }

    return result
}

Main() {
    action := A_Args.Length >= 1 ? String(A_Args[1]) : ""
    windowTitle := ReadOption("--window-title", "Dual Universe")
    activateWindow := ToBool(ReadOption("--activate", "true"), true)
    sendEscapeFirst := ToBool(ReadOption("--send-escape-first", "false"), false)
    keyName := ReadOption("--key", "")
    repeatCount := Integer(ReadOption("--repeat", "1"))
    delayMs := Integer(ReadOption("--delay-ms", "120"))
    moveX := Integer(ReadOption("--x", "0"))
    moveY := Integer(ReadOption("--y", "0"))
    settleMs := Integer(ReadOption("--settle-ms", "400"))

    if (action != "ctrl_l" && action != "send_key" && action != "camera_move") {
        EmitResult({
            ok: false,
            action: action,
            windowTitle: windowTitle,
            targetHwnd: "",
            activeBefore: false,
            activeAfter: false,
            moveX: moveX,
            moveY: moveY,
            settleMs: settleMs,
            cursorX: 0,
            cursorY: 0,
            sendMode: "",
            key: keyName,
            repeatCount: repeatCount,
            error: "unsupported_action"
        })
        ExitApp(64)
    }

    if (action = "ctrl_l") {
        result := SendCtrlL(windowTitle, activateWindow, sendEscapeFirst)
    } else if (action = "camera_move") {
        result := MoveCamera(windowTitle, moveX, moveY, settleMs, activateWindow)
    } else {
        result := SendNativeKey(windowTitle, keyName, repeatCount, delayMs, activateWindow)
    }
    EmitResult(result)
    ExitApp(result.ok ? 0 : 1)
}

Main()
