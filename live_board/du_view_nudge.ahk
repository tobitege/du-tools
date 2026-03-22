#Requires AutoHotkey v2.0
#SingleInstance Force

SetTitleMatchMode(2)
DetectHiddenWindows(false)
#Include du_view_common.ahk

Main() {
    windowTitle := A_Args.Length >= 1 ? String(A_Args[1]) : "Dual Universe"
    moveX := A_Args.Length >= 2 ? ToInteger(A_Args[2], 0) : 0
    moveY := A_Args.Length >= 3 ? ToInteger(A_Args[3], -80) : -80
    settleMs := A_Args.Length >= 4 ? ToInteger(A_Args[4], 400) : 400

    result := FocusAndNudge(windowTitle, moveX, moveY, settleMs)
    EmitResult(result)
    ExitApp(result.ok ? 0 : 1)
}

Main()
