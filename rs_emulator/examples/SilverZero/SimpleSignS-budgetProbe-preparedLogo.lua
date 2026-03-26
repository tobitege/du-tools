-- SimpleSignS-budgetProbe.lua
-- Iterative budget probe with individually switchable sub-parts.

local SZ = require("lib.SilverZeroRsLib")
local SimpleSignSharedAssetsSelective = require("lib.SimpleSignSharedAssetsSelective")

local OPTIONS = {
    drawBackgroundFill = true,
    drawCircuitB = true,
    drawCircuitC = false,
    drawCircuitCRange = true,
    drawCircuitCRangeStart = 1,
    drawCircuitCRangeEnd = 55,
    drawCircuitCRange2 = false,
    drawCircuitCRange2Start = 56,
    drawCircuitCRange2End = 92,
    drawCircuitCGroup1 = false,
    drawCircuitCGroup2 = false,
    drawCircuitCGroup3 = false,
    drawCircuitCGroup4 = false,
    drawCircuitDots = true,
    drawBoardOutline = true,
    drawBoardHighlights = true,
    drawLogo = true,
    drawText = true,
    showDebugInfo = true,
}

local theme = {
    background = { 0.31, 0.00, 0.03, 1 },     -- circuit-color-A: #5008
    circuitB = { 0.25, 0.00, 0.03, 1 },       -- circuit-color-B: #4008
    circuitC = { 0.94, 0.00, 0.03, 1 },       -- circuit-color-C: #f008
    primary = { 1.00, 0.00, 0.00, 1 },        -- primary-color: #f00
    highlight = { 1.00, 1.00, 1.00, 1 },      -- highlight-color: #fff
    textColor = { 1.00, 1.00, 1.00, 1 },      -- text-color: #FFF
}

local resolutionX, resolutionY = getResolution()
local sharedLogoAssets = nil
local logoReady = true

if OPTIONS.drawLogo then
    sharedLogoAssets, logoReady = SimpleSignSharedAssetsSelective.prepareStep({
        logo = true,
    })
end
local layout = SZ.layoutForScreen(resolutionX, resolutionY, 1400, 980, 0)
layout.x = 0
layout.y = 0
layout.scale = math.min(resolutionX / 1400, resolutionY / 980)

local masterLayout = SZ.layoutForScreen(resolutionX, resolutionY, 1400, 980, 0)
masterLayout.x = 0
masterLayout.y = 0
masterLayout.scale = math.max(resolutionX / 1400, resolutionY / 980)

local layers = SZ.createLayers("master", "board", "logo", "text")

if not logoReady then
    requestAnimationFrame(1)
end

-- ===== MASTER SVG BACKGROUND =====
local masterLayer = layers.master
local masterW = resolutionX
local masterH = resolutionY

if OPTIONS.drawBackgroundFill then
    setNextFillColor(masterLayer, theme.background[1], theme.background[2], theme.background[3], theme.background[4])
    addBox(masterLayer, 0, 0, masterW, masterH)
end

-- Circuit traces in circuit-color-B (6 paths)
local circuitBPaths = {
    "m317 201v101l209 209v-182l-52-52v-113l-165-165h-193z",
    "m876 348v142l292-292v-88l110-110h-228l-32 32v174z",
    "m0 668 42-42h28l36 36h417v-96l-240-240-282 282z",
    "m846 752h-125l-66-66-95-2.1h-19l121 121h59s102 107 170 175h184z",
    "m1400 210-233 233-22-22h-177l-90 89 183 183h40l298-298z",
    "m92 711h-92v269h361z",
}

if OPTIONS.drawCircuitB then
    for _, pathData in ipairs(circuitBPaths) do
        SZ.drawPath(masterLayer, masterLayout, pathData, theme.circuitB, 2.0)
    end
end

