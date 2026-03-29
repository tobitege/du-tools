local function SLEBuildRecordFromOutput(module, text, maxChars)
    if type(module) ~= "table" then
        return nil, "no_module"
    end
    if type(text) == "string" and text ~= "" and type(module.deserializeDocument) == "function" then
        local document, documentError = module.deserializeDocument(text)
        if document then
            local record = module.buildPersistenceRecord(document, maxChars)
            record.document = document
            return record, nil
        end
        if documentError == "probe_output" then
            return nil, documentError
        end
    end
    if type(text) == "string" and text ~= "" then
        local probeRevision, probeError, probeLength = text:match("^p|([^|]+)|([^|]+)|([^|]+)$")
        if probeRevision then
            if type(SLEP) == "function" then
                SLEP(
                    "sle-probe",
                    string.format(
                        "pr e=%s l=%s r=%s",
                        tostring(probeError or "?"),
                        tostring(tonumber(probeLength, 36) or probeLength or "?"),
                        tostring(tonumber(probeRevision, 36) or probeRevision or "?")
                    ),
                    "info"
                )
            end
            return nil, "probe_output"
        end

        local rev36, id36, x36, y36, w36, h36, sx36, sy36 = text:match("^d|([^|]+)|([^|]+)|([^|]+)|([^|]+)|([^|]+)|([^|]+)|([^|]+)|([^|]+)$")
        if rev36 then
            local screenWidth = tonumber(sx36, 36) or 1920
            local screenHeight = tonumber(sy36, 36) or 1080
            local document = type(SCREEN_LAYOUT_EDITOR_LAST_DOCUMENT) == "table"
                and module.normalizeDocument(SCREEN_LAYOUT_EDITOR_LAST_DOCUMENT, screenWidth, screenHeight)
                or module.createDefaultDocument(screenWidth, screenHeight)
            local wantedId = tostring(id36 or "")
            local element = type(module.findElement) == "function" and module.findElement(document, wantedId) or nil
            if not element then
                local wantedIndex = tonumber(id36, 36)
                if wantedIndex and wantedIndex > 0 then
                    local currentIndex = 0
                    for index = 1, #document.elements do
                        local candidate = document.elements[index]
                        if candidate.movable ~= false or candidate.resizable ~= false then
                            currentIndex = currentIndex + 1
                            if currentIndex == wantedIndex then
                                element = candidate
                                break
                            end
                        end
                    end
                end
            end
            if not element then
                return nil, "delta_id"
            end
            local x = tonumber(x36, 36)
            local y = tonumber(y36, 36)
            local w = tonumber(w36, 36)
            local h = tonumber(h36, 36)
            if not x or not y or not w or not h then
                return nil, "delta_rect"
            end
            element.x = x
            element.y = y
            element.w = w
            element.h = h
            document.selectedId = element.id
            document.screenWidth = screenWidth
            document.screenHeight = screenHeight
            document.revision = math.max(0, math.floor(tonumber(rev36, 36) or document.revision or 0))
            local record = module.buildPersistenceRecord(document, maxChars)
            record.document = document
            return record, nil
        end
    end
    local record, recordError = module.buildPersistenceRecordFromOutput(text, maxChars)
    if record then
        return record, recordError
    end
    if recordError == "probe_output" then
        return nil, "probe_output"
    end
    if type(text) ~= "string" or text == "" or type(json) ~= "table" or type(json.decode) ~= "function" then
        return nil, recordError
    end
    local decoded = json.decode(text)
    if type(decoded) ~= "table" then
        return nil, recordError
    end
    if decoded.p ~= nil and decoded.d == nil and decoded.document == nil and decoded.m == nil and decoded.minimal == nil then
        if type(SLEP) == "function" then
            SLEP(
                "sle-probe",
                string.format(
                    "pr e=%s l=%s r=%s",
                    tostring(decoded.e or "?"),
                    tostring(decoded.l or "?"),
                    tostring(decoded.r or "?")
                ),
                "info"
            )
        end
        return nil, "probe_output"
    end
    local outputKind = decoded.kind or decoded.k
    if outputKind == module.TRANSPORT_KIND then
        local screenWidth = (type(decoded.sx) == "string" and tonumber(decoded.sx, 36)) or 1920
        local screenHeight = (type(decoded.sy) == "string" and tonumber(decoded.sy, 36)) or 1080
        local document = type(SCREEN_LAYOUT_EDITOR_LAST_DOCUMENT) == "table"
            and module.normalizeDocument(SCREEN_LAYOUT_EDITOR_LAST_DOCUMENT, screenWidth, screenHeight)
            or module.createDefaultDocument(screenWidth, screenHeight)
        local elementId = tostring(decoded.i or decoded.id or "")
        local element = module.findElement(document, elementId)
        if not element then
            return nil, "delta_id"
        end
        local x = type(decoded.x) == "string" and tonumber(decoded.x, 36) or nil
        local y = type(decoded.y) == "string" and tonumber(decoded.y, 36) or nil
        local w = type(decoded.w) == "string" and tonumber(decoded.w, 36) or nil
        local h = type(decoded.h) == "string" and tonumber(decoded.h, 36) or nil
        if not x or not y or not w or not h then
            return nil, "delta_rect"
        end
        element.x = x
        element.y = y
        element.w = w
        element.h = h
        document.selectedId = element.id
        document.screenWidth = screenWidth
        document.screenHeight = screenHeight
        document.revision = math.max(0, math.floor(tonumber(decoded.r) or document.revision or 0))
        record = module.buildPersistenceRecord(document, maxChars)
        record.document = document
        return record, nil
    end
    if outputKind ~= module.OUTPUT_KIND and outputKind ~= module.LEGACY_OUTPUT_KIND then
        return nil, recordError
    end
    local documentValue = decoded.document or decoded.d
    local patchValue = decoded.minimal or decoded.m
    local document, documentError = nil, nil
    if type(documentValue) == "string" and documentValue ~= "" then
        document, documentError = module.deserializeDocument(documentValue)
    elseif type(patchValue) == "string" and patchValue ~= "" and type(module.deserializeLayoutPatch) == "function" then
        document, documentError = module.deserializeLayoutPatch(patchValue)
    else
        document = module.normalizeDocument(documentValue)
    end
    if not document then
        return nil, documentError or "document_parse_error"
    end
    document.revision = math.max(0, math.floor(tonumber(decoded.revision or decoded.r) or document.revision or 0))
    local serialized = module.serializeDocument(document)
    local hash = module.hashText(serialized)
    local expectedHash = tonumber(decoded.hash or decoded.g)
    if expectedHash and hash ~= expectedHash then
        return nil, "hash_mismatch"
    end
    record = module.buildPersistenceRecord(document, maxChars)
    if record.revision ~= document.revision or record.hash ~= hash then
        return nil, "output_mismatch"
    end
    return record, nil
