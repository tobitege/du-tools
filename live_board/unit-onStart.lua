system.print("------------------------------------")
system.print("HoneyCombControl v"..VERSION)
system.print("Customized by tobitege 2026-03-19")
system.print("------------------------------------")
-------------------------------------------------------------------------------------

MainColor = "215,65,0" --export: Main color RGB value
CraftColor = "0,80,150" --export: Main color RGB value
StopColor = "200,40,0" --export: Main color RGB value
StopColorSelect = "170,100,10" --export: Main color RGB value
CraftColorSelect = "0,100,140" --export: Main color RGB value
ButtonSelectColor = "205,110,0" --export Button Select color RGB value
Color3 = "255,255,255" -- Button Select Box color RGB value
FontColor = "0,0,0" --export Font color RGB value
BackgroundImage = false --export Background Image on/off
BackgroundColor = "0,0,0" --export Background Image on/off
ShowTier1 = true --export Show Tier 1 recipes and button
ShowTier2 = true --export Show Tier 2 recipes and button
ShowTier3 = true --export Show Tier 3 recipes and button
ShowTier4 = true --export Show Tier 4 recipes and button
ShowTier5 = true --export Show Tier 5 recipes and button
DEBUG = false --export Set to true to enable debug output for machine detection

-------------------------------------------------------------------------------------

-- Track which tiers are enabled via LUA parameters
TiersEnabled = {ShowTier1, ShowTier2, ShowTier3, ShowTier4, ShowTier5}

-- Validate at least one tier is enabled
local hasEnabledTier = false
for _, enabled in ipairs(TiersEnabled) do
    if enabled then
        hasEnabledTier = true
        break
    end
end
if not hasEnabledTier then
    system.print("ERROR: At least one tier must be enabled (ShowTier1-5)!")
    unit.exit()
    return
end

-- Hardcoded fallback recipe database (used if dynamic discovery fails)
DefaultRecipes = {
    -- Pure Ores - sorted by tier, then alphabetically
    -- Tier 1
    {name="Aluminium", id=3412263159, tier=1, category="Pure"},
    {name="Carbon", id=1302515042, tier=1, category="Pure"},
    {name="Iron", id=37528869, tier=1, category="Pure"},
    {name="Silicon", id=3653745342, tier=1, category="Pure"},
    -- Tier 2
    {name="Calcium", id=3952360352, tier=2, category="Pure"},
    {name="Chromium", id=2542211183, tier=2, category="Pure"},
    {name="Copper", id=910460789, tier=2, category="Pure"},
    {name="Sodium", id=4053801305, tier=2, category="Pure"},
    -- Tier 3
    {name="Lithium", id=1127716470, tier=3, category="Pure"},
    {name="Nickel", id=460946213, tier=3, category="Pure"},
    {name="Silver", id=3398664647, tier=3, category="Pure"},
    {name="Sulfur", id=1203365798, tier=3, category="Pure"},
    -- Products - sorted by tier, then alphabetically
    -- Tier 1
    {name="Brick", id=1795739234, tier=1, category="Product"},
    {name="Carbon Fiber", id=4090723846, tier=1, category="Product"},
    {name="Concrete", id=2182865731, tier=1, category="Product"},
    {name="Marble", id=2230700424, tier=1, category="Product"},
    {name="Plastic", id=700746008, tier=1, category="Product"},
    {name="Silumin", id=1728732765, tier=1, category="Product"},
    {name="Steel", id=2116396300, tier=1, category="Product"},
    {name="Wood", id=1413882890, tier=1, category="Product"},
    -- Tier 2
    {name="Duralumin", id=3868188998, tier=2, category="Product"},
    {name="Stainless Steel", id=1902887537, tier=2, category="Product"},
    -- Tier 3
    {name="Al-Li", id=3731467161, tier=3, category="Product"},
    {name="Inconel", id=499986391, tier=3, category="Product"},
    -- Tier 4 Pure
    {name="Cobalt", id=2555431045, tier=4, category="Pure"},
    {name="Fluorine", id=2977737982, tier=4, category="Pure"},
    {name="Gold", id=1325185658, tier=4, category="Pure"},
    {name="Scandium", id=1613422978, tier=4, category="Pure"},
    -- Tier 4 Product
    {name="Maraging Steel", id=2577456363, tier=4, category="Product"},
    {name="Sc-Al", id=2579091250, tier=4, category="Product"},
    -- Tier 5 Product / Pure
    {name="Grade 5 Titanium alloy", id=3946529893, tier=5, category="Product", displayName="G5 Titanium"},
    {name="Mangalloy", id=560565938, tier=5, category="Product"},
    {name="Manganese", id=347785248, tier=5, category="Pure"},
    {name="Niobium", id=3146977693, tier=5, category="Pure"},
    {name="Titanium", id=1614272263, tier=5, category="Pure"},
    {name="Vanadium", id=3934620247, tier=5, category="Pure"}
}

local function FindDefaultRecipeById(itemId)
    for _, recipe in ipairs(DefaultRecipes) do
        if recipe.id == itemId then
            return recipe
        end
    end
    return nil
end

local function CopyRecipeEntry(recipe)
    local copy = {
        name = recipe.name,
        id = recipe.id,
        tier = recipe.tier,
        category = recipe.category,
        displayName = recipe.displayName,
    }

    if recipe.outputs then
        copy.outputs = {}
        for _, output in ipairs(recipe.outputs) do
            copy.outputs[#copy.outputs + 1] = {
                name = output.name,
                id = output.id,
            }
        end
    end

    return copy
end

local function SortRecipeCatalog(recipes)
    table.sort(recipes, function(a, b)
        if a.category ~= b.category then return a.category < b.category end
        if a.tier ~= b.tier then return a.tier < b.tier end
        return a.name < b.name
    end)
    return recipes
end

