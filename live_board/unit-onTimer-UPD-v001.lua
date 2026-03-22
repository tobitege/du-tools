if SCREEN_LAYOUT_EDITOR_ENABLED and type(SCREEN_LAYOUT_EDITOR_MODULE) == "table" then
    local outputText = Screen.getScriptOutput()
    if type(outputText) == "string" and outputText ~= "" then
        local record = SCREEN_LAYOUT_EDITOR_MODULE.buildPersistenceRecordFromOutput(
            outputText,
            SCREEN_LAYOUT_EDITOR_MAX_SCREEN_CODE_CHARS
        )
        if record and record.fits then
            if record.revision ~= SCREEN_LAYOUT_EDITOR_LAST_PERSISTED_REVISION
                or record.hash ~= SCREEN_LAYOUT_EDITOR_LAST_PERSISTED_HASH then
                databank.setStringValue(record.key, record.text)
                SCREEN_LAYOUT_EDITOR_LAST_PERSISTED_REVISION = record.revision
                SCREEN_LAYOUT_EDITOR_LAST_PERSISTED_HASH = record.hash
            end
            Screen.clearScriptOutput()
        end
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