end

local function SLEParseStartupAck(text)
    if type(text) ~= "string" or text == "" then
        return nil
    end
    local token, index36, count36 = text:match("^a|([^|]*)|([^|]*)|([^|]*)$")
    if not token then
        return nil
    end
    local chunkIndex = tonumber(index36, 36)
    local chunkCount = tonumber(count36, 36)
    if not chunkIndex or not chunkCount or chunkIndex < 1 or chunkCount < 1 then
        return nil
    end
    return {
        token = token,
        chunkIndex = chunkIndex,
        chunkCount = chunkCount
    }
end

local function SLEClearScreenOutputs(outputScreen)
    if type(Screens) == "table" and #Screens > 0 then
        for index = 1, #Screens do
            Screens[index].clearScriptOutput()
        end
    elseif outputScreen then
        outputScreen.clearScriptOutput()
    end
end

local function SLEPushStartupChunk(transfer)
    if type(transfer) ~= "table" or type(BuildEditableRenderScriptInput) ~= "function" then
        return false
    end
    local chunkIndex = math.max(1, math.floor(tonumber(transfer.nextIndex) or 1))
    local inputText = BuildEditableRenderScriptInput(transfer, chunkIndex)
    if inputText == "" then
        return false
    end
    local targetScreens = type(Screens) == "table" and #Screens > 0 and Screens or (Screen and { Screen } or nil)
    if type(targetScreens) ~= "table" or #targetScreens <= 0 then
        return false
    end
    for index = 1, #targetScreens do
        targetScreens[index].setScriptInput(inputText)
    end
    transfer.nextIndex = chunkIndex
    return true