-- Circuit traces in circuit-color-C (all the rounded-corner paths)
local circuitCPaths = {
    "m964 436-45 45c-3.1-2.1-7.3-1.8-10 1-3.1 3.1-3.1 8.1 0 11s8.1 3.1 11 0c2.7-2.7 3-6.9 1-10l44-44h144l36 36h136c0.7 3.6 3.9 6.4 7.7 6.4 4.4 0 7.9-3.5 7.9-7.9s-3.5-7.9-7.9-7.9c-3.8 0-7 2.8-7.7 6.4h-134l-36-36h-146z",
    "m1000 644c3.8 0 7-2.8 7.7-6.4h28l69-69c3.1 2.1 7.3 1.8 10-1 3.1-3.1 3.1-8.1 0-11s-8.1-3.1-11 0c-2.7 2.7-3 6.9-1 10l-68 68h-27c-0.7-3.6-3.9-6.4-7.7-6.4-4.4 0-7.9 3.5-7.9 7.9 0.1 4.5 3.6 8 8 8z",
    "m1061 684c3.8 0 7-2.8 7.7-6.4h34l159-159-24-24h-110c-0.7-3.6-3.9-6.4-7.7-6.4-4.4 0-7.9 3.5-7.9 7.9s3.5 7.9 7.9 7.9c3.8 0 7-2.8 7.7-6.4h108l21 21-156 156h-33c-0.7-3.6-3.9-6.4-7.7-6.4-4.4 0-7.9 3.5-7.9 7.9s3.5 7.9 7.9 7.9z",
    "m1190 219c3.6-0.7 6.4-3.9 6.4-7.7 0-4.4-3.5-7.9-7.9-7.9s-7.9 3.5-7.9 7.9c0 3.8 2.8 7 6.4 7.7v34l-146 146c-3.1-2.1-7.3-1.8-10 1-3.1 3.1-3.1 8.1 0 11s8.1 3.1 11 0c2.7-2.7 3-6.9 1-10l147-147v-36z",
    "m1092 204v99l-85 85c-3.1-2.1-7.3-1.8-10 1-3.1 3.1-3.1 8.1 0 11s8.1 3.1 11 0c2.7-2.7 3-6.9 1-10l86-86v-99l190-190c3.1 2.1 7.3 1.8 10-1 3.1-3.1 3.1-8.1 0-11s-8.1-3.1-11 0c-2.7 2.7-3 6.9-1 10l-190 190z",
    "m900 384c-3.1 3.1-3.1 8.1 0 11s8.1 3.1 11 0c2.7-2.7 3-6.9 1-10l54-54v-32l58-58c3.1 2.1 7.3 1.8 10-1 3.1-3.1 3.1-8.1 0-11s-8.1-3.1-11 0c-2.7 2.7-3 6.9-1 10l-59 59v32l-53 53c-3.1-2-7.3-1.7-10 1z",
    "m1088 535c3.1-3.1 3.1-8.1 0-11s-8.1-3.1-11 0c-2.7 2.7-3 6.9-1 10l-46 46c-3.1-2.1-7.3-1.8-10 1-3.1 3.1-3.1 8.1 0 11s8.1 3.1 11 0c2.7-2.7 3-6.9 1-10l46-46c3 2 7.2 1.7 10-1z",
    "m1120 602h18l34-34c3.1 2.1 7.3 1.8 10-1 3.1-3.1 3.1-8.1 0-11s-8.1-3.1-11 0c-2.7 2.7-3 6.9-1 10l-33 33h-18l-28 28v15c-3.6 0.7-6.4 3.9-6.4 7.7 0 4.4 3.5 7.9 7.9 7.9s7.9-3.5 7.9-7.9c0-3.8-2.8-7-6.4-7.7v-14l27-27z",
    "m1326 430c-3.6 0.7-6.4 3.9-6.4 7.7 0 4.4 3.5 7.9 7.9 7.9s7.9-3.5 7.9-7.9c0-3.8-2.8-7-6.4-7.7v-44l72-72v-4.2l-74 74v46z",
    "m1000 520 24-24c3.1 2.1 7.3 1.8 10-1 3.1-3.1 3.1-8.1 0-11s-8.1-3.1-11 0c-2.7 2.7-3 6.9-1 10l-23 23h-35l-31 31c-3.1-2.1-7.3-1.8-10 1-3.1 3.1-3.1 8.1 0 11s8.1 3.1 11 0c2.7-2.7 3-6.9 1-10l30-30h35z",
    "m1084 463c-3.8 0-7 2.8-7.7 6.4h-105l-46 46c-3.1-2.1-7.3-1.8-10 1-3.1 3.1-3.1 8.1 0 11s8.1 3.1 11 0c2.7-2.7 3-6.9 1-10l46-46h104c0.7 3.6 3.9 6.4 7.7 6.4 4.4 0 7.9-3.5 7.9-7.9 0.1-4.5-3.5-8-7.8-8z",
    "m1181 431h102c0.7 3.6 3.9 6.4 7.7 6.4 4.4 0 7.9-3.5 7.9-7.9s-3.5-7.9-7.9-7.9c-3.8 0-7 2.8-7.7 6.4h-101l-32-32 39-39c3.1 2.1 7.3 1.8 10-1 3.1-3.1 3.1-8.1 0-11s-8.1-3.1-11 0c-2.7 2.7-3 6.9-1 10l-41 41 35 35z",
    "m1062 296-143 143c-3.1-2.1-7.3-1.8-10 1-3.1 3.1-3.1 8.1 0 11s8.1 3.1 11 0c2.7-2.7 3-6.9 1-10l144-144v-104l193-193h-4.2l-192 192v104z",
    "m944 824c3.1 3.1 8.1 3.1 11 0s3.1-8.1 0-11c-2.7-2.7-6.9-3-10-1l-68-67h-44l-47-47c2.1-3.1 1.8-7.3-1-10-3.1-3.1-8.1-3.1-11 0s-3.1 8.1 0 11c2.7 2.7 6.9 3 10 1l48 48h44l67 67c-2 3-1.6 7.2 1.1 9.9z",
    "m877 312c-3.1 3.1-3.1 8.1 0 11s8.1 3.1 11 0c2.7-2.7 3-6.9 1-10l313-313h-4.2l-311 311c-3-2.1-7.3-1.8-10 1z",
    "m782 767c2.5 3.6 7.4 4.5 11 2.1s4.5-7.4 2.1-11c-2.4-3.5-7.2-4.5-11-2.2-14-14-51-51-60-60v-31h97l26 26c-2.1 3.1-1.8 7.3 1 10 3.1 3.1 8.1 3.1 11 0s3.1-8.1 0-11c-2.7-2.7-6.9-3-10-1l-27-27h-101v35l0.4 0.4c20 20 49 49 61 61-1.8 2.7-1.9 6.3 0 9.1z",
    "m1214 159c-3.1 3.1-3.1 8.1 0 11s8.1 3.1 11 0c2.7-2.7 3-6.9 1-10l160-160h-4.2l-158 158c-3.1-2.1-7.3-1.8-10 1z",
    "m1136 229c-3.6 0.7-6.4 3.9-6.4 7.7 0 4.4 3.5 7.9 7.9 7.9s7.9-3.5 7.9-7.9c0-3.8-2.8-7-6.4-7.7v-21l208-208h-4.2l-207 207v22z",
    "m1100 392c-3.1-2.1-7.3-1.8-10 1-3.1 3.1-3.1 8.1 0 11s8.1 3.1 11 0c2.7-2.7 3-6.9 1-10l297-298v-4.3l-300 300z",
    "m1203 380c-3.1 3.1-3.1 8.1 0 11s8.1 3.1 11 0c2.7-2.7 3-6.9 1-10l94-94c3.1 2.1 7.3 1.8 10-1 3.1-3.1 3.1-8.1 0-11s-8.1-3.1-11 0c-2.7 2.7-3 6.9-1 10l-94 94c-3.1-2-7.3-1.7-10 1z",
    "m1357 299-88 88c-3.1-2.1-7.3-1.8-10 1-3.1 3.1-3.1 8.1 0 11s8.1 3.1 11 0c2.7-2.7 3-6.9 1-10l89-89v-82l40-40v-4.2l-43 43v82z",
    "m1363 80c3.1-3.1 3.1-8.1 0-11s-8.1-3.1-11 0c-2.7 2.7-3 6.9-1 10l-126 126c-3.1-2.1-7.3-1.8-10 1-3.1 3.1-3.1 8.1 0 11s8.1 3.1 11 0c2.7-2.7 3-6.9 1-10l126-126c3.1 2 7.3 1.7 10-1z",
    "m1223 303c-3.1 3.1-3.1 8.1 0 11s8.1 3.1 11 0c2.7-2.7 3-6.9 1-10l165-165v-4.2l-167 167c-3.1-2-7.3-1.7-10 1z",
    "m55 937c-3.1-3.1-8.1-3.1-11 0s-3.1 8.1 0 11c2.7 2.7 6.9 3 10 1l31 31h4.2l-33-33c2.1-3 1.8-7.3-0.9-10z",
    "m20 904-20-20v4.2l18 18h39l73 74h4.2l-76-76z",
    "m240 292-96 96c-3.1-2.1-7.3-1.8-10 1-3.1 3.1-3.1 8.1 0 11s8.1 3.1 11 0c2.7-2.7 3-6.9 1-10l97-97v-83l-210-210h-4.2l211 211v80z",
    "m260 676h-260v3h259l31 31h63v271h3v-274h-64z",
    "m1352 400c-3.1 3.1-3.1 8.1 0 11s8.1 3.1 11 0c2.7-2.7 3-6.9 1-10l36-36v-4.2l-38 38c-3.2-2.1-7.4-1.8-10 0.9z",
    "m115 757-38-38h-77v3h76l37 36v54l167 167h4.2l-168-168z",
    "m0 804 176 176h4.2l-180-180z",
    "m370 631c-3.1-3.1-8.1-3.1-11 0s-3.1 8.1 0 11c2.7 2.7 6.9 3 10 1l44 44v144l-36 36v112h3v-111l36-36v-146l-45-45c2.2-3.1 1.8-7.3-0.9-10z",
    "m460 812c-3.1-3.1-8.1-3.1-11 0s-3.1 8.1 0 11c2.7 2.7 6.9 3 10 1l156 155h4.2l-158-158c2.1-3.1 1.8-7.3-0.9-10z",
    "m799 246-17 17c-3.1-2.1-7.3-1.8-10 1-3.1 3.1-3.1 8.1 0 11s8.1 3.1 11 0c2.7-2.7 3-6.9 1-10l16-16h28l93-93c3.1 2.1 7.3 1.8 10-1 3.1-3.1 3.1-8.1 0-11s-8.1-3.1-11 0c-2.7 2.7-3 6.9-1 10l-92 92h-28z",
    "m473 925c-3.1-3.1-8.1-3.1-11 0s-3.1 8.1 0 11c2.7 2.7 6.9 3 10 1l42 42h4.2l-45-45c2.1-3.2 1.8-7.4-0.9-10z",
    "m497 921c3.1 3.1 8.1 3.1 11 0s3.1-8.1 0-11c-2.7-2.7-6.9-3-10-1l-41-41-35 35v77h3v-75l32-32 39 39c-2.1 3-1.8 7.2 0.9 10z",
    "m808 113c-0.7-3.6-3.9-6.4-7.7-6.4-4.4 0-7.9 3.5-7.9 7.9s3.5 7.9 7.9 7.9c3.8 0 7-2.8 7.7-6.4h11l71-71v-44h-3v43l-70 70h-9.7z",
    "m732 128c-3.1 3.1-3.1 8.1 0 11s8.1 3.1 11 0c2.7-2.7 3-6.9 1-10l76-76v-54h-3v53l-75 75c-3.2-2-7.4-1.7-10 1z",
    "m1292 604c-3.1 3.1-3.1 8.1 0 11s8.1 3.1 11 0c2.7-2.7 3-6.9 1-10l96-96v-4.2l-98 98c-3.1-2.1-7.3-1.8-10 0.9z",
    "m1112 819 161 161h4.3l-162-162v-89l285-285v-4.2l-288 288z",
    "m688 311c-3.6 0.7-6.4 3.9-6.4 7.7 0 4.4 3.5 7.9 7.9 7.9s7.9-3.5 7.9-7.9c0-3.8-2.8-7-6.4-7.7v-177l78-78v-56h-3v55l-78 78v178z",
    "m331 70c3.1 3.1 8.1 3.1 11 0s3.1-8.1 0-11c-2.7-2.7-6.9-3-10-1l-58-58h-4.2l60 60c-2.1 3-1.8 7.3 0.9 10z",
    "m555 77c3.1 3.1 8.1 3.1 11 0s3.1-8.1 0-11c-2.7-2.7-6.9-3-10-1l-35-35v-30h-3v32l36 36c-2.1 3.1-1.8 7.3 1 10z",
    "m292 58 93 93v103l121 121c-2.1 3.1-1.8 7.3 1 10 3.1 3.1 8.1 3.1 11 0s3.1-8.1 0-11c-2.7-2.7-6.9-3-10-1l-120-120v-103l-94-94h-30l-55-55h-4.2l58 58h29z",
    "m601 311c-3.6 0.7-6.4 3.9-6.4 7.7 0 4.4 3.5 7.9 7.9 7.9s7.9-3.5 7.9-7.9c0-3.8-2.8-7-6.4-7.7v-94l-217-217h-4.2l218 218v93z",
    "m632 311c-3.6 0.7-6.4 3.9-6.4 7.7 0 4.4 3.5 7.9 7.9 7.9s7.9-3.5 7.9-7.9c0-3.8-2.8-7-6.4-7.7v-122l-153-153c0-3.2 0.3-18 0.4-32v-4h-3c-0.1 12-0.2 26-0.4 37v0.6l153 153v120z",
    "m751 159-36 36v116c-3.6 0.7-6.4 3.9-6.4 7.7 0 4.4 3.5 7.9 7.9 7.9s7.9-3.5 7.9-7.9c0-3.8-2.8-7-6.4-7.7v-114l35-35h63l162-162h-4.2l-159 159h-63z",
    "m647 937c-3.1-3.1-8.1-3.1-11 0s-3.1 8.1 0 11c2.7 2.7 6.9 3 10 1l31 31h4.2l-33-33c2.1-3.1 1.8-7.4-0.9-10z",
    "m876 857c-3.1-3.1-8.1-3.1-11 0s-3.1 8.1 0 11c2.7 2.7 6.9 3 10 1l110 110h4.2l-113-113c2.1-3.1 1.8-7.3-0.9-10z",
    "m93 249c3.1 2.1 7.3 1.8 10-1 3.1-3.1 3.1-8.1 0-11s-8.1-3.1-11 0c-2.7 2.7-3 6.9-1 10l-25 25-66-66v4.2l66 66 28-27z",
    "m594 759-104-104c2.1-3.1 1.8-7.3-1-10-3.1-3.1-8.1-3.1-11 0s-3.1 8.1 0 11c2.7 2.7 6.9 3 10 1l105 105h66l218 218h4.2l-221-221h-66z",
    "m641 732-68-68c2.1-3.1 1.8-7.3-1-10-3.1-3.1-8.1-3.1-11 0s-3.1 8.1 0 11c2.7 2.7 6.9 3 10 1l69 69h22l246 245h4.2l-248-248h-22z",
    "m824 857c-3.1-3.1-8.1-3.1-11 0s-3.1 8.1 0 11c2.7 2.7 6.9 3 10 1l110 110h4.2l-113-113c2.1-3.1 1.8-7.3-0.9-10z",
    "m550 814-85-85c2.1-3.1 1.8-7.3-1-10-3.1-3.1-8.1-3.1-11 0s-3.1 8.1 0 11c2.7 2.7 6.9 3 10 1l86 86h99l163 163h4.2l-166-166h-99z",
    "m315 849-47-47h-46l-77-77c2.1-3.1 1.8-7.3-1-10-3.1-3.1-8.1-3.1-11 0s-3.1 8.1 0 11c2.7 2.7 6.9 3 10 1l78 78h46l46 46c-2.1 3.1-1.8 7.3 1 10 3.1 3.1 8.1 3.1 11 0s3.1-8.1 0-11c-2.7-2.8-7-3.1-10-1z",
    "m61 318 64-64c3.1 2.1 7.3 1.8 10-1 3.1-3.1 3.1-8.1 0-11s-8.1-3.1-11 0c-2.7 2.7-3 6.9-1 10l-64 64v49l-58 58v4.2l61-61v-49z",
    "m203 706c-3.1-3.1-8.1-3.1-11 0s-3.1 8.1 0 11c2.7 2.7 6.9 3 10 1l27 27h76c0.7 3.6 3.9 6.4 7.7 6.4 4.4 0 7.9-3.5 7.9-7.9s-3.5-7.9-7.9-7.9c-3.8 0-7 2.8-7.7 6.4h-75l-26-26c2.1-3.2 1.8-7.4-0.9-10z",
    "m308 942-126-126c2.1-3.1 1.8-7.3-1-10-3.1-3.1-8.1-3.1-11 0s-3.1 8.1 0 11c2.7 2.7 6.9 3 10 1l126 126c-2.1 3.1-1.8 7.3 1 10 3.1 3.1 8.1 3.1 11 0s3.1-8.1 0-11c-2.8-2.7-7-3-10-0.9z",
    "m452 752c-3.1-3.1-8.1-3.1-11 0s-3.1 8.1 0 11c2.7 2.7 6.9 3 10 1l147 147h36c0.7 3.6 3.9 6.4 7.7 6.4 4.4 0 7.9-3.5 7.9-7.9s-3.5-7.9-7.9-7.9c-3.8 0-7 2.8-7.7 6.4h-34l-146-146c2.1-3.1 1.8-7.3-0.9-10z",
    "m623 858c-0.7-3.6-3.9-6.4-7.7-6.4-4.4 0-7.9 3.5-7.9 7.9s3.5 7.9 7.9 7.9c3.8 0 7-2.8 7.7-6.4h21l119 119h4.2l-122-122h-22z",
    "m1349 798c-3.1-3.1-8.1-3.1-11 0s-3.1 8.1 0 11c2.7 2.7 6.9 3 10 1l52 52v-4.2l-50-50c2.2-3.2 1.8-7.4-0.9-10z",
    "m1363 727 37 37v-4.2l-34-34v-30l34-34v-4.3l-37 37z",
    "m1288 842-74-74c2.1-3.1 1.8-7.3-1-10-3.1-3.1-8.1-3.1-11 0s-3.1 8.1 0 11c2.7 2.7 6.9 3 10 1l75 75h42l71 71v-4.2l-70-70h-42z",
    "m1302 772c-3.1-2.1-7.3-1.8-10 1-3.1 3.1-3.1 8.1 0 11s8.1 3.1 11 0c2.7-2.7 3-6.9 1-10l25-25 70 70v-4.2l-70-70-28 27z",
    "m1338 900c-3.1-3.1-8.1-3.1-11 0s-3.1 8.1 0 11c2.7 2.7 6.9 3 10 1l64 63v-4.2l-61-61c2.1-3.1 1.7-7.3-1-10z",
    "m1335 703-64 64c-3.1-2.1-7.3-1.8-10 1-3.1 3.1-3.1 8.1 0 11s8.1 3.1 11 0c2.7-2.7 3-6.9 1-10l64-64v-49l62-62v-4.2l-65 65v49z",
    "m748 311c-4.4 0-7.9 3.5-7.9 7.9s3.5 7.9 7.9 7.9c3.8 0 7-2.8 7.7-6.4h53l161-161c3.1 2.1 7.3 1.8 10-1 3.1-3.1 3.1-8.1 0-11s-8.1-3.1-11 0c-2.7 2.7-3 6.9-1 10l-160 160h-52c-0.8-3.6-4-6.4-7.8-6.4z",
    "m783 801-138-138c2.1-3.1 1.8-7.3-1-10-3.1-3.1-8.1-3.1-11 0s-3.1 8.1 0 11c2.7 2.7 6.9 3 10 1l139 139h92l176 176h4.2l-178-179h-92z",
    "m1111 931-85-85v-102l-135-135c2.1-3.1 1.8-7.3-1-10-3.1-3.1-8.1-3.1-11 0s-3.1 8.1 0 11c2.7 2.7 6.9 3 10 1l134 134v102l87 87h26l46 46h4.2l-49-49h-26z",
    "m981 776-91-91c2.1-3.1 1.8-7.3-1-10-3.1-3.1-8.1-3.1-11 0s-3.1 8.1 0 11c2.7 2.7 6.9 3 10 1l90 90v100l103 103h4.2l-104-104v-100z",
    "m1058 712-168-168c2.1-3.1 1.8-7.3-1-10-3.1-3.1-8.1-3.1-11 0s-3.1 8.1 0 11c2.7 2.7 6.9 3 10 1l167 167v101l166 166h4.2l-167-167v-101z",
    "m1180 730 64-64c3.1 2.1 7.3 1.8 10-1 3.1-3.1 3.1-8.1 0-11s-8.1-3.1-11 0c-2.7 2.7-3 6.9-1 10l-65 65v76l176 176h4.2l-177-177v-73z",
    "m356 352h-68l-175 175v62h392c0.7 3.6 3.9 6.4 7.7 6.4 4.4 0 7.9-3.5 7.9-7.9s-3.5-7.9-7.9-7.9c-3.8 0-7 2.8-7.7 6.4h-389v-57l174-174h66l118 118v20c-3.6 0.7-6.4 3.9-6.4 7.7 0 4.4 3.5 7.9 7.9 7.9s7.9-3.5 7.9-7.9c0-3.8-2.8-7-6.4-7.7v-21l-120-120z",
    "m208 462-72 72v29h323c0.7 3.6 3.9 6.4 7.7 6.4 4.4 0 7.9-3.5 7.9-7.9s-3.5-7.9-7.9-7.9c-3.8 0-7 2.8-7.7 6.4h-320v-24l70-70h27l78-78c3.1 2.1 7.3 1.8 10-1 3.1-3.1 3.1-8.1 0-11s-8.1-3.1-11 0c-2.7 2.7-3 6.9-1 10l-77 77h-27z",
    "m72 605 30 30h192c0.7 3.6 3.9 6.4 7.7 6.4 4.4 0 7.9-3.5 7.9-7.9s-3.5-7.9-7.9-7.9c-3.8 0-7 2.8-7.7 6.4h-191l-30-30h-42l-31 31v4.2l32-32h40z",
    "m322 449-39 39h-22l-42 42c-3.1-2.1-7.3-1.8-10 1-3.1 3.1-3.1 8.1 0 11s8.1 3.1 11 0c2.7-2.7 3-6.9 1-10l41-41h22l40-40v-25l12-13c3.1 2.1 7.3 1.8 10-1 3.1-3.1 3.1-8.1 0-11s-8.1-3.1-11 0c-2.7 2.7-3 6.9-1 10l-14 14v25z",
    "m304 198-146-146c2.1-3.1 1.8-7.3-1-10-3.1-3.1-8.1-3.1-11 0s-3.1 8.1 0 11c2.7 2.7 6.9 3 10 1l145 145v93l-301 301v4.2l304-304v-95z",
    "m412 475c-3.1-3.1-8.1-3.1-11 0s-3.1 8.1 0 11c2.7 2.7 6.9 3 10 1l41 41c-2.1 3.1-1.8 7.3 1 10 3.1 3.1 8.1 3.1 11 0s3.1-8.1 0-11c-2.7-2.7-6.9-3-10-1l-41-41c2.1-3.1 1.8-7.3-1-10z",
    "m157 310c3.1-3.1 3.1-8.1 0-11s-8.1-3.1-11 0c-2.7 2.7-3 6.9-1 10l-145 145v4.2l147-147c3.1 2.2 7.3 1.9 10-0.9z",
    "m98 447c3.1-3.1 3.1-8.1 0-11s-8.1-3.1-11 0c-2.7 2.7-3 6.9-1 10l-86 86v4.2l88-88c3.1 2.2 7.3 1.8 10-0.9z",
    "m628 98c-3.1 3.1-3.1 8.1 0 11s8.1 3.1 11 0c2.7-2.7 3-6.9 1-10l43-43h29c0.7 3.6 3.9 6.4 7.7 6.4 4.4 0 7.9-3.5 7.9-7.9s-3.5-7.9-7.9-7.9c-3.8 0-7 2.8-7.7 6.4h-30l-44 44c-3.1-2.1-7.3-1.8-10 0.9z",
    "m945 82-121 121h-34l-48 48c-3.1-2.1-7.3-1.8-10 1-3.1 3.1-3.1 8.1 0 11s8.1 3.1 11 0c2.7-2.7 3-6.9 1-10l47-47h34l121-121h105l85-86h-4.2l-82 82h-105z",
    "m968 45c0 4.4 3.5 7.9 7.9 7.9 3.8 0 7-2.8 7.7-6.4h35l46-46h-4.2l-44 44h-34c-0.7-3.6-3.9-6.4-7.7-6.4-4.5 0-8 3.6-8 7.9z",
    "m660 311c-3.6 0.7-6.4 3.9-6.4 7.7 0 4.4 3.5 7.9 7.9 7.9s7.9-3.5 7.9-7.9c0-3.8-2.8-7-6.4-7.7v-128l-67-67v-61l56-56h-4.2l-54 54v63l67 67v127z",
    "m506 345c3.1 3.1 8.1 3.1 11 0s3.1-8.1 0-11c-2.7-2.7-6.9-3-10-1l-90-90v-100l-27-27c2.1-3.1 1.8-7.3-1-10-3.1-3.1-8.1-3.1-11 0s-3.1 8.1 0 11c2.7 2.7 6.9 3 10 1l26 26v100l91 91c-2.2 3-1.8 7.2 0.9 9.9z",
    "m320 529c-4.4 0-7.9 3.5-7.9 7.9s3.5 7.9 7.9 7.9c3.8 0 7-2.8 7.7-6.4h74c0.7 3.6 3.9 6.4 7.7 6.4 4.4 0 7.9-3.5 7.9-7.9s-3.5-7.9-7.9-7.9c-3.8 0-7 2.8-7.7 6.4h-74c-0.7-3.6-3.9-6.4-7.7-6.4z",
    "m58 121c3.1 3.1 8.1 3.1 11 0s3.1-8.1 0-11c-2.7-2.7-6.9-3-10-1l-59-59v4.2l57 57c-2.1 3.1-1.8 7.3 0.9 10z",
    "m47 223c3.1 3.1 8.1 3.1 11 0s3.1-8.1 0-11c-2.7-2.7-6.9-3-10-1l-48-48v4.2l46 46c-2.1 3.1-1.8 7.3 0.9 10z",
    "m107 179 74 74c-2.1 3.1-1.8 7.3 1 10 3.1 3.1 8.1 3.1 11 0s3.1-8.1 0-11c-2.7-2.7-6.9-3-10-1l-75-75h-42l-67-66v4.2l65 65h42z",
    "m506 451c3.1 3.1 8.1 3.1 11 0s3.1-8.1 0-11c-2.7-2.7-6.9-3-10-1l-152-152v-102l-78-78c2.1-3.1 1.8-7.3-1-10-3.1-3.1-8.1-3.1-11 0s-3.1 8.1 0 11c2.7 2.7 6.9 3 10 1l77 77v102l152 152c-2.2 3-1.8 7.2 0.9 9.9z",
    "m276 534c-3.1-2.1-7.3-1.8-10 1-3.1 3.1-3.1 8.1 0 11s8.1 3.1 11 0c2.7-2.7 3-6.9 1-10l78-78h35c0.7 3.6 3.9 6.4 7.7 6.4 4.4 0 7.9-3.5 7.9-7.9s-3.5-7.9-7.9-7.9c-3.8 0-7 2.8-7.7 6.4h-36l-79 79z",
    "m471 212 42 42c-2.1 3.1-1.8 7.3 1 10 3.1 3.1 8.1 3.1 11 0s3.1-8.1 0-11c-2.7-2.7-6.9-3-10-1l-41-41v-70l-140-140h-4.2l142 142v70z",
    "m552 224-32-32c2.1-3.1 1.8-7.3-1-10-3.1-3.1-8.1-3.1-11 0s-3.1 8.1 0 11c2.7 2.7 6.9 3 10 1l31 31v71h-34l-45-45c2.1-3.1 1.8-7.3-1-10-3.1-3.1-8.1-3.1-11 0s-3.1 8.1 0 11c2.7 2.7 6.9 3 10 1l46 46h38v-76z",
}

