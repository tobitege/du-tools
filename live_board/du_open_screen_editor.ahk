#Requires AutoHotkey v2.0
#SingleInstance Force

SetTitleMatchMode(2)
DetectHiddenWindows(false)
#Include du_view_common.ahk

; Aim upward just enough to overlap the screen, then open the editor for the centered target.
result := FocusNudgeAndCtrlL("Dual Universe", 0, -30, 350)
EmitResult(result)
ExitApp(result.ok ? 0 : 1)