end

local function SLEPersistRecord(record)
    if type(record) ~= "table" then
        return false
    end
    if not databank then
        if type(SLEP) == "function" then
            SLEP(
                "sle-persist",
                "db skip: no db",
                "error",
                true
            )
        end
        return false
    end
    if (
        record.revision == SCREEN_LAYOUT_EDITOR_LAST_PERSISTED_REVISION
        and record.hash == SCREEN_LAYOUT_EDITOR_LAST_PERSISTED_HASH
    ) then
        if type(SLEP) == "function" then
            SLEP(
                "sle-persist",
                string.format(
                    "dup r=%d h=%s",
                    record.revision or 0,
                    tostring(record.hash or "?")
                ),
                "debug"
            )
        end
        return true
    end
    local writeOk, writeError = pcall(databank.setStringValue, record.key, record.text)
    if not writeOk then
        if type(SLEP) == "function" then
            SLEP(
                "sle-persist",
                "db err: " .. tostring(writeError),
                "error",
                true
            )
        end
        return false
    end
    local readOk, storedText = pcall(databank.getStringValue, record.key)
    local hasOk, hasKey = pcall(databank.hasKey, record.key)
    if readOk and storedText == record.text then
        SCREEN_LAYOUT_EDITOR_LAST_PERSISTED_REVISION = record.revision
        SCREEN_LAYOUT_EDITOR_LAST_PERSISTED_HASH = record.hash
        SCREEN_LAYOUT_EDITOR_LAST_DOCUMENT = record.document or SCREEN_LAYOUT_EDITOR_LAST_DOCUMENT
        if type(SLEP) == "function" then
            SLEP(
                "sle-persist",
                string.format(
                    "db r=%d h=%s b=%d",
                    record.revision or 0,
                    tostring(record.hash or "?"),
                    record.length or #record.text
                ),
                "info"
            )
        end
        return true
    end
    if type(SLEP) == "function" then
        SLEP(
            "sle-persist",
            string.format(
                "db rb hk=%s b=%d",
                tostring((hasOk and hasKey) or false),
                readOk and #tostring(storedText or "") or -1
            ),
            "error",
            true
        )
    end
    return false
end

SLE_DIAG = SLE_DIAG ~= false
SCREEN_LAYOUT_EDITOR_DIAG_LAST = type(SCREEN_LAYOUT_EDITOR_DIAG_LAST) == "table" and SCREEN_LAYOUT_EDITOR_DIAG_LAST or {}
SLE_LOG_LEVEL = string.lower(tostring(SLE_LOG_LEVEL or "error"))
SLE_BUILD = tostring(SLE_BUILD or "0328l")
local SLE_LEVEL_RANK = {
    debug = 1,
    info = 2,
    error = 3
}
local function SLEShouldPrint(level)
    local wanted = SLE_LEVEL_RANK[SLE_LOG_LEVEL] or SLE_LEVEL_RANK.info
    local current = SLE_LEVEL_RANK[string.lower(tostring(level or "debug"))] or SLE_LEVEL_RANK.debug
    return current >= wanted
end
SLEP = SLEP or function(key, text, levelOrForce, force)
    if not SLE_DIAG then
        return
    end
    if type(system) ~= "table" or type(system.print) ~= "function" then
        return
    end
    local level = "debug"
    local sticky = force == true
    if type(levelOrForce) == "boolean" then
        sticky = levelOrForce
    elseif type(levelOrForce) == "string" and levelOrForce ~= "" then
        level = string.lower(levelOrForce)
    end
    if not SLEShouldPrint(level) then
        return
    end
    local normalizedKey = tostring(key or text or "")
    local normalizedText = tostring(text or "")
    if not sticky and SCREEN_LAYOUT_EDITOR_DIAG_LAST[normalizedKey] == normalizedText then
        return
    end
    SCREEN_LAYOUT_EDITOR_DIAG_LAST[normalizedKey] = normalizedText
    system.print("[SLE] " .. normalizedText)