local function BuildRuntimeRecipeCatalog(discoveredRecipes)
    local merged = {}
    local seenKeys = {}
    local additionalCount = 0

    for _, recipe in ipairs(DefaultRecipes) do
        local key = string.format("%s|%d|%s", recipe.category, recipe.tier, recipe.name)
        merged[#merged + 1] = CopyRecipeEntry(recipe)
        seenKeys[key] = true
    end

    for _, recipe in ipairs(discoveredRecipes or {}) do
        local key = string.format("%s|%d|%s", recipe.category, recipe.tier, recipe.name)
        if not seenKeys[key] then
            merged[#merged + 1] = CopyRecipeEntry(recipe)
            seenKeys[key] = true
            additionalCount = additionalCount + 1
        end
    end

    return SortRecipeCatalog(merged), additionalCount
end

-- Strip " Honeycomb" suffix and size indicators to get the clean material name
local function ExtractMaterialName(locDisplayName)
    if not locDisplayName or locDisplayName == "" then return nil end
    local name = locDisplayName
    name = name:gsub(" Honeycomb.*$", "")
    name = name:gsub("^Pure%s+", "")
    name = name:gsub("%s+[Pp]roduct$", "")
    name = name:gsub("%s+[Cc]opy$", "")
    name = name:gsub("%s*%b()$", "")
    name = name:match("^%s*(.-)%s*$")
    if name == "" then return nil end
    return name
end

local function SelectMainRecipeForOutput(outputId)
    local bestRecipe = nil
    local bestQuantity = -1

    for _, candidate in ipairs(system.getRecipes(outputId) or {}) do
        for _, product in ipairs(candidate.products or {}) do
            if product.id == outputId and (product.quantity or 0) > bestQuantity then
                bestRecipe = candidate
                bestQuantity = product.quantity or 0
            end
        end
    end

    return bestRecipe
end

local function GetCategoryFromSchematic(schematicItem, mainRecipe)
    local schematicName = schematicItem and (schematicItem.locDisplayName or schematicItem.displayName) or ""
    local lowerSchematicName = schematicName:lower()
    if lowerSchematicName:find("product honeycomb") then
        return "Product"
    end
    if lowerSchematicName:find("pure honeycomb") then
        return "Pure"
    end

    for _, ingredient in ipairs(mainRecipe and mainRecipe.ingredients or {}) do
        local ingredientItem = system.getItem(ingredient.id)
        local ingredientName = ingredientItem and (ingredientItem.locDisplayName or ingredientItem.displayName) or ""
        local lowerIngredientName = ingredientName:lower()
        if lowerIngredientName:find(" product$") then
            return "Product"
        end
        if lowerIngredientName:find("^pure ") then
            return "Pure"
        end
    end

    return nil
end

local function GetTierFromSchematic(schematicItem, mainRecipe, outputItem)
    if mainRecipe and mainRecipe.tier then
        return mainRecipe.tier
    end

    local schematicName = schematicItem and (schematicItem.locDisplayName or schematicItem.displayName) or ""
    local tier = tonumber(schematicName:match("[Tt]ier%s*(%d+)"))
    if tier then
        return tier
    end

    return outputItem and outputItem.tier or nil
end

local function ExtractMaterialNameFromOutput(outputItem, mainRecipe, category)
    for _, ingredient in ipairs(mainRecipe and mainRecipe.ingredients or {}) do
        local ingredientItem = system.getItem(ingredient.id)
        local ingredientLabel = ingredientItem and (ingredientItem.locDisplayName or ingredientItem.displayName) or ""
        local materialName = ExtractMaterialName(ingredientLabel)
        local lowerIngredientLabel = ingredientLabel:lower()
        if category == "Product" and lowerIngredientLabel:find(" product$") then
            return materialName
        end
        if category == "Pure" and lowerIngredientLabel:find("^pure ") then
            return materialName
        end
    end

    local outputLabel = outputItem and (outputItem.locDisplayName or outputItem.displayName) or ""
    outputLabel = outputLabel:gsub("^[Aa]ged%s+", "")
    outputLabel = outputLabel:gsub("^[Gg]lossy%s+", "")
    outputLabel = outputLabel:gsub("^[Mm]atte%s+", "")
    outputLabel = outputLabel:gsub("^[Pp]olished%s+", "")
    outputLabel = outputLabel:gsub("^[Gg]alvanized%s+", "")
    outputLabel = outputLabel:gsub("^[Ww]axed%s+", "")
    outputLabel = outputLabel:gsub("^[Pp]ainted%s+[%a%-]+%s+", "")
    outputLabel = outputLabel:gsub("%s*%b()$", "")

    return ExtractMaterialName(outputLabel)
end

local function GetSchematicOutputIds(schematicId)
    local schematicItem = system.getItem(schematicId)
    local outputIds = {}
    local seenOutputIds = {}

    local function AddOutputId(productEntry)
        local productId = type(productEntry) == "table" and productEntry.id or productEntry
        if type(productId) == "number" and not seenOutputIds[productId] then
            seenOutputIds[productId] = true
            outputIds[#outputIds + 1] = productId
        end
    end

    for _, productEntry in ipairs(schematicItem and schematicItem.products or {}) do
        AddOutputId(productEntry)
    end

    for _, recipeData in ipairs(system.getRecipes(schematicId) or {}) do
        for _, productEntry in ipairs(recipeData.products or {}) do
            AddOutputId(productEntry)
        end
    end

    return schematicItem, outputIds
end

local function AddOutputToFamily(discoveredFamilies, category, tier, materialName, outputItem)
    if not category or not tier or not materialName or not outputItem or not outputItem.id then
        return
    end

    local key = string.format("%s|%d|%s", category, tier, materialName)
    local family = discoveredFamilies[key]
    if not family then
        family = {
            name = materialName,
            id = outputItem.id,
            tier = tier,
            category = category,
            outputs = {},
            _seenOutputIds = {},
        }
        discoveredFamilies[key] = family
    end

    if not family._seenOutputIds[outputItem.id] then
        family._seenOutputIds[outputItem.id] = true
        family.outputs[#family.outputs + 1] = {
            name = outputItem.locDisplayName or outputItem.displayName or materialName,
            id = outputItem.id,
        }
    end
end

-- Dynamic recipe discovery: aggregate machine schematics across all linked honeycomb refiners
local function DiscoverRecipes(industryLines)
    local discoveredFamilies = {}
    local seenSchematicIds = {}

    for _, industryLine in ipairs(industryLines or {}) do
        local machineElement = industryLine.element or industryLine
        local machineItem = machineElement and machineElement.getItemId and system.getItem(machineElement.getItemId()) or nil
        if not machineItem then
            if DEBUG then system.print("DiscoverRecipes: Could not get machine item info") end
            goto continue_machine
        end

        local schematics = machineItem.schematics
        if not schematics or #schematics == 0 then
            if DEBUG then
                system.print("DiscoverRecipes: No schematics field or empty on machine item " .. tostring(machineItem.displayName))
            end
            goto continue_machine
        end

        if DEBUG then
            system.print("DiscoverRecipes: Machine " .. tostring(machineItem.displayName) .. " has " .. #schematics .. " schematic entries")
        end

        for _, schematicId in ipairs(schematics) do
            if type(schematicId) ~= "number" or seenSchematicIds[schematicId] then
                goto continue_schematic
            end
            seenSchematicIds[schematicId] = true

            local schematicItem, outputIds = GetSchematicOutputIds(schematicId)
            if DEBUG then
                system.print("  Schematic " .. tostring(schematicItem and (schematicItem.locDisplayName or schematicItem.displayName) or schematicId) .. " -> " .. tostring(#outputIds) .. " output(s)")
            end

            for _, outputId in ipairs(outputIds) do
                local outputItem = system.getItem(outputId)
                if not outputItem or not outputItem.id then
                    goto continue_output
                end

                local mainRecipe = SelectMainRecipeForOutput(outputId)
                local category = GetCategoryFromSchematic(schematicItem, mainRecipe)
                local tier = GetTierFromSchematic(schematicItem, mainRecipe, outputItem)
                local materialName = ExtractMaterialNameFromOutput(outputItem, mainRecipe, category)
                local fallbackRecipe = FindDefaultRecipeById(outputItem.id)

                if fallbackRecipe then
                    category = category or fallbackRecipe.category
                    tier = tier or fallbackRecipe.tier
                    materialName = materialName or fallbackRecipe.name
                end

                if not category or not tier or not materialName then
                    if DEBUG then
                        system.print("    Skipping output " .. tostring(outputItem.locDisplayName or outputItem.displayName) .. " (category/tier/material unresolved)")
                    end
                    goto continue_output
                end

                if DEBUG then
                    system.print("    Discovered output " .. tostring(outputItem.locDisplayName or outputItem.displayName) .. " -> " .. materialName .. " (" .. category .. " T" .. tostring(tier) .. ")")
                end

                AddOutputToFamily(discoveredFamilies, category, tier, materialName, outputItem)

                ::continue_output::
            end

            ::continue_schematic::
        end

        ::continue_machine::
    end

    local discovered = {}
    for _, family in pairs(discoveredFamilies) do
        table.sort(family.outputs, function(a, b) return a.name < b.name end)
        family.id = family.outputs[1] and family.outputs[1].id or family.id
        family._seenOutputIds = nil
        discovered[#discovered + 1] = family
    end

    return SortRecipeCatalog(discovered)
end

local firstMachineDebugDone = false
local tierCounts = {0, 0, 0, 0, 0} -- Count machines per tier (1-5)
Industry = {}
for slot,element in pairs(unit) do -- checking elements in slots
    if type(element)=="table"and type(element.export)=="table"then
        if element.getClass then
            if element.getClass()=="ScreenUnit" then
                Screen=element
                element.activate()
            elseif string.find(element.getClass(),"Industry") and #Industry < 8 then
                local machineItem = system.getItem(element.getItemId())
                local displayName = machineItem and machineItem.displayName or ""
                -- Only include machines with "Honeycomb" in their displayName
                if string.find(displayName, "Honeycomb") then
                    local info = element.getInfo()
                    local machineTier = machineItem and machineItem.tier or 1
                    Industry[#Industry+1]={
                        element=element,
                        slot=slot,
                        info=info,
                        tier=machineTier,
                    }
                    -- Count this machine's tier
                    if machineTier >= 1 and machineTier <= 5 then
                        tierCounts[machineTier] = tierCounts[machineTier] + 1
                    end
                    -- Debug output for first non-tier-1 machine only (if DEBUG enabled)
                    if DEBUG and not firstMachineDebugDone and machineTier > 1 then
                        system.print("=== Industry Machine Debug Info (Slot "..slot..") ===")
                        system.print("-- Element Identity --")
                        system.print("Name: "..tostring(element.getName()))
                        system.print("Class: "..tostring(element.getClass()))
                        system.print("Class ID: "..tostring(element.getClassId()))
                        system.print("Item ID: "..tostring(element.getItemId()))
                        system.print("** STORED TIER: "..tostring(machineTier).." (Can produce honeycombs up to tier "..machineTier..") **")
                        system.print("-- getInfo() Table Fields --")
                        system.print("State: "..tostring(info.state))
                        system.print("Stop Requested: "..tostring(info.stopRequested))
                        system.print("Units Produced: "..tostring(info.unitsProduced))
                        system.print("Remaining Time: "..tostring(info.remainingTime))
                        system.print("Batches Requested: "..tostring(info.batchesRequested))
                        system.print("Batches Remaining: "..tostring(info.batchesRemaining))
                        system.print("Maintain Product Amount: "..tostring(info.maintainProductAmount))
                        system.print("Current Product Amount: "..tostring(info.currentProductAmount))
                        system.print("Required Schematic Amount: "..tostring(info.requiredSchematicAmount))
                        if info.requiredSchematicIds and #info.requiredSchematicIds > 0 then
                            system.print("Required Schematic IDs: "..#info.requiredSchematicIds.." schematic(s)")
                            for i, schematicId in ipairs(info.requiredSchematicIds) do
                                system.print("  Schematic "..i..": "..tostring(schematicId))
                            end
                        else
                            system.print("Required Schematic IDs: none")
                        end
                        if info.currentProducts and #info.currentProducts > 0 then
                            system.print("Current Products: "..#info.currentProducts.." product(s)")
                        else
                            system.print("Current Products: none")
                        end
                        -- Check for tier field directly in info
                        if info.tier then
                            system.print("Tier (from info): "..tostring(info.tier))
                        end
                        system.print("-- Checking system.getItem() for machine --")
                        local machineItem2 = system.getItem(element.getItemId())
                        if machineItem2 then
                            system.print("Machine locDisplayName: "..tostring(machineItem2.locDisplayName))
                            system.print("Machine displayName: "..tostring(machineItem2.displayName))
                            if machineItem2.tier then
                                system.print("Machine tier (from item): "..tostring(machineItem2.tier))
                            end
                            if machineItem2.products then
                                system.print("Machine products count: "..#machineItem2.products)
                                for pi, pentry in ipairs(machineItem2.products) do
                                    local pid = type(pentry) == "table" and pentry.id or pentry
                                    local pitem = system.getItem(pid)
                                    local pcat = ""
                                    if system.isMaterialItem and system.isMaterialItem(pid) then pcat = " [Material/Pure]"
                                    elseif system.isPartItem and system.isPartItem(pid) then pcat = " [Part/Product]" end
                                    system.print("  Product "..pi..": id="..pid.." name="..tostring(pitem and pitem.locDisplayName or "?").." type="..tostring(pitem and pitem.type or "?").." tier="..tostring(pitem and pitem.tier or "?").." children="..(pitem and pitem.childIds and #pitem.childIds or 0)..pcat)
                                end
                            else
                                system.print("Machine products: nil")
                            end
                            if machineItem2.schematics then
                                system.print("Machine schematics count: "..#machineItem2.schematics)
                            end
                        end
                        system.print("-- Class Membership Checks --")
                        local tierClasses = {
                            {name="IndustryBasic", tier=1},
                            {name="IndustryUncommon", tier=2},
                            {name="IndustryAdvanced", tier=3},
                            {name="IndustryRare", tier=4},
                            {name="IndustryExotic", tier=5},
                            {name="Industry1", tier=1},
                            {name="Industry2", tier=2},
                            {name="Industry3", tier=3},
                            {name="Industry4", tier=4},
                            {name="Industry5", tier=5},
                        }
                        for _, tc in ipairs(tierClasses) do
                            if element.isInClass(tc.name) then
                                system.print("MATCH: Machine is in class '"..tc.name.."' (tier "..tc.tier..")")
                            end
                        end
                        system.print("=====================================")
                        firstMachineDebugDone = true
                    end
                end -- end of Honeycomb filter
            elseif element.getClass():lower() == 'databankunit' then
                databank=element
            end
        end
    end
end

if #Industry == 0 then
    system.print("ERROR: No machines linked!")
    unit.exit()
    return
end

table.sort(Industry, function(a,b) return a.slot < b.slot end)

-- Build the Recipes table after all linked machines are known.
Recipes = nil
if DEBUG then
    system.print("Attempting dynamic recipe discovery from all linked honeycomb machines...")
end
local discoveredRecipes = DiscoverRecipes(Industry)
if discoveredRecipes and #discoveredRecipes > 0 then
    local discoveredAdditions
    Recipes, discoveredAdditions = BuildRuntimeRecipeCatalog(discoveredRecipes)
    if discoveredAdditions > 0 then
        system.print("Dynamic discovery: found " .. discoveredAdditions .. " additional honeycomb families via schematics")
    else
        system.print("Dynamic discovery found " .. #discoveredRecipes .. " schematic-backed families, keeping fallback catalog active")
    end
else
    system.print("Using hardcoded recipe database (dynamic discovery unavailable)")
    Recipes = DefaultRecipes
end

-- Output machine counts per tier and update TiersEnabled
system.print("--- Honeycomb Machine Tier Summary ---")
for tier = 1, 5 do
    if tierCounts[tier] > 0 then
        system.print("Tier "..tier.." machines: "..tierCounts[tier])
    end
end
-- Disable tiers that cannot be produced by any connected machine
-- A machine of tier N can produce honeycombs up to tier N.
for tier = 1, 5 do
    local canProduceTier = false
    for machineTier = tier, 5 do
        if tierCounts[machineTier] > 0 then
            canProduceTier = true
            break
        end
    end
    if not canProduceTier then
        TiersEnabled[tier] = false
        system.print("Tier "..tier.." honeycombs disabled (no compatible machines)")
    end
end
system.print("---------------------------------------")

hrs = 0
min = 0
sec = 0

local dbKeys = {a, b, c, d, e, f, g, h}
for _, key in ipairs(dbKeys) do
    if databank.getIntValue(key) == nil then
        databank.setIntValue(key, 0)
    end
end

-- Persisted tier filter setup
TIER_FILTER_KEY = "hc:tierFilter"
selectedTiers = {}
-- Build default: all enabled tiers
local defaultTiers = {}
for tier = 1, 5 do
    if TiersEnabled[tier] then
        table.insert(defaultTiers, tostring(tier))
    end
end
local tierStr = table.concat(defaultTiers, ",")
if databank then
    local saved = databank.getStringValue(TIER_FILTER_KEY)
    if saved and saved ~= "" then
        -- Validate saved tiers against currently enabled tiers
        local validTiers = {}
        for tier in string.gmatch(saved, "%d+") do
            local t = tonumber(tier)
            if TiersEnabled[t] then
                table.insert(validTiers, tier)
            end
        end
        if #validTiers > 0 then
            tierStr = table.concat(validTiers, ",")
        end
    end
    databank.setStringValue(TIER_FILTER_KEY, tierStr)
end
-- Parse and apply tier filter
for tier = 1, 5 do
    selectedTiers[tier] = false
end
for tier in string.gmatch(tierStr, "%d+") do
    local t = tonumber(tier)
    if t and TiersEnabled[t] then
        selectedTiers[t] = true
    end
end

-- Persisted category setup
CAT_DB_KEY = "hc:lastCategory"
TIER_GROUP_DB_KEY = "hc:lastTierGroup"
if databank then
    local v = databank.getStringValue(CAT_DB_KEY)
    if v == "Pure" or v == "Product" then
        lastCategory = v
    end

    local savedTierGroup = databank.getStringValue(TIER_GROUP_DB_KEY)
    if savedTierGroup == "Common" or savedTierGroup == "Rare" then
        lastTierGroup = savedTierGroup
    end
end
if not lastCategory or lastCategory == "" then
    lastCategory = "Pure"
end

if lastTierGroup ~= "Rare" then
    lastTierGroup = "Common"
end

if lastTierGroup == "Common" and not (TiersEnabled[1] or TiersEnabled[2] or TiersEnabled[3]) then
    if TiersEnabled[4] or TiersEnabled[5] then
        lastTierGroup = "Rare"
    end
elseif lastTierGroup == "Rare" and not (TiersEnabled[4] or TiersEnabled[5]) then
    lastTierGroup = "Common"
end

if databank then
    databank.setStringValue(CAT_DB_KEY, lastCategory)
    databank.setStringValue(TIER_GROUP_DB_KEY, lastTierGroup)
end

defaultRecipeList = lastCategory
defaultTierGroup = lastTierGroup

ScrContent = ScreenContentHC
if lastCategory == "Product" then
    ScrContent = ScreenContentHC2
end

function GetLineSelectionLabel(lineNum)
    if lineNum and lineNum > 0 then
        return "Line "..lineNum
    end
    return "All"
end

function GetLineDisplayName(lineNum)
    if not lineNum or lineNum <= 0 or not Industry[lineNum] then
        return "All connected lines"
    end

    local element = Industry[lineNum].element
    local elementName = element and element.getName and element.getName() or ""
    if elementName and elementName ~= "" then
        return elementName
    end

    local machineItem = element and element.getItemId and system.getItem(element.getItemId()) or nil
    if machineItem then
        if machineItem.locDisplayName and machineItem.locDisplayName ~= "" then
            return machineItem.locDisplayName
        end
        if machineItem.displayName and machineItem.displayName ~= "" then
            return machineItem.displayName
        end
    end

    return "Honeycomb Line "..lineNum
end

function BuildRenderHeader(recipeList, lineNum, tierGroup)
    local category = recipeList or "Pure"
    local activeTierGroup = tierGroup == "Rare" and "Rare" or "Common"
    local recipes = GetFilteredRecipesByCategory(category, activeTierGroup)
    local defaultSelectedLine = GetLineSelectionLabel(lineNum)

    -- Build tier data for recipes
    local tierData = "local RecipeTiers = {"
    for _, recipe in ipairs(recipes) do
        tierData = tierData .. string.format('["%s"]=%d,', recipe.name, recipe.tier)
    end
    tierData = tierData .. "}\n"

    -- Build tier filter state
    local tierFilterData = "local TierFilter = {"
    for tier = 1, 5 do
        tierFilterData = tierFilterData .. string.format("[%d]=%s,", tier, selectedTiers[tier] and "true" or "false")
    end
    tierFilterData = tierFilterData .. "}\n"

    -- Build tiers enabled state
    local tiersEnabledData = "local TiersEnabled = {"
    for tier = 1, 5 do
        tiersEnabledData = tiersEnabledData .. string.format("[%d]=%s,", tier, TiersEnabled[tier] and "true" or "false")
    end
    tiersEnabledData = tiersEnabledData .. "}\n"

    local lineMetaData = "local LineMeta = {\n"
    lineMetaData = lineMetaData .. string.format("    [0] = {buttonLabel=%q, footerLabel=%q},\n", "All", "All connected lines")
    for i = 1, #Industry do
        local machineTier = Industry[i].tier or 1
        local buttonLabel = string.format("L%d T%d", i, machineTier)
        local footerLabel = string.format("Line %d: %s", i, GetLineDisplayName(i))
        lineMetaData = lineMetaData .. string.format(
            "    [%d] = {buttonLabel=%q, footerLabel=%q},\n",
            i,
            buttonLabel,
            footerLabel
        )
    end
    lineMetaData = lineMetaData .. "}\n"

    return string.format([[
    -- injected defaults
    defaultRecipeList = %q
    defaultTierGroup = %q
    defaultSelectedLine = %q
    local version = %q
    %s%s%s%s    local color2 = {r=%s/255,g=%s/255,b=%s/255}
    local color1 = {r=%s/255,g=%s/255,b=%s/255}
    local color3 = {r=%s/255,g=%s/255,b=%s/255}
    local color4 = {r=%s/255,g=%s/255,b=%s/255}
    local color5 = {r=%s/255,g=%s/255,b=%s/255}
    local color6 = {r=%s/255,g=%s/255,b=%s/255}
    local color7 = {r=%s/255,g=%s/255,b=%s/255}
    local color8 = {r=%s/255,g=%s/255,b=%s/255}
    local color9 = {r=%s/255,g=%s/255,b=%s/255}
    ]],
        category,
        activeTierGroup,
        defaultSelectedLine,
        VERSION,
        tierData,
        tierFilterData,
        tiersEnabledData,
        lineMetaData,
        Split(FontColor, ",")[1], Split(FontColor, ",")[2], Split(FontColor, ",")[3],
        Split(MainColor, ",")[1], Split(MainColor, ",")[2], Split(MainColor, ",")[3],
        Split(CraftColor, ",")[1], Split(CraftColor, ",")[2], Split(CraftColor, ",")[3],
        Split(Color3, ",")[1], Split(Color3, ",")[2], Split(Color3, ",")[3],
        Split(ButtonSelectColor, ",")[1], Split(ButtonSelectColor, ",")[2], Split(ButtonSelectColor, ",")[3],
        Split(CraftColorSelect, ",")[1], Split(CraftColorSelect, ",")[2], Split(CraftColorSelect, ",")[3],
        Split(StopColor, ",")[1], Split(StopColor, ",")[2], Split(StopColor, ",")[3],
        Split(StopColorSelect, ",")[1], Split(StopColorSelect, ",")[2], Split(StopColorSelect, ",")[3],
        Split(BackgroundColor, ",")[1], Split(BackgroundColor, ",")[2], Split(BackgroundColor, ",")[3]
    )
end

function BuildListDefinitions(category, lineNum, tierGroup)
    local recipes = GetFilteredRecipesForLine(category, lineNum, tierGroup)
    local result = "local CategoryRecipes = {\n"
    for _, recipe in ipairs(recipes) do
        result = result .. string.format("    {name=%q, id=%d, tier=%d},\n", recipe.name, recipe.id, recipe.tier)
    end
    result = result .. "}\n"

    -- Pre-compute all recipe lists using system.getItem (main Lua context)
    result = result .. "local RecipeLists = {\n"
    for _, recipe in ipairs(recipes) do
        local items = {}
        if recipe.outputs and #recipe.outputs > 0 then
            for _, output in ipairs(recipe.outputs) do
                items[#items + 1] = {output.name, output.id}
            end
        else
            local t = system.getItem(recipe.id)
            for _, childId in pairs(t and t.childIds or {}) do
                local item = system.getItem(childId)
                if item then
                    table.insert(items, {item.locDisplayName, item.id})
                end
            end
        end
        table.sort(items, function(a,b) return a[1] < b[1] end)

        -- Inject the computed list into render script
        result = result .. string.format("    [%q] = {\n", recipe.name)
        for _, item in ipairs(items) do
            result = result .. string.format("        {%q, %d},\n", item[1], item[2])
        end
        result = result .. "    },\n"
    end
    result = result .. "}\n"

    return result
end

function BuildRenderScript(category, lineNum, tierGroup)
    return BuildRenderHeader(category, lineNum, tierGroup)..BuildListDefinitions(category, lineNum, tierGroup)
end

function BuildEditableRenderScript(initialDocumentText)
    local prefix = ""
    if type(initialDocumentText) == "string" and initialDocumentText ~= "" then
        prefix = string.format("SCREEN_LAYOUT_EDITOR_INITIAL_DOCUMENT = %q\n", initialDocumentText)
    end
    return prefix .. SCREEN_LAYOUT_EDITOR_SOURCE
end

renderHeader = BuildRenderHeader(lastCategory, 0, lastTierGroup)

if not Screen then
    system.print("ERROR: No Screen linked!")
    unit.exit()
    return
end

SCREEN_LAYOUT_EDITOR_SOURCE = SCREEN_LAYOUT_EDITOR_SOURCE or [====[
---@diagnostic disable: undefined-global
-- luacheck: globals
--   loadFont getAvailableFontCount getAvailableFontName getTextBounds
--   setNextFillColor setNextStrokeColor setNextStrokeWidth addBox addBoxRounded addText
--   getResolution createLayer getCursor getCursorPressed getCursorDown getCursorReleased
--   setBackgroundColor setOutput requestAnimationFrame
--   SCREEN_LAYOUT_EDITOR_INITIAL_DOCUMENT SCREEN_LAYOUT_EDITOR_STATE

local ScreenLayoutEditor = {}

ScreenLayoutEditor.SCHEMA_VERSION = 1
ScreenLayoutEditor.OUTPUT_KIND = "screen_layout_editor_doc"
ScreenLayoutEditor.PERSISTENCE_DB_KEY = "screen_layout_editor:document"
ScreenLayoutEditor.DEFAULT_MAX_SCREEN_CODE_CHARS = 50000
ScreenLayoutEditor.DEFAULT_MARGIN = 8

local UINT32_MOD = 4294967296

local function clamp(value, minimum, maximum)
    if value < minimum then
        return minimum
    end
    if value > maximum then
        return maximum
    end
    return value
end

local function append(parts, value)
    parts[#parts + 1] = value
end

local function isNumber(value)
    return type(value) == "number" and value == value and value ~= math.huge and value ~= -math.huge
end

local function numberOrNil(value)
    local numeric = tonumber(value)
    if isNumber(numeric) then
        return numeric
    end
    return nil
end

local function serializeNumber(value)
    local numeric = numberOrNil(value) or 0
    if math.floor(numeric) == numeric then
        return tostring(numeric)
    end
    local text = string.format("%.6f", numeric)
    text = text:gsub("0+$", ""):gsub("%.$", "")
    if text == "-0" then
        return "0"
    end
    return text
end

local function serializeString(value)
    return string.format("%q", tostring(value or ""))
end

local function splitTextLines(text)
    if type(text) ~= "string" or text == "" then
        return nil
    end
    local normalized = text:gsub("\r\n", "\n")
    local lines = {}
    local startIndex = 1
    while true do
        local newlineIndex = normalized:find("\n", startIndex, true)
        if not newlineIndex then
            lines[#lines + 1] = normalized:sub(startIndex)
            break
        end
        lines[#lines + 1] = normalized:sub(startIndex, newlineIndex - 1)
        startIndex = newlineIndex + 1
    end
    return lines
end

local function cloneStringArray(lines)
    if type(lines) ~= "table" then
        return nil
    end
    local copy = {}
    for index = 1, #lines do
        copy[#copy + 1] = tostring(lines[index] or "")
    end
    if #copy <= 0 then
        return nil
    end
    return copy
end

local function cloneColor(value, fallback)
    local source = type(value) == "table" and value or fallback
    if type(source) ~= "table" then
        return nil
    end
    return {
        numberOrNil(source[1]) or 0,
        numberOrNil(source[2]) or 0,
        numberOrNil(source[3]) or 0,
        numberOrNil(source[4]) or 1
    }
end

local function serializeColor(color)
    if type(color) ~= "table" then
        return nil
    end
    return string.format(
        "{%s,%s,%s,%s}",
        serializeNumber(color[1]),
        serializeNumber(color[2]),
        serializeNumber(color[3]),
        serializeNumber(color[4])
    )
end

local function serializeStringArray(lines)
    if type(lines) ~= "table" or #lines <= 0 then
        return nil
    end
    local parts = { "{" }
    for index = 1, #lines do
        if index > 1 then
            append(parts, ",")
        end
        append(parts, serializeString(lines[index]))
    end
    append(parts, "}")
    return table.concat(parts)
end

function ScreenLayoutEditor.computeMetrics(screenWidth, screenHeight)
    return {
        screenWidth = screenWidth,
        screenHeight = screenHeight,
        margin = ScreenLayoutEditor.DEFAULT_MARGIN,
        handleSize = math.max(12, math.floor(screenHeight / 48)),
        minWidth = math.max(42, math.floor(screenWidth / 36)),
        minHeight = math.max(28, math.floor(screenHeight / 42)),
        selectionPadding = math.max(8, math.floor(screenWidth / 200))
    }
end

function ScreenLayoutEditor.createDefaultDocument(screenWidth, screenHeight)
    local sx = screenWidth / 1920
    local sy = screenHeight / 1080
    local function px(value)
        return math.floor(value * sx + 0.5)
    end
    local function py(value)
        return math.floor(value * sy + 0.5)
    end

    return {
        version = ScreenLayoutEditor.SCHEMA_VERSION,
        revision = 0,
        selectedId = "main_canvas",
        elements = {
            {
                id = "frame",
                type = "boxRounded",
                x = px(32), y = py(36), w = px(1848), h = py(1006), radius = px(22),
                fill = { 0.10, 0.11, 0.12, 0.98 },
                stroke = { 0.97, 0.97, 0.98, 1.00 },
                strokeWidth = px(4),
                movable = false,
                resizable = false
            },
            {
                id = "title_badge",
                type = "boxRounded",
                x = px(64), y = py(48), w = px(280), h = py(98), radius = px(18),
                fill = { 0.16, 0.16, 0.16, 0.96 },
                stroke = { 0.98, 0.98, 0.99, 1.00 },
                strokeWidth = px(4),
                textLines = { "Honeycomb Control" },
                textColor = { 1.00, 0.73, 0.24, 1.00 },
                textSize = px(32),
                textAlign = "center",
                movable = true,
                resizable = true
            },
            {
                id = "purity_panel",
                type = "boxRounded",
                x = px(78), y = py(168), w = px(160), h = py(162), radius = px(18),
                fill = { 0.23, 0.16, 0.05, 0.96 },
                stroke = { 0.98, 0.86, 0.45, 1.00 },
                strokeWidth = px(3),
                textLines = { "Pure", "Product", "74t/s" },
                textColor = { 1.00, 0.91, 0.56, 1.00 },
                textSize = px(26),
                textAlign = "center",
                movable = true,
                resizable = true
            },
            {
                id = "materials_strip",
                type = "boxRounded",
                x = px(390), y = py(48), w = px(1410), h = py(136), radius = px(18),
                fill = { 0.19, 0.20, 0.22, 0.96 },
                stroke = { 0.96, 0.96, 0.98, 1.00 },
                strokeWidth = px(4),
                movable = true,
                resizable = true
            },
            {
                id = "tier_all",
                type = "boxRounded",
                x = px(440), y = py(58), w = px(86), h = py(40), radius = px(18),
                fill = { 0.98, 0.78, 0.13, 0.98 },
                stroke = { 0.90, 0.63, 0.05, 1.00 },
                strokeWidth = px(2),
                textLines = { "All" },
                textColor = { 0.22, 0.15, 0.02, 1.00 },
                textSize = px(22),
                textAlign = "center",
                movable = true,
                resizable = true
            },
            {
                id = "tier_l1",
                type = "boxRounded",
                x = px(544), y = py(58), w = px(106), h = py(40), radius = px(18),
                fill = { 0.95, 0.66, 0.16, 0.98 },
                stroke = { 0.90, 0.54, 0.04, 1.00 },
                strokeWidth = px(2),
                textLines = { "L1 T1" },
                textColor = { 0.24, 0.12, 0.02, 1.00 },
                textSize = px(20),
                textAlign = "center",
                movable = true,
                resizable = true
            },
            {
                id = "tier_l2",
                type = "boxRounded",
                x = px(668), y = py(58), w = px(106), h = py(40), radius = px(18),
                fill = { 0.95, 0.66, 0.16, 0.98 },
                stroke = { 0.90, 0.54, 0.04, 1.00 },
                strokeWidth = px(2),
                textLines = { "L2 T2" },
                textColor = { 0.24, 0.12, 0.02, 1.00 },
                textSize = px(20),
                textAlign = "center",
                movable = true,
                resizable = true
            },
            {
                id = "tier_l3",
                type = "boxRounded",
                x = px(792), y = py(58), w = px(106), h = py(40), radius = px(18),
                fill = { 0.95, 0.66, 0.16, 0.98 },
                stroke = { 0.90, 0.54, 0.04, 1.00 },
                strokeWidth = px(2),
                textLines = { "L3 T3" },
                textColor = { 0.24, 0.12, 0.02, 1.00 },
                textSize = px(20),
                textAlign = "center",
                movable = true,
                resizable = true
            },
            {
                id = "tier_l4",
                type = "boxRounded",
                x = px(916), y = py(58), w = px(106), h = py(40), radius = px(18),
                fill = { 0.95, 0.66, 0.16, 0.98 },
                stroke = { 0.90, 0.54, 0.04, 1.00 },
                strokeWidth = px(2),
                textLines = { "L4 T4" },
                textColor = { 0.24, 0.12, 0.02, 1.00 },
                textSize = px(20),
                textAlign = "center",
                movable = true,
                resizable = true
            },
            {
                id = "materials_band",
                type = "boxRounded",
                x = px(440), y = py(108), w = px(1320), h = py(70), radius = px(14),
                fill = { 0.15, 0.21, 0.31, 0.96 },
                stroke = { 0.70, 0.91, 1.00, 1.00 },
                strokeWidth = px(2),
                textLines = { "Aluminum   Carbon   Iron   Silicon   Calcium   Chromium   Copper   Sodium" },
                textColor = { 0.78, 0.95, 1.00, 1.00 },
                textSize = px(20),
                textAlign = "center",
                movable = true,
                resizable = true
            },
            {
                id = "preview_panel",
                type = "boxRounded",
                x = px(78), y = py(214), w = px(228), h = py(266), radius = px(18),
                fill = { 0.14, 0.14, 0.15, 0.98 },
                stroke = { 0.97, 0.97, 0.98, 1.00 },
                strokeWidth = px(4),
                movable = true,
                resizable = true
            },
            {
                id = "status_badge",
                type = "boxRounded",
                x = px(92), y = py(526), w = px(168), h = py(62), radius = px(28),
                fill = { 0.78, 0.06, 0.10, 0.96 },
                stroke = { 0.99, 0.99, 0.99, 1.00 },
                strokeWidth = px(2),
                textLines = { "Stopped" },
                textColor = { 1.00, 0.68, 0.26, 1.00 },
                textSize = px(28),
                textAlign = "center",
                movable = true,
                resizable = true
            },
            {
                id = "actions_panel",
                type = "boxRounded",
                x = px(64), y = py(608), w = px(268), h = py(344), radius = px(18),
                fill = { 0.18, 0.18, 0.18, 0.98 },
                stroke = { 0.97, 0.97, 0.98, 1.00 },
                strokeWidth = px(4),
                textLines = { "M0", "Maintain x100" },
                textColor = { 1.00, 0.72, 0.24, 1.00 },
                textSize = px(28),
                textAlign = "center",
                movable = true,
                resizable = true
            },
            {
                id = "button_maintain",
                type = "boxRounded",
                x = px(96), y = py(734), w = px(204), h = py(58), radius = px(22),
                fill = { 0.18, 0.74, 0.96, 0.98 },
                stroke = { 0.86, 0.97, 1.00, 1.00 },
                strokeWidth = px(2),
                textLines = { "Maintain 1" },
                textColor = { 0.07, 0.22, 0.31, 1.00 },
                textSize = px(22),
                textAlign = "center",
                movable = true,
                resizable = true
            },
            {
                id = "button_craft",
                type = "boxRounded",
                x = px(96), y = py(806), w = px(204), h = py(58), radius = px(22),
                fill = { 0.18, 0.74, 0.96, 0.98 },
                stroke = { 0.86, 0.97, 1.00, 1.00 },
                strokeWidth = px(2),
                textLines = { "Craft 1" },
                textColor = { 0.07, 0.22, 0.31, 1.00 },
                textSize = px(22),
                textAlign = "center",
                movable = true,
                resizable = true
            },
            {
                id = "button_stop",
                type = "boxRounded",
                x = px(96), y = py(878), w = px(204), h = py(58), radius = px(22),
                fill = { 0.95, 0.48, 0.18, 0.98 },
                stroke = { 1.00, 0.87, 0.63, 1.00 },
                strokeWidth = px(2),
                textLines = { "Stop" },
                textColor = { 0.33, 0.12, 0.02, 1.00 },
                textSize = px(24),
                textAlign = "center",
                movable = true,
                resizable = true
            },
            {
                id = "main_canvas",
                type = "boxRounded",
                x = px(370), y = py(198), w = px(1410), h = py(768), radius = px(20),
                fill = { 0.15, 0.15, 0.15, 0.98 },
                stroke = { 0.97, 0.97, 0.98, 1.00 },
                strokeWidth = px(4),
                textLines = { "No schematic required", "Nothing selected" },
                textColor = { 0.98, 0.66, 0.19, 1.00 },
                textSize = px(24),
                textAlign = "center",
                movable = true,
                resizable = true
            },
            {
                id = "footer_status",
                type = "boxRounded",
                x = px(1060), y = py(988), w = px(86), h = py(34), radius = px(14),
                fill = { 0.12, 0.80, 0.96, 0.98 },
                stroke = { 0.88, 0.98, 1.00, 1.00 },
                strokeWidth = px(2),
                movable = true,
                resizable = true
            }
        }
    }
end

local function normalizeElement(rawElement, index)
    if type(rawElement) ~= "table" then
        return nil
    end

    local x = numberOrNil(rawElement.x)
    local y = numberOrNil(rawElement.y)
    local w = numberOrNil(rawElement.w)
    local h = numberOrNil(rawElement.h)
    if not x or not y or not w or not h then
        return nil
    end

    local textLines = cloneStringArray(rawElement.textLines)
    if not textLines and type(rawElement.text) == "string" then
        textLines = splitTextLines(rawElement.text)
    end

    local elementType = tostring(rawElement.type or rawElement.kind or "boxRounded")
    if elementType == "rect" then
        elementType = "boxRounded"
    end

    local element = {
        id = tostring(rawElement.id or ("element_" .. tostring(index))),
        type = elementType,
        x = x,
        y = y,
        w = w,
        h = h
    }

    local radius = numberOrNil(rawElement.radius or rawElement.r)
    if radius then
        element.radius = radius
    end

    local strokeWidth = numberOrNil(rawElement.strokeWidth or rawElement.sw)
    if strokeWidth then
        element.strokeWidth = strokeWidth
    end

    local textSize = numberOrNil(rawElement.textSize or rawElement.ts)
    if textSize then
        element.textSize = textSize
    end

    local lineGap = numberOrNil(rawElement.lineGap)
    if lineGap then
        element.lineGap = lineGap
    end

    element.fill = cloneColor(rawElement.fill, { 0.2, 0.2, 0.2, 1.0 })
    element.stroke = cloneColor(rawElement.stroke, { 1.0, 1.0, 1.0, 1.0 })
    element.textColor = cloneColor(rawElement.textColor or rawElement.tc, { 1.0, 1.0, 1.0, 1.0 })

    if textLines then
        element.textLines = textLines
    end

    if type(rawElement.textAlign) == "string" and rawElement.textAlign ~= "" then
        element.textAlign = rawElement.textAlign
    elseif textLines then
        element.textAlign = "center"
    end

    if rawElement.movable ~= nil then
        element.movable = not not rawElement.movable
    end

    if rawElement.resizable ~= nil then
        element.resizable = not not rawElement.resizable
    end

    return element
end

function ScreenLayoutEditor.normalizeDocument(rawDocument, screenWidth, screenHeight)
    local fallback = ScreenLayoutEditor.createDefaultDocument(screenWidth or 1920, screenHeight or 1080)
    if type(rawDocument) ~= "table" then
        return fallback
    end

    local elements = {}
    if type(rawDocument.elements) == "table" then
        for index = 1, #rawDocument.elements do
            local normalized = normalizeElement(rawDocument.elements[index], index)
            if normalized then
                elements[#elements + 1] = normalized
            end
        end
    end

    if #elements <= 0 then
        return fallback
    end

    local selectedId = nil
    if type(rawDocument.selectedId) == "string" and rawDocument.selectedId ~= "" then
        for index = 1, #elements do
            if elements[index].id == rawDocument.selectedId then
                selectedId = rawDocument.selectedId
                break
            end
        end
    end

    return {
        version = ScreenLayoutEditor.SCHEMA_VERSION,
        revision = math.max(0, math.floor(numberOrNil(rawDocument.revision) or 0)),
        selectedId = selectedId,
        elements = elements
    }
end

local function serializeElement(element)
    local parts = { "{" }
    append(parts, "id=")
    append(parts, serializeString(element.id))
    append(parts, ",type=")
    append(parts, serializeString(element.type))
    append(parts, ",x=")
    append(parts, serializeNumber(element.x))
    append(parts, ",y=")
    append(parts, serializeNumber(element.y))
    append(parts, ",w=")
    append(parts, serializeNumber(element.w))
    append(parts, ",h=")
    append(parts, serializeNumber(element.h))

    if isNumber(element.radius) then
        append(parts, ",radius=")
        append(parts, serializeNumber(element.radius))
    end

    local fill = serializeColor(element.fill)
    if fill then
        append(parts, ",fill=")
        append(parts, fill)
    end

    local stroke = serializeColor(element.stroke)
    if stroke then
        append(parts, ",stroke=")
        append(parts, stroke)
    end

    if isNumber(element.strokeWidth) then
        append(parts, ",strokeWidth=")
        append(parts, serializeNumber(element.strokeWidth))
    end

    local textLines = serializeStringArray(element.textLines)
    if textLines then
        append(parts, ",textLines=")
        append(parts, textLines)
    end

    local textColor = serializeColor(element.textColor)
    if textColor then
        append(parts, ",textColor=")
        append(parts, textColor)
    end

    if isNumber(element.textSize) then
        append(parts, ",textSize=")
        append(parts, serializeNumber(element.textSize))
    end

    if type(element.textAlign) == "string" and element.textAlign ~= "" then
        append(parts, ",textAlign=")
        append(parts, serializeString(element.textAlign))
    end

    if isNumber(element.lineGap) then
        append(parts, ",lineGap=")
        append(parts, serializeNumber(element.lineGap))
    end

    if element.movable ~= nil then
        append(parts, ",movable=")
        append(parts, tostring(not not element.movable))
    end

    if element.resizable ~= nil then
        append(parts, ",resizable=")
        append(parts, tostring(not not element.resizable))
    end

    append(parts, "}")
    return table.concat(parts)
end

function ScreenLayoutEditor.serializeDocument(document)
    local normalized = ScreenLayoutEditor.normalizeDocument(document)
    local parts = {
        "{version=",
        tostring(normalized.version),
        ",revision=",
        tostring(normalized.revision)
    }

    if normalized.selectedId then
        append(parts, ",selectedId=")
        append(parts, serializeString(normalized.selectedId))
    end

    append(parts, ",elements={")
    for index = 1, #normalized.elements do
        if index > 1 then
            append(parts, ",")
        end
        append(parts, serializeElement(normalized.elements[index]))
    end
    append(parts, "}}")
    return table.concat(parts)
end

function ScreenLayoutEditor.hashText(text)
    local value = tostring(text or "")
    local hash = 5381
    for index = 1, #value do
        hash = ((hash * 33) + string.byte(value, index)) % UINT32_MOD
    end
    return hash
end

local function parseLuaTable(text, chunkName)
    if type(text) ~= "string" or text == "" then
        return nil, "empty"
    end
    local loader, loadError = load("return " .. text, chunkName or "screen_layout_editor", "t", {})
    if not loader then
        return nil, loadError
    end
    local ok, value = pcall(loader)
    if not ok then
        return nil, value
    end
    if type(value) ~= "table" then
        return nil, "not_table"
    end
    return value, nil
end

function ScreenLayoutEditor.deserializeDocument(text, screenWidth, screenHeight)
    local rawDocument, parseError = parseLuaTable(text, "screen_layout_editor_document")
    if not rawDocument then
        return nil, parseError
    end
    return ScreenLayoutEditor.normalizeDocument(rawDocument, screenWidth, screenHeight), nil
end

function ScreenLayoutEditor.serializeOutputEnvelope(document, serializedDocument, hash)
    local normalized = ScreenLayoutEditor.normalizeDocument(document)
    local docText = serializedDocument or ScreenLayoutEditor.serializeDocument(normalized)
    local docHash = hash or ScreenLayoutEditor.hashText(docText)
    return string.format(
        "{kind=%s,version=%d,revision=%d,hash=%s,document=%s}",
        serializeString(ScreenLayoutEditor.OUTPUT_KIND),
        ScreenLayoutEditor.SCHEMA_VERSION,
        normalized.revision or 0,
        serializeNumber(docHash),
        docText
    )
end

function ScreenLayoutEditor.parseOutputEnvelope(text, screenWidth, screenHeight)
    local envelope, parseError = parseLuaTable(text, "screen_layout_editor_output")
    if not envelope then
        return nil, parseError
    end
    if envelope.kind ~= ScreenLayoutEditor.OUTPUT_KIND then
        return nil, "wrong_kind"
    end
    local document = ScreenLayoutEditor.normalizeDocument(envelope.document, screenWidth, screenHeight)
    document.revision = math.max(0, math.floor(numberOrNil(envelope.revision) or document.revision or 0))
    local serialized = ScreenLayoutEditor.serializeDocument(document)
    local computedHash = ScreenLayoutEditor.hashText(serialized)
    local expectedHash = numberOrNil(envelope.hash)
    if expectedHash and computedHash ~= expectedHash then
        return nil, "hash_mismatch"
    end
    return {
        kind = ScreenLayoutEditor.OUTPUT_KIND,
        version = ScreenLayoutEditor.SCHEMA_VERSION,
        revision = document.revision,
        hash = computedHash,
        serializedDocument = serialized,
        document = document
    }, nil
end

function ScreenLayoutEditor.readPersistedEnvelope(text, screenWidth, screenHeight)
    local envelope, parseError = ScreenLayoutEditor.parseOutputEnvelope(text, screenWidth, screenHeight)
    if not envelope then
        return nil, parseError
    end
    return {
        kind = ScreenLayoutEditor.OUTPUT_KIND,
        version = ScreenLayoutEditor.SCHEMA_VERSION,
        revision = envelope.revision,
        hash = envelope.hash,
        serializedDocument = envelope.serializedDocument,
        document = envelope.document,
        text = ScreenLayoutEditor.serializeOutputEnvelope(envelope.document, envelope.serializedDocument, envelope.hash)
    }, nil
end

function ScreenLayoutEditor.resolveMaxScreenCodeChars(value)
    local numeric = math.floor(numberOrNil(value) or ScreenLayoutEditor.DEFAULT_MAX_SCREEN_CODE_CHARS)
    if numeric <= 0 then
        return ScreenLayoutEditor.DEFAULT_MAX_SCREEN_CODE_CHARS
    end
    return numeric
end

function ScreenLayoutEditor.buildPersistenceRecord(document, maxScreenCodeChars)
    local normalized = ScreenLayoutEditor.normalizeDocument(document)
    local serialized = ScreenLayoutEditor.serializeDocument(normalized)
    local hash = ScreenLayoutEditor.hashText(serialized)
    local text = ScreenLayoutEditor.serializeOutputEnvelope(normalized, serialized, hash)
    local maxLength = ScreenLayoutEditor.resolveMaxScreenCodeChars(maxScreenCodeChars)
    return {
        key = ScreenLayoutEditor.PERSISTENCE_DB_KEY,
        version = ScreenLayoutEditor.SCHEMA_VERSION,
        revision = normalized.revision or 0,
        hash = hash,
        serializedDocument = serialized,
        text = text,
        length = #text,
        maxLength = maxLength,
        fits = #text <= maxLength
    }
end

function ScreenLayoutEditor.buildPersistenceRecordFromOutput(text, maxScreenCodeChars, screenWidth, screenHeight)
    local envelope, parseError = ScreenLayoutEditor.readPersistedEnvelope(text, screenWidth, screenHeight)
    if not envelope then
        return nil, parseError
    end
    local record = ScreenLayoutEditor.buildPersistenceRecord(envelope.document, maxScreenCodeChars)
    if record.revision ~= envelope.revision or record.hash ~= envelope.hash then
        return nil, "output_mismatch"
    end
    return record, nil
end

function ScreenLayoutEditor.canPersistDocument(document, maxScreenCodeChars)
    local record = ScreenLayoutEditor.buildPersistenceRecord(document, maxScreenCodeChars)
    return record.fits, record
end

function ScreenLayoutEditor.restorePersistedDocument(text, screenWidth, screenHeight)
    local envelope, parseError = ScreenLayoutEditor.parseOutputEnvelope(text, screenWidth, screenHeight)
    if not envelope then
        return nil, parseError
    end
    return envelope.document, nil
end

function ScreenLayoutEditor.findElement(document, elementId)
    if type(document) ~= "table" or type(document.elements) ~= "table" or type(elementId) ~= "string" then
        return nil, nil
    end
    for index = 1, #document.elements do
        local element = document.elements[index]
        if element.id == elementId then
            return element, index
        end
    end
    return nil, nil
end

local function pointInRect(px, py, x, y, w, h)
    return px >= x and px <= (x + w) and py >= y and py <= (y + h)
end

function ScreenLayoutEditor.getHandleRects(metrics, element)
    local handleSize = metrics.handleSize
    local half = handleSize * 0.5
    return {
        nw = { x = element.x - half, y = element.y - half, w = handleSize, h = handleSize },
        ne = { x = element.x + element.w - half, y = element.y - half, w = handleSize, h = handleSize },
        sw = { x = element.x - half, y = element.y + element.h - half, w = handleSize, h = handleSize },
        se = { x = element.x + element.w - half, y = element.y + element.h - half, w = handleSize, h = handleSize }
    }
end

function ScreenLayoutEditor.hitResizeHandle(metrics, element, cursorX, cursorY)
    local handles = ScreenLayoutEditor.getHandleRects(metrics, element)
    for handleName, rect in pairs(handles) do
        if pointInRect(cursorX, cursorY, rect.x, rect.y, rect.w, rect.h) then
            return handleName
        end
    end
    return nil
end

function ScreenLayoutEditor.pickTopmostElement(document, cursorX, cursorY)
    if type(document) ~= "table" or type(document.elements) ~= "table" then
        return nil
    end
    for index = #document.elements, 1, -1 do
        local element = document.elements[index]
        if pointInRect(cursorX, cursorY, element.x, element.y, element.w, element.h) then
            return element
        end
    end
    return nil
end

local function setRectIfChanged(element, newX, newY, newW, newH)
    local changed = false
    if isNumber(newX) and element.x ~= newX then
        element.x = newX
        changed = true
    end
    if isNumber(newY) and element.y ~= newY then
        element.y = newY
        changed = true
    end
    if isNumber(newW) and element.w ~= newW then
        element.w = newW
        changed = true
    end
    if isNumber(newH) and element.h ~= newH then
        element.h = newH
        changed = true
    end
    return changed
end

local function beginDrag(state, element, cursorX, cursorY)
    state.document.selectedId = element.id
    state.operation = {
        kind = "drag",
        elementId = element.id,
        offsetX = cursorX - element.x,
        offsetY = cursorY - element.y
    }
end

local function beginResize(state, element, handleName)
    state.document.selectedId = element.id
    state.operation = {
        kind = "resize",
        elementId = element.id,
        handle = handleName,
        startX = element.x,
        startY = element.y,
        startW = element.w,
        startH = element.h
    }
end

local function updateDrag(state, element, cursorX, cursorY)
    local op = state.operation
    local metrics = state.metrics
    local newX = clamp(cursorX - op.offsetX, metrics.margin, metrics.screenWidth - element.w - metrics.margin)
    local newY = clamp(cursorY - op.offsetY, metrics.margin, metrics.screenHeight - element.h - metrics.margin)
    return setRectIfChanged(element, newX, newY, nil, nil)
end

local function updateResize(state, element, cursorX, cursorY)
    local op = state.operation
    local metrics = state.metrics
    local minWidth = metrics.minWidth
    local minHeight = metrics.minHeight
    local maxRight = metrics.screenWidth - metrics.margin
    local maxBottom = metrics.screenHeight - metrics.margin

    if op.handle == "se" then
        local newW = clamp(cursorX - op.startX, minWidth, maxRight - op.startX)
        local newH = clamp(cursorY - op.startY, minHeight, maxBottom - op.startY)
        return setRectIfChanged(element, nil, nil, newW, newH)
    end

    if op.handle == "sw" then
        local newX = clamp(cursorX, metrics.margin, op.startX + op.startW - minWidth)
        local newW = clamp((op.startX + op.startW) - newX, minWidth, maxRight - newX)
        local newH = clamp(cursorY - op.startY, minHeight, maxBottom - op.startY)
        return setRectIfChanged(element, newX, nil, newW, newH)
    end

    if op.handle == "ne" then
        local newY = clamp(cursorY, metrics.margin, op.startY + op.startH - minHeight)
        local newH = clamp((op.startY + op.startH) - newY, minHeight, maxBottom - newY)
        local newW = clamp(cursorX - op.startX, minWidth, maxRight - op.startX)
        return setRectIfChanged(element, nil, newY, newW, newH)
    end

    if op.handle == "nw" then
        local newX = clamp(cursorX, metrics.margin, op.startX + op.startW - minWidth)
        local newY = clamp(cursorY, metrics.margin, op.startY + op.startH - minHeight)
        local newW = clamp((op.startX + op.startW) - newX, minWidth, maxRight - newX)
        local newH = clamp((op.startY + op.startH) - newY, minHeight, maxBottom - newY)
        return setRectIfChanged(element, newX, newY, newW, newH)
    end

    return false
end

function ScreenLayoutEditor.commitDocument(state)
    if type(state) ~= "table" or type(state.document) ~= "table" then
        return false
    end
    state.document.revision = math.max(0, math.floor(numberOrNil(state.document.revision) or 0)) + 1
    local serialized = ScreenLayoutEditor.serializeDocument(state.document)
    local hash = ScreenLayoutEditor.hashText(serialized)
    state.lastCommittedSerialized = serialized
    state.lastCommittedHash = hash
    state.lastOutputEnvelope = ScreenLayoutEditor.serializeOutputEnvelope(state.document, serialized, hash)
    state.documentDirty = false
    return true
end

function ScreenLayoutEditor.createState(screenWidth, screenHeight, initialDocument)
    local document = nil
    if type(initialDocument) == "string" and initialDocument ~= "" then
        document = ScreenLayoutEditor.deserializeDocument(initialDocument, screenWidth, screenHeight)
    elseif type(initialDocument) == "table" then
        document = ScreenLayoutEditor.normalizeDocument(initialDocument, screenWidth, screenHeight)
    end
    if not document then
        document = ScreenLayoutEditor.createDefaultDocument(screenWidth, screenHeight)
    end

    local serialized = ScreenLayoutEditor.serializeDocument(document)
    return {
        metrics = ScreenLayoutEditor.computeMetrics(screenWidth, screenHeight),
        document = document,
        operation = nil,
        documentDirty = false,
        lastCommittedSerialized = serialized,
        lastCommittedHash = ScreenLayoutEditor.hashText(serialized),
        lastOutputEnvelope = ""
    }
end

function ScreenLayoutEditor.applyPointerFrame(state, pointer)
    local cursorX = numberOrNil(pointer and pointer.cursorX) or -1
    local cursorY = numberOrNil(pointer and pointer.cursorY) or -1
    local hasCursor = cursorX >= 0 and cursorY >= 0
    local pressed = not not (pointer and pointer.pressed)
    local down = not not (pointer and pointer.down)
    local released = not not (pointer and pointer.released)
    local result = {
        selectedChanged = false,
        documentChanged = false,
        committed = false
    }

    local selected = nil
    if state.document.selectedId then
        selected = ScreenLayoutEditor.findElement(state.document, state.document.selectedId)
    end

    if pressed and hasCursor then
        if selected and selected.resizable ~= false then
            local handleName = ScreenLayoutEditor.hitResizeHandle(state.metrics, selected, cursorX, cursorY)
            if handleName then
                beginResize(state, selected, handleName)
                return result
            end
        end

        local hit = ScreenLayoutEditor.pickTopmostElement(state.document, cursorX, cursorY)
        if hit then
            if state.document.selectedId ~= hit.id then
                result.selectedChanged = true
            end
            if hit.movable ~= false then
                beginDrag(state, hit, cursorX, cursorY)
            else
                state.document.selectedId = hit.id
                state.operation = nil
            end
        else
            if state.document.selectedId ~= nil then
                result.selectedChanged = true
            end
            state.document.selectedId = nil
            state.operation = nil
        end
    end

    if down and hasCursor and state.operation then
        local element = ScreenLayoutEditor.findElement(state.document, state.operation.elementId)
        if element then
            local changed = false
            if state.operation.kind == "drag" then
                changed = updateDrag(state, element, cursorX, cursorY)
            elseif state.operation.kind == "resize" then
                changed = updateResize(state, element, cursorX, cursorY)
            end
            if changed then
                state.documentDirty = true
                result.documentChanged = true
            end
        end
    end

    if released then
        state.operation = nil
        if state.documentDirty then
            result.committed = ScreenLayoutEditor.commitDocument(state)
        end
    end

    return result
end

function ScreenLayoutEditor.getOutputEnvelope(state)
    if type(state) ~= "table" then
        return ""
    end
    return state.lastOutputEnvelope or ""
end

local function getFont(size)
    local preferred = { "Play", "Rajdhani", "Orbitron", "Roboto" }
    for index = 1, #preferred do
        local ok, loaded = pcall(loadFont, preferred[index], size)
        if ok and loaded then
            return loaded
        end
    end

    local okCount, count = pcall(getAvailableFontCount)
    if okCount and type(count) == "number" and count > 0 then
        for fontIndex = 0, count - 1 do
            local okName, fontName = pcall(getAvailableFontName, fontIndex)
            if okName and fontName then
                local okLoad, loaded = pcall(loadFont, fontName, size)
                if okLoad and loaded then
                    return loaded
                end
            end
        end
    end

    return nil
end

local function drawRoundedElement(layer, element)
    local fill = element.fill or { 0.2, 0.2, 0.2, 1.0 }
    local stroke = element.stroke or { 1.0, 1.0, 1.0, 1.0 }
    setNextFillColor(layer, fill[1], fill[2], fill[3], fill[4])
    setNextStrokeColor(layer, stroke[1], stroke[2], stroke[3], stroke[4])
    setNextStrokeWidth(layer, element.strokeWidth or 2)
    if element.type == "box" then
        addBox(layer, element.x, element.y, element.w, element.h)
    else
        addBoxRounded(layer, element.x, element.y, element.w, element.h, element.radius or 12)
    end
end

local function drawElementText(layer, element)
    local lines = element.textLines
    if not lines or #lines <= 0 then
        return
    end

    local fontSize = element.textSize or 24
    local font = getFont(fontSize)
    if not font then
        return
    end

    local color = element.textColor or { 1.0, 1.0, 1.0, 1.0 }
    local lineGap = element.lineGap or math.max(4, math.floor(fontSize * 0.15))
    local totalHeight = (#lines * fontSize) + ((#lines - 1) * lineGap)
    local startY = element.y + math.max(10, (element.h - totalHeight) * 0.5)

    for index = 1, #lines do
        local text = tostring(lines[index] or "")
        local textWidth = 0
        local okBounds, width = pcall(getTextBounds, font, text)
        if okBounds and type(width) == "number" then
            textWidth = width
        end
        local textX = element.x + 14
        if element.textAlign == "center" then
            textX = element.x + (element.w - textWidth) * 0.5
        end
        local baselineY = startY + ((index - 1) * (fontSize + lineGap)) + (fontSize * 0.82)
        setNextFillColor(layer, color[1], color[2], color[3], color[4])
        addText(layer, font, text, textX, baselineY)
    end
end

local function drawSelectionOverlay(state, layer, element)
    local pad = state.metrics.selectionPadding
    local border = { 0.14, 0.88, 0.98, 0.95 }
    setNextFillColor(layer, 0.00, 0.00, 0.00, 0.00)
    setNextStrokeColor(layer, border[1], border[2], border[3], border[4])
    setNextStrokeWidth(layer, 3)
    addBoxRounded(
        layer,
        element.x - pad,
        element.y - pad,
        element.w + pad * 2,
        element.h + pad * 2,
        math.max(10, element.radius or 10)
    )

    if element.resizable == false then
        return
    end

    local handles = ScreenLayoutEditor.getHandleRects(state.metrics, element)
    for _, rect in pairs(handles) do
        setNextFillColor(layer, border[1], border[2], border[3], 0.95)
        setNextStrokeColor(layer, 1.0, 1.0, 1.0, 0.95)
        setNextStrokeWidth(layer, 2)
        addBoxRounded(layer, rect.x, rect.y, rect.w, rect.h, 4)
    end
end

local function drawHud(state, layer, screenHeight)
    local font = getFont(math.max(18, math.floor(screenHeight / 42)))
    if not font then
        return
    end

    local selectedText = string.format("Selected: none  rev=%d", state.document.revision or 0)
    if state.document.selectedId then
        local selected = ScreenLayoutEditor.findElement(state.document, state.document.selectedId)
        if selected then
            selectedText = string.format(
                "Selected: %s  x=%d y=%d w=%d h=%d  rev=%d",
                selected.id,
                math.floor(selected.x + 0.5),
                math.floor(selected.y + 0.5),
                math.floor(selected.w + 0.5),
                math.floor(selected.h + 0.5),
                state.document.revision or 0
            )
        end
    end

    local modeText = "Click to select, drag inside to move, drag corner handles to resize"
    setNextFillColor(layer, 1.0, 0.68, 0.22, 1.0)
    addText(layer, font, modeText, 44, screenHeight - 42)
    setNextFillColor(layer, 0.72, 0.96, 1.0, 1.0)
    addText(layer, font, selectedText, 44, screenHeight - 16)
end

local function getInitialDocumentText()
    if type(SCREEN_LAYOUT_EDITOR_INITIAL_DOCUMENT) == "string" and SCREEN_LAYOUT_EDITOR_INITIAL_DOCUMENT ~= "" then
        return SCREEN_LAYOUT_EDITOR_INITIAL_DOCUMENT
    end
    return nil
end

local function getState()
    local screenWidth, screenHeight = getResolution()
    if type(SCREEN_LAYOUT_EDITOR_STATE) ~= "table" or not SCREEN_LAYOUT_EDITOR_STATE.initialized then
        local state = ScreenLayoutEditor.createState(screenWidth, screenHeight, getInitialDocumentText())
        state.initialized = true
        SCREEN_LAYOUT_EDITOR_STATE = state
    end

    local state = SCREEN_LAYOUT_EDITOR_STATE
    if state.metrics.screenWidth ~= screenWidth or state.metrics.screenHeight ~= screenHeight then
        state.metrics = ScreenLayoutEditor.computeMetrics(screenWidth, screenHeight)
    end

    return state
end

local function runRenderScript()
    local state = getState()
    local cursorX, cursorY = getCursor()
    ScreenLayoutEditor.applyPointerFrame(state, {
        cursorX = cursorX,
        cursorY = cursorY,
        pressed = getCursorPressed(),
        down = getCursorDown(),
        released = getCursorReleased()
    })

    local _, screenHeight = getResolution()
    setBackgroundColor(0.06, 0.06, 0.07)

    local contentLayer = createLayer()
    local overlayLayer = createLayer()

    for index = 1, #state.document.elements do
        local element = state.document.elements[index]
        drawRoundedElement(contentLayer, element)
        drawElementText(contentLayer, element)
    end

    if state.document.selectedId then
        local selected = ScreenLayoutEditor.findElement(state.document, state.document.selectedId)
        if selected then
            drawSelectionOverlay(state, overlayLayer, selected)
        end
    end

    drawHud(state, overlayLayer, screenHeight)

    local envelope = ScreenLayoutEditor.getOutputEnvelope(state)
    if envelope ~= "" then
        pcall(setOutput, envelope)
    end

    requestAnimationFrame(1)
end

if type(getResolution) == "function"
    and type(createLayer) == "function"
    and type(getCursor) == "function"
    and type(requestAnimationFrame) == "function" then
    runRenderScript()
end

return ScreenLayoutEditor
]====]

local function EnsureScreenLayoutEditorModule()
    if type(SCREEN_LAYOUT_EDITOR_MODULE) == "table" then
        return SCREEN_LAYOUT_EDITOR_MODULE
    end
    local loader, loadError = load(SCREEN_LAYOUT_EDITOR_SOURCE, "@ScreenLayoutEditor.lua", "t", _ENV)
    if not loader then
        system.print("ERROR: Failed to load ScreenLayoutEditor source: " .. tostring(loadError))
        return nil
    end
    local ok, loadedModule = pcall(loader)
    if not ok then
        system.print("ERROR: Failed to initialize ScreenLayoutEditor: " .. tostring(loadedModule))
        return nil
    end
    if type(loadedModule) ~= "table" then
        system.print("ERROR: ScreenLayoutEditor did not return a module table")
        return nil
    end
    SCREEN_LAYOUT_EDITOR_MODULE = loadedModule
    return SCREEN_LAYOUT_EDITOR_MODULE
end

local function RestoreScreenLayoutEditorEnvelope(editorModule)
    if not databank then
        return nil
    end
    local key = editorModule.PERSISTENCE_DB_KEY
    if databank.hasKey(key) then
        local persistedText = databank.getStringValue(key)
        if type(persistedText) == "string" and persistedText ~= "" then
            local envelope = editorModule.readPersistedEnvelope(persistedText)
            if envelope then
                return envelope
            end
        end
    end
    return nil
end

SCREEN_LAYOUT_EDITOR_ENABLED = true
local useFormEditorSlice = SCREEN_LAYOUT_EDITOR_ENABLED
if useFormEditorSlice then
    local screenLayoutEditor = EnsureScreenLayoutEditorModule()
    if screenLayoutEditor then
        local persistedEnvelope = RestoreScreenLayoutEditorEnvelope(screenLayoutEditor)
        local initialDocumentText = persistedEnvelope and persistedEnvelope.serializedDocument or nil
        SCREEN_LAYOUT_EDITOR_MAX_SCREEN_CODE_CHARS = screenLayoutEditor.resolveMaxScreenCodeChars(SCREEN_LAYOUT_EDITOR_MAX_SCREEN_CODE_CHARS)
        SCREEN_LAYOUT_EDITOR_LAST_PERSISTED_REVISION = persistedEnvelope and persistedEnvelope.revision or -1
        SCREEN_LAYOUT_EDITOR_LAST_PERSISTED_HASH = persistedEnvelope and persistedEnvelope.hash or -1
        Screen.clearScriptOutput()
        Screen.setRenderScript(BuildEditableRenderScript(initialDocumentText))
    else
        Screen.setRenderScript(BuildRenderScript(lastCategory, 0, lastTierGroup)..ScrContent)
    end
else
    Screen.setRenderScript(BuildRenderScript(lastCategory, 0, lastTierGroup)..ScrContent)
end

unit.hideWidget();
unit.setTimer("UPD")

