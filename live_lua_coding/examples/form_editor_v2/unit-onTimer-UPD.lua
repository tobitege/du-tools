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
                    "debug"
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
                "debug"
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

local function SLEClearScreenOutputs(outputScreen)
    if type(Screens) == "table" and #Screens > 0 then
        for index = 1, #Screens do
            Screens[index].clearScriptOutput()
        end
    elseif outputScreen then
        outputScreen.clearScriptOutput()
    end
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
SLE_LOG_LEVEL = string.lower(tostring(SLE_LOG_LEVEL or "info"))
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
    if type(outputText) == "string" and outputText ~= "" then
        if type(SLEP) == "function" then
            SLEP(
                "sle-receive",
                string.format("rx b=%d", #outputText),
                "debug"
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

return
