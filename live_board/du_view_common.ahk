#Requires AutoHotkey v2.0

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

EmitResult(result) {
    json := "{"
        . '"ok":' . (result.ok ? "true" : "false")
        . ',"action":"' . JsonEscape(result.action) . '"'
        . ',"windowTitle":"' . JsonEscape(result.windowTitle) . '"'
        . ',"targetHwnd":"' . JsonEscape(result.targetHwnd) . '"'
        . ',"activeBefore":' . (result.activeBefore ? "true" : "false")
        . ',"activeAfter":' . (result.activeAfter ? "true" : "false")
        . ',"moveX":' . result.moveX
        . ',"moveY":' . result.moveY
        . ',"settleMs":' . result.settleMs
        . ',"cursorX":' . result.cursorX
        . ',"cursorY":' . result.cursorY
        . ',"sendMode":"' . JsonEscape(result.sendMode) . '"'
        . ',"error":"' . JsonEscape(result.error) . '"'
        . "}"
    StdOut(json)
}

ToInteger(value, defaultValue) {
    try {
        return Integer(value)
    } catch {
        return defaultValue
    }
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

ScaleDeltaForDpi(delta, dpi, baselineDpi := 1600) {
    if (baselineDpi <= 0) {
        return delta
    }
    return Round(delta * dpi / baselineDpi)
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

GetClientPointScreen(targetHwnd, clientX, clientY, &screenX, &screenY) {
    point := Buffer(8, 0)
    NumPut("Int", clientX, point, 0)
    NumPut("Int", clientY, point, 4)

    if (!DllCall("ClientToScreen", "ptr", targetHwnd, "ptr", point, "Int")) {
        return false
    }

    screenX := NumGet(point, 0, "Int")
    screenY := NumGet(point, 4, "Int")
    return true
}

GetClientSize(targetHwnd, &clientWidth, &clientHeight) {
    rect := Buffer(16, 0)
    if (!DllCall("GetClientRect", "ptr", targetHwnd, "ptr", rect, "Int")) {
        return false
    }
    clientWidth := NumGet(rect, 8, "Int")
    clientHeight := NumGet(rect, 12, "Int")
    return true
}

FocusClientCenter(windowTitle) {
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

    try {
        WinActivate(targetSpec)
        WinWaitActive(targetSpec, , 1)
    } catch as err {
        result.error := "activate_failed:" . err.Message
        return result
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

FocusAndClickClientPercent(windowTitle, xPercent, yPercent, settleMs := 120, button := "left") {
    result := FocusClientCenter(windowTitle)
    result.action := "focus_and_click_client_percent"
    result.settleMs := settleMs
    if (!result.ok) {
        return result
    }

    targetHwnd := Integer(result.targetHwnd)
    if (!GetClientSize(targetHwnd, &clientWidth, &clientHeight)) {
        result.ok := false
        result.error := "client_size_lookup_failed"
        return result
    }

    clientX := Round(clientWidth * xPercent / 100.0)
    clientY := Round(clientHeight * yPercent / 100.0)
    if (!GetClientPointScreen(targetHwnd, clientX, clientY, &screenX, &screenY)) {
        result.ok := false
        result.error := "client_point_lookup_failed"
        return result
    }

    DllCall("SetCursorPos", "Int", screenX, "Int", screenY)
    result.cursorX := screenX
    result.cursorY := screenY
    if (settleMs > 0) {
        Sleep(settleMs)
    }

    try {
        Click(button)
        result.sendMode := "click_" . button
    } catch as err {
        result.ok := false
        result.error := "click_failed:" . err.Message
    }

    return result
}

FocusAndNudge(windowTitle, moveX, moveY, settleMs := 400) {
    result := FocusClientCenter(windowTitle)
    result.action := "focus_and_nudge"
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

FocusAndSendKey(windowTitle, keySequence, actionName := "focus_and_send_key", settleMs := 120) {
    result := FocusClientCenter(windowTitle)
    result.action := actionName
    result.settleMs := settleMs
    if (!result.ok) {
        return result
    }

    if (settleMs > 0) {
        Sleep(settleMs)
    }

    try {
        SendEvent(keySequence)
        result.sendMode := "send_event_active_key"
    } catch as err {
        result.ok := false
        result.error := "send_event_failed:" . err.Message
    }

    return result
}

FocusNudgeAndCtrlL(windowTitle, moveX, moveY, settleMs := 300) {
    result := FocusAndNudge(windowTitle, moveX, moveY, settleMs)
    result.action := "focus_nudge_and_ctrl_l"
    if (!result.ok) {
        return result
    }

    try {
        SendEvent("{LCtrl down}l{LCtrl up}")
        result.sendMode := "send_event_active_lctrl"
    } catch as err {
        result.ok := false
        result.error := "send_event_failed:" . err.Message
    }

    return result
}

FocusNudgeAndSendKey(windowTitle, moveX, moveY, keySequence, actionName := "focus_nudge_and_send_key", settleMs := 300, postKeyDelayMs := 0) {
    result := FocusAndNudge(windowTitle, moveX, moveY, settleMs)
    result.action := actionName
    if (!result.ok) {
        return result
    }

    try {
        SendEvent(keySequence)
        result.sendMode := "send_event_active_key"
        if (postKeyDelayMs > 0) {
            Sleep(postKeyDelayMs)
        }
    } catch as err {
        result.ok := false
        result.error := "send_event_failed:" . err.Message
    }

    return result
}
