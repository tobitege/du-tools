SCREEN_LAYOUT_EDITOR_INPUT_CHUNK_SIZE = math.max(256, math.floor(tonumber(SCREEN_LAYOUT_EDITOR_INPUT_CHUNK_SIZE) or 880))

if type(encodeBase36) ~= "function" then
    function encodeBase36(value)
        local digits = "0123456789abcdefghijklmnopqrstuvwxyz"
        local numeric = math.max(0, math.floor(tonumber(value) or 0))
        if numeric == 0 then
            return "0"
        end
        local parts = {}
        while numeric > 0 do
            local remainder = (numeric % 36) + 1
            parts[#parts + 1] = string.sub(digits, remainder, remainder)
            numeric = math.floor(numeric / 36)
        end
        local encoded = {}
        for index = #parts, 1, -1 do
            encoded[#encoded + 1] = parts[index]
        end
        return table.concat(encoded)
    end
end

if type(BuildEditableRenderScriptTransfer) ~= "function" then
    function BuildEditableRenderScriptTransfer(initialDocumentState, inputKind)
        if type(initialDocumentState) ~= "table" then
            return nil
        end
        local documentText = tostring(initialDocumentState.serializedDocument or "")
        if documentText == "" then
            return nil
        end
        local chunkSize = math.max(256, math.floor(tonumber(SCREEN_LAYOUT_EDITOR_INPUT_CHUNK_SIZE) or 880))
        local chunks = {}
        local startIndex = 1
        while startIndex <= #documentText do
            chunks[#chunks + 1] = documentText:sub(startIndex, startIndex + chunkSize - 1)
            startIndex = startIndex + chunkSize
        end
        if #chunks <= 0 then
            return nil
        end
        return {
            kind = tostring(inputKind or "slei"),
            token = table.concat({
                encodeBase36(math.max(0, math.floor(tonumber(initialDocumentState.startupNonce) or 0))),
                encodeBase36(math.max(0, math.floor(tonumber(initialDocumentState.revision) or 0))),
                encodeBase36(math.max(0, math.floor(tonumber(initialDocumentState.hash) or 0))),
                encodeBase36(#documentText)
            }, "."),
            chunks = chunks,
            count = #chunks,
            nextIndex = 1,
            length = #documentText
        }
    end
end

if type(BuildEditableRenderScriptInput) ~= "function" then
    function BuildEditableRenderScriptInput(transfer, chunkIndex)
        if type(transfer) ~= "table" then
            return ""
        end
        local index = math.max(1, math.floor(tonumber(chunkIndex) or tonumber(transfer.nextIndex) or 1))
        local chunks = type(transfer.chunks) == "table" and transfer.chunks or nil
        local chunkText = chunks and tostring(chunks[index] or "") or ""
        if chunkText == "" then
            return ""
        end
        return table.concat({
            "c|",
            tostring(transfer.token or ""),
            "|",
            encodeBase36(index),
            "|",
            encodeBase36(math.max(1, math.floor(tonumber(transfer.count) or (chunks and #chunks or 1)))),
            "|",
            chunkText
        })
    end
end