local circuitCPathCount = #circuitCPaths

if OPTIONS.drawCircuitC then
    for _, pathData in ipairs(circuitCPaths) do
        SZ.drawPath(masterLayer, masterLayout, pathData, theme.circuitC, 1.8)
    end
else
    if OPTIONS.drawCircuitCRange then
        local firstIndex = math.max(1, math.floor(OPTIONS.drawCircuitCRangeStart or 1))
        local lastIndex = math.min(#circuitCPaths, math.floor(OPTIONS.drawCircuitCRangeEnd or #circuitCPaths))
        if lastIndex >= firstIndex then
            for index = firstIndex, lastIndex do
                SZ.drawPath(masterLayer, masterLayout, circuitCPaths[index], theme.circuitC, 1.8)
            end
        end
    end

    if OPTIONS.drawCircuitCRange2 then
        local firstIndex = math.max(1, math.floor(OPTIONS.drawCircuitCRange2Start or 1))
        local lastIndex = math.min(#circuitCPaths, math.floor(OPTIONS.drawCircuitCRange2End or #circuitCPaths))
        if lastIndex >= firstIndex then
            for index = firstIndex, lastIndex do
                SZ.drawPath(masterLayer, masterLayout, circuitCPaths[index], theme.circuitC, 1.8)
            end
        end
    end

    local circuitCGroups = {
        { enabled = OPTIONS.drawCircuitCGroup1, first = 1, last = 23 },
        { enabled = OPTIONS.drawCircuitCGroup2, first = 24, last = 46 },
        { enabled = OPTIONS.drawCircuitCGroup3, first = 47, last = 69 },
        { enabled = OPTIONS.drawCircuitCGroup4, first = 70, last = #circuitCPaths },
    }

    for _, group in ipairs(circuitCGroups) do
        if group.enabled then
            for index = group.first, group.last do
                SZ.drawPath(masterLayer, masterLayout, circuitCPaths[index], theme.circuitC, 1.8)
            end
        end
    end
end

-- Dot indicators (circles in circuitC color)
local dots = {
    { x = 373, y = 430, r = 8.6 },
    { x = 296, y = 453, r = 8.6 },
    { x = 71, y = 562, r = 8.6 },
    { x = 130, y = 280, r = 8.6 },
    { x = 186, y = 219, r = 8.6 },
    { x = 160, y = 188, r = 8.6 },
    { x = 456, y = 188, r = 8.6 },
    { x = 767, y = 201, r = 8.6 },
    { x = 568, y = 35, r = 8.6 },
    { x = 1000, y = 122, r = 8.6 },
    { x = 1305, y = 685, r = 8.6 },
    { x = 834, y = 774, r = 8.6 },
    { x = 1314, y = 879, r = 8.6 },
    { x = 1240, y = 733, r = 8.6 },
    { x = 386, y = 742, r = 8.6 },
    { x = 264, y = 836, r = 8.6 },
    { x = 532, y = 943, r = 8.6 },
    { x = 386, y = 808, r = 8.6 },
    { x = 80, y = 764, r = 8.6 },
    { x = 851, y = 828, r = 8.6 },
    { x = 935, y = 325, r = 8.6 },
    { x = 986, y = 318, r = 8.6 },
    { x = 92, y = 318, r = 8.6 },
}

if OPTIONS.drawCircuitDots then
    for _, dot in ipairs(dots) do
        SZ.drawDot(masterLayer, masterLayout, dot.x, dot.y, dot.r, theme.circuitC)
    end
end

-- ===== INNER BOARD SVG =====
-- Position: left:10vw, top:10vh, size:80vw x 80vh
-- viewBox="0 0 231 156" scaled to fit 80% of screen
local boardLayer = layers.board
local boardW = resolutionX * 0.8
local boardH = resolutionY * 0.8
local boardScaleX = boardW / 231
local boardScaleY = boardH / 156
local boardScale = math.min(boardScaleX, boardScaleY)
local boardX = resolutionX * 0.1
local boardY = resolutionY * 0.1

local boardLayout = {
    screenW = resolutionX,
    screenH = resolutionY,
    sourceW = 231,
    sourceH = 156,
    scale = boardScale,
    scaleX = boardScaleX,
    scaleY = boardScaleY,
    x = boardX,
    y = boardY,
}
local boardOutlinePath = "m76.53 1636.6h335l49.6-41.6 1505.6 0.62 47 41h327l40-33v-237l-43.59-51.6 3.45-901.44 42-36-2.59-265.46-40.05-35.91-330.6 0.62041-47 41-490.65 2.2-64-61h-560l-65.65 62.09h-334l-48.6-41.62-328.7-4.36-33.3 36.36-4.52 45.54 35.68 38.7 3.61 322.36-35 29v635l33 28 0.31 271.5-33 40v82z"
local boardTransform = { 0.098, 0, 0, -0.098, -3, 161 }

setNextFillColor(boardLayer, 0, 0, 0, 0.8)
addBox(boardLayer, boardX, boardY, boardW, boardH)

if OPTIONS.drawBoardOutline then
    SZ.drawPath(boardLayer, boardLayout, boardOutlinePath, theme.primary, 3.0, boardTransform)
end

local highlightPaths = {
    "m413 119-30-26h-300l25 26h305",
    "m85 94h297l28 24h-302l-23-24",
    "m2312 93h-300l-30 26h305l25-26",
    "m2000 94h297l-23 24h-302l28-24",
    "m836 84h566l37 35h-638l35-35",
    "m2309 1620h-300l-25-21h350l-25 21",
    "m402 1620h-300l-25-21h350l-25 21",
    "m46 195-20-15v351l20-16v-320",
    "m46 1215-21-18v305l21-25v-262",
    "m2330 1473 29 34v-38l-29-34v38",
    "m2330 1549 29 34v-38l-29-34v38",
    "m2330 1359v38l29 34v-38",
    "m2330 238v38l29-34v-38",
    "m2330 314v38l29-34v-38",
    "m2330 158v38l29-34v-38",
    "m42 111v38l29 34v-38",
    "m42 1552v38l29-34v-38",
}

if OPTIONS.drawBoardHighlights then
    for _, pathData in ipairs(highlightPaths) do
        SZ.drawPath(boardLayer, boardLayout, pathData, theme.highlight, 2.0, boardTransform)
    end
end

-- ===== CIRCLE LOGO =====
-- Position: left:14vw, top:32vh, size:20vw x 20vw
local logoLayer = layers.logo
local logoX = resolutionX * 0.14
local logoTop = resolutionY * 0.32
local logoSize = resolutionX * 0.20

local logoLayout = {
    screenW = resolutionX,
    screenH = resolutionY,
    sourceW = 248.17,
    sourceH = 286.55,
    scale = (logoSize / 248.17),
    x = logoX,
    y = logoTop,
}

if OPTIONS.drawLogo and logoReady and sharedLogoAssets and sharedLogoAssets.logoSvg then
    SZ.drawSvgEntry(logoLayer, logoLayout, sharedLogoAssets.logoSvg, {
        vars = sharedLogoAssets.vars,
        classifiedShapes = sharedLogoAssets.logoShapes,
        classifiedMode = "fill",
        strokeWidth = 2.0,
    })
end

-- ===== MESSAGE TEXT =====
-- "SilverZero's Lab" at top:14vw, left:36vw, font-size:7vw
local textLayer = layers.text
local titleLine1 = "SilverZero's"
local titleLine2 = "LAB"
local titleX = resolutionX * 0.39
local titleY1 = resolutionY * 0.44
local titleY2 = resolutionY * 0.59

if OPTIONS.drawText then
    local titleFont = SZ.font("Arial", math.max(1, math.floor(resolutionX * 0.064)))
    local subtitleFont = SZ.font("Arial", math.max(1, math.floor(resolutionX * 0.072)))
    setNextTextAlign(textLayer, AlignH_Left, AlignV_Middle)
    setNextFillColor(textLayer, theme.textColor[1], theme.textColor[2], theme.textColor[3], theme.textColor[4])
    addText(textLayer, titleFont, titleLine1, titleX, titleY1)
    addText(textLayer, subtitleFont, titleLine2, titleX + resolutionX * 0.23, titleY2)
end

if OPTIONS.showDebugInfo then
    local debugFont = SZ.font("Arial", math.max(12, math.floor(resolutionY * 0.018)))
    local debugLine1 = string.format("res %dx%d  circuitC %d", resolutionX, resolutionY, circuitCPathCount)
    local debugLine2 = string.format("range %d-%d", OPTIONS.drawCircuitCRangeStart or 1, OPTIONS.drawCircuitCRangeEnd or circuitCPathCount)
    local debugLine3 = string.format("range2 %d-%d", OPTIONS.drawCircuitCRange2Start or 1, OPTIONS.drawCircuitCRange2End or circuitCPathCount)

    setNextTextAlign(textLayer, AlignH_Left, AlignV_Top)
    setNextFillColor(textLayer, 1, 1, 1, 0.85)
    addText(textLayer, debugFont, debugLine1, 16, resolutionY - 64)
    addText(textLayer, debugFont, debugLine2, 16, resolutionY - 44)
    addText(textLayer, debugFont, debugLine3, 16, resolutionY - 24)
end
