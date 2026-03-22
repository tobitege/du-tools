#Requires AutoHotkey v2.0
#SingleInstance Force

SetTitleMatchMode(2)
DetectHiddenWindows(false)
#Include du_view_common.ahk

; Small rightward bias plus a slight upward lift to get off the board and onto the screen.
result := FocusAndNudge("Dual Universe", 140, -30, 600)
EmitResult(result)
ExitApp(result.ok ? 0 : 1)