end

if SCREEN_LAYOUT_EDITOR_UPD_PING ~= SLE_BUILD then
    SCREEN_LAYOUT_EDITOR_UPD_PING = SLE_BUILD
    if type(SLEP) == "function" then
        SLEP(
            "sle-upd",
            string.format(
                "u %s m=%s db=%s en=%s",
                SLE_BUILD,
                type(SCREEN_LAYOUT_EDITOR_MODULE),
                tostring(databank ~= nil),
                tostring(SCREEN_LAYOUT_EDITOR_ENABLED == true)
            ),
            "debug",
            true
        )
    end
end

if SCREEN_LAYOUT_EDITOR_ENABLED and type(SCREEN_LAYOUT_EDITOR_MODULE) == "table" then
    local outputText = nil
    local outputScreen = nil
    if type(Screens) == "table" and #Screens > 0 then
        for index = 1, #Screens do
            local candidate = Screens[index].getScriptOutput()
            if type(candidate) == "string" and candidate ~= "" then
                outputText = candidate
                outputScreen = Screens[index]
                break
            end
        end
    elseif Screen then
        outputText = Screen.getScriptOutput()
        outputScreen = Screen
    end
    local startupTransfer = type(SCREEN_LAYOUT_EDITOR_STARTUP_TRANSFER) == "table" and SCREEN_LAYOUT_EDITOR_STARTUP_TRANSFER or nil
    if startupTransfer and math.max(1, math.floor(tonumber(startupTransfer.count) or 0)) > 0 then
        local ack = SLEParseStartupAck(outputText)
        if ack and ack.token == tostring(startupTransfer.token or "") then
            startupTransfer.nextIndex = ack.chunkIndex + 1
            SLEClearScreenOutputs(outputScreen)
            if ack.chunkIndex >= ack.chunkCount then
                local targetScreens = type(Screens) == "table" and #Screens > 0 and Screens or (Screen and { Screen } or nil)
                if type(targetScreens) == "table" then
                    for index = 1, #targetScreens do
                        targetScreens[index].setScriptInput("")
                    end
                end
                SCREEN_LAYOUT_EDITOR_STARTUP_TRANSFER = nil
                if type(SLEP) == "function" then
                    SLEP(
                        "sle-startup",
                        string.format(
                            "tx ok c=%d b=%d",
                            ack.chunkCount,
                            tonumber(startupTransfer.length) or -1
                        ),
                        "info",
                        true
                    )
                end
            else
                SLEPushStartupChunk(startupTransfer)
                if type(SLEP) == "function" then
                    SLEP(
                        "sle-startup",
                        string.format("tx %d/%d", ack.chunkIndex + 1, ack.chunkCount),
                        "debug"
                    )
                end
            end
            return
        end
        if outputText and outputText ~= "" then
            SLEClearScreenOutputs(outputScreen)
        end
        SLEPushStartupChunk(startupTransfer)
        return
    end
    local startupAck = SLEParseStartupAck(outputText)
    if startupAck then
        SLEClearScreenOutputs(outputScreen)
        if type(SLEP) == "function" then
            SLEP(
                "sle-startup-echo",
                string.format("tx echo %d/%d", startupAck.chunkIndex, startupAck.chunkCount),
                "debug"
            )
        end
        return
    end
    if type(outputText) == "string" and outputText ~= "" then
        if type(SLEP) == "function" then
            SLEP(
                "sle-receive",
                string.format("rx b=%d", #outputText),
                "info"
            )
        end
        local record, recordError = SLEBuildRecordFromOutput(
            SCREEN_LAYOUT_EDITOR_MODULE,
            outputText,
            SCREEN_LAYOUT_EDITOR_MAX_SCREEN_CODE_CHARS
        )
        if record and record.fits then
            SLEPersistRecord(record)
        elseif record == nil and recordError and recordError ~= "probe_output" then
            system.print("WARN: SLE output ignored: " .. tostring(recordError))
            if type(SLEP) == "function" then
                SLEP(
                    "sle-reject",
                    "rej: " .. tostring(recordError),
                    "error",
                    true
                )
            end
        elseif record and not record.fits then
            system.print(
                "WARN: SLE output exceeds max length: "
                    .. tostring(record.length)
                    .. "/"
                    .. tostring(record.maxLength)
            )
            if type(SLEP) == "function" then
                SLEP(
                    "sle-too-long",
                    string.format(
                        "long l=%d m=%d",
                        record.length or -1,
                        record.maxLength or -1
                    ),
                    "error",
                    true
                )
            end
        end
        SLEClearScreenOutputs(outputScreen)
    end
    return
end

AmountToCraft = AmountToCraft or 1
Index = Index or 1
MaxIndex = MaxIndex or 1
MAmountToCraft = MAmountToCraft or 1
MIndex = MIndex or 1
lastClickedCategory = lastClickedCategory or ""
cachedSchematicName = cachedSchematicName or ""
lastRenderedRecipeList = lastRenderedRecipeList or defaultRecipeList or lastCategory or "Pure"
lastRenderedTierGroup = lastRenderedTierGroup or defaultTierGroup or lastTierGroup or "Common"
lastRenderedLineNum = lastRenderedLineNum or 0

local RecipesPerPage = 18
local MouseWheel = -system.getMouseWheel()
local output = json.decode(Screen.getScriptOutput()) or {}
local outputID = output.ID or ""
local outputRecipescount = output.RecipesCount or 0
local lineNum = ParseLineSelection(output.Line)
if lineNum == nil then lineNum = lastRenderedLineNum end
local databankKey = GetDatabankKeyForLine(lineNum)
local categoryKey = output.RecipeList or defaultRecipeList or lastCategory or "Pure"
if categoryKey == "" then categoryKey = "Pure" end
local tierGroupKey = output.TierGroup or defaultTierGroup or lastTierGroup or "Common"
if tierGroupKey ~= "Rare" then tierGroupKey = "Common" end

local needsRebuild = false
local shouldClearOutput = false
local autoSwitchedTierGroup = false
local selectedRecipe = nil
local canRunSelectedRecipe = false
local lineChanged = lineNum ~= lastRenderedLineNum

MaxIndex = math.ceil(outputRecipescount / RecipesPerPage)
if MaxIndex < 1 then MaxIndex = 1 end

if output.TierButtonClicked then
    local tierNum = tonumber(string.sub(output.TierButtonClicked, 2))
    if tierNum and tierNum >= 1 and tierNum <= 5 and TiersEnabled[tierNum] then
        selectedTiers[tierNum] = not selectedTiers[tierNum]
        SaveTierFilter()
        needsRebuild = true
    end
    shouldClearOutput = true
end

if output.StopButtonPressed then
    StopIndustryLine(lineNum, databankKey)
    shouldClearOutput = true
end

if output.CraftButtonPressed then
    if canRunSelectedRecipe then
        local timerName = lineNum > 0 and "RT"..lineNum or "RT1"
        StartIndustryForAmount(lineNum, outputID, AmountToCraft, timerName)
    end
    shouldClearOutput = true
end

if output.MCraftButtonPressed then
    if canRunSelectedRecipe then
        StartIndustryMaintain(lineNum, outputID, MAmountToCraft)
    end
    shouldClearOutput = true
end

if output.CraftButtonActive then
    AmountToCraft = ClampValue(math.floor(AmountToCraft + -MouseWheel), 1, 999)
elseif not output.MCraftButtonActive then
    Index = ClampValue(math.floor(Index + MouseWheel), 1, MaxIndex)
end

if output.MCraftButtonActive then
    MAmountToCraft = ClampValue(math.floor(MAmountToCraft + -MouseWheel), 1, 999)
else
    MIndex = ClampValue(math.floor(MIndex + MouseWheel), 1, MaxIndex)
end

if lineChanged then
    local bestTierGroupKey = GetBestTierGroupForLine(categoryKey, tierGroupKey, lineNum)
    if bestTierGroupKey ~= tierGroupKey then
        tierGroupKey = bestTierGroupKey
        autoSwitchedTierGroup = true
        needsRebuild = true
        shouldClearOutput = true
    end
end

if not autoSwitchedTierGroup then
    selectedRecipe = GetRecipeByName(output.Category)
    canRunSelectedRecipe = selectedRecipe ~= nil and outputID ~= nil and outputID ~= "" and CanLineProduceRecipe(lineNum, selectedRecipe)
end

if categoryKey ~= lastRenderedRecipeList or tierGroupKey ~= lastRenderedTierGroup or lineNum ~= lastRenderedLineNum then
    needsRebuild = true
end

if needsRebuild then
    lastClickedCategory = ""
    cachedSchematicName = ""
end

local batches, rbatches, mbatches, UpTime, ReTime, lastItem = GetIndustryStatus(lineNum, databankKey)

local schematicItemId = outputID
if selectedRecipe and output.Category and output.Category ~= "" then
    if output.Category ~= lastClickedCategory then
        lastClickedCategory = output.Category
        if selectedRecipe.category == "Pure" and selectedRecipe.tier == 1 then
            cachedSchematicName = ""
        else
            cachedSchematicName = "Tier " .. selectedRecipe.tier .. " " .. selectedRecipe.category .. " Honeycomb Schematic Copy"
        end
        if not schematicItemId or schematicItemId == 0 or schematicItemId == "" then
            schematicItemId = selectedRecipe.id
        end
    end
elseif not output.Category or output.Category == "" then
    lastClickedCategory = ""
    cachedSchematicName = ""
end

if lastItem[1] == nil then
    xlastItem = system.getItem(Industry[1].element.getItemId()).iconPath
else
    xlastItem = system.getItem(lastItem[1].id).iconPath
end

local RemainingTime = ReTime - UpTime

local hrs = math.floor(((RemainingTime)/60)/60) or 0
local min = math.floor(((RemainingTime)/60)-(hrs*60)) or 0
local sec = math.floor((RemainingTime)-(min+(hrs*60))*60) or 0

local states = GetAllIndustryStates()
local input = {
    ["Icon"] = schematicItemId and system.getItem(schematicItemId).iconPath or "",
    ["HCIcon"] = system.getItem(Industry[1].element.getItemId()).iconPath,
    ["lastItem"] = xlastItem,
    ["Schematic"] = cachedSchematicName,
    ["locName"] = schematicItemId and system.getItem(schematicItemId).locDisplayNameWithSize or "",
    ["Batches"] = batches,
    ["Mamount"] = Industry[1].element.getInfo().maintainProductAmount,
    ["RBatches"] = rbatches,
    ["MBatches"] = mbatches,
    ["Index"] = Index,
    ["Hrs"] = hrs,
    ["Min"] = min,
    ["Sec"] = sec,
    ["BGimage"] = BackgroundImage,
    ["State1"] = states[1],
    ["State2"] = states[2],
    ["State3"] = states[3],
    ["State4"] = states[4],
    ["State5"] = states[5],
    ["State6"] = states[6],
    ["State7"] = states[7],
    ["State8"] = states[8],
    ["InduLength"] = #Industry,
    ["State"] = GetCurrentLineState(lineNum),
    ["AmountToCraft"] = AmountToCraft,
    ["MaxIndex"] = MaxIndex,
    ["MIndex"] = MIndex,
    ["MAmountToCraft"] = MAmountToCraft,
    ["ArkTime"] = system.getArkTime()
}
Screen.setScriptInput(json.encode(input))

if databank and output.RecipeList and output.RecipeList ~= "" then
    databank.setStringValue(CAT_DB_KEY, categoryKey)
    lastCategory = categoryKey
    defaultRecipeList = categoryKey
end
if databank then
    databank.setStringValue(TIER_GROUP_DB_KEY, tierGroupKey)
end
lastTierGroup = tierGroupKey
defaultTierGroup = tierGroupKey

if needsRebuild then
    local content = ScreenContentHC
    if categoryKey == "Pure" then
        content = ScreenContentHC
    elseif categoryKey == "Product" then
        content = ScreenContentHC2
    end
    Screen.setRenderScript(BuildRenderScript(categoryKey, lineNum, tierGroupKey)..content)
    lastRenderedRecipeList = categoryKey
    lastRenderedTierGroup = tierGroupKey
    lastRenderedLineNum = lineNum
end

if shouldClearOutput then
    Screen.clearScriptOutput()
end
