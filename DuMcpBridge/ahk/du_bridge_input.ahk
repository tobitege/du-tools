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

SendCtrlL(windowTitle, activateWindow := true, sendEscapeFirst := false) {
    result := {
        ok: false,
        action: "ctrl_l",
        windowTitle: windowTitle,
        targetHwnd: "",
        activeBefore: false,
        activeAfter: false,
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
        }
    }

    result.activeAfter := !!WinActive(targetSpec)

    ctrlLSequence := "{LCtrl down}l{LCtrl up}"

    if (result.activeAfter) {
        try {
            if (sendEscapeFirst) {
                SendEvent("{Escape}")
                Sleep(120)
            }
            SendEvent(ctrlLSequence)
            result.sendMode := sendEscapeFirst ? "send_event_escape_then_lctrl" : "send_event_active_lctrl"
            result.ok := true
            result.error := ""
            return result
        } catch as err {
            result.error := "send_event_failed:" . err.Message
        }
    }

    try {
        if (sendEscapeFirst) {
            ControlSend("{Escape}", , targetSpec)
            Sleep(120)
        }
        ControlSend(ctrlLSequence, , targetSpec)
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

Main() {
    action := A_Args.Length >= 1 ? String(A_Args[1]) : ""
    windowTitle := ReadOption("--window-title", "Dual Universe")
    activateWindow := ToBool(ReadOption("--activate", "true"), true)
    sendEscapeFirst := ToBool(ReadOption("--send-escape-first", "false"), false)
    keyName := ReadOption("--key", "")
    repeatCount := Integer(ReadOption("--repeat", "1"))
    delayMs := Integer(ReadOption("--delay-ms", "120"))

    if (action != "ctrl_l" && action != "send_key") {
        EmitResult({
            ok: false,
            action: action,
            windowTitle: windowTitle,
            targetHwnd: "",
            activeBefore: false,
            activeAfter: false,
            sendMode: "",
            key: keyName,
            repeatCount: repeatCount,
            error: "unsupported_action"
        })
        ExitApp(64)
    }

    if (action = "ctrl_l") {
        result := SendCtrlL(windowTitle, activateWindow, sendEscapeFirst)
    } else {
        result := SendNativeKey(windowTitle, keyName, repeatCount, delayMs, activateWindow)
    }
    EmitResult(result)
    ExitApp(result.ok ? 0 : 1)
}

Main()
