#Requires AutoHotkey v2.0
#SingleInstance Force

SetTitleMatchMode(2)
DetectHiddenWindows(false)
#Include du_view_common.ahk

result := FocusAndNudge("Dual Universe", 0, -80, 600)
EmitResult(result)
ExitApp(result.ok ? 0 : 1)
