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
