local function tryIndex(value, key)
    local ok, result = pcall(function()
        return value[key]
    end)
    if ok then
        return result
    end
    return nil
end

local function tryCall(fn, value)
    if type(fn) ~= "function" then
        return nil
    end
    local ok, result = pcall(fn, value)
    if ok then
        return result
    end
    return nil
end

local function readComponent(value, axis)
    if value == nil then
        return nil
    end

    local direct = tryIndex(value, axis)
    if type(direct) == "number" then
        return direct
    end

    local upper = tryIndex(value, string.upper(axis))
    if type(upper) == "number" then
        return upper
    end

    local slot = ({ x = 1, y = 2, z = 3 })[axis]
    local indexed = tryIndex(value, slot)
    if type(indexed) == "number" then
        return indexed
    end

    local getter = tryIndex(value, "get" .. string.upper(axis))
    local calledGetter = tryCall(getter, value)
    if type(calledGetter) == "number" then
        return calledGetter
    end

    local method = tryIndex(value, axis)
    local calledMethod = tryCall(method, value)
    if type(calledMethod) == "number" then
        return calledMethod
    end

    return nil
end

local function describeVec(value)
    if value == nil then
        return "nil"
    end

    local x = readComponent(value, "x")
    local y = readComponent(value, "y")
    local z = readComponent(value, "z")
    if type(x) == "number" and type(y) == "number" and type(z) == "number" then
        if x == 0 and y == 0 and z == 0 then
            return "zero"
        end
        return fmtVec({ x = x, y = y, z = z })
    end

    local pieces = {}
    for _, key in ipairs({ "x", "y", "z", "X", "Y", "Z", 1, 2, 3, "getX", "getY", "getZ" }) do
        local got = tryIndex(value, key)
        local label = tostring(key)
        if type(got) == "number" then
            pieces[#pieces + 1] = label .. "=" .. fmtNum(got)
        elseif type(got) == "function" then
            local called = tryCall(got, value)
            if type(called) == "number" then
                pieces[#pieces + 1] = label .. "()=" .. fmtNum(called)
            else
                pieces[#pieces + 1] = label .. "()=" .. tostring(called)
            end
        elseif got ~= nil then
            pieces[#pieces + 1] = label .. "=" .. tostring(got)
        end
    end

    if #pieces == 0 then
        return "table=" .. tostring(value)
    end

    return table.concat(pieces, " ")
end

local function classifyScalar(value)
    if value == nil then
        return "nil"
    end
    if type(value) == "number" then
        if value == 0 then
            return "zero"
        end
        return "num=" .. fmtNum(value)
    end
    if type(value) == "boolean" then
        return "bool=" .. tostring(value)
    end
    return type(value) .. "=" .. tostring(value)
end

local function probeScalar(name, fn)
    local ok, value = pcall(fn)
    if not ok then
        return name .. "=error"
    end
    return name .. "=" .. classifyScalar(value)
end

local function probeVec(name, fn)
    local ok, value = pcall(fn)
    if not ok then
        return name .. "=error"
    end
    return name .. "=" .. describeVec(value)
end

local now = safeCall(function()
    return system.getArkTime()
end)

if type(now) ~= "number" then
    return
end

if lastReportAt ~= nil and (now - lastReportAt) < (reportIntervalSeconds or 1.0) then
    return
end

lastReportAt = now

system.print("PB70 probe tick")
system.print(probeScalar("camMode", function() return system.getCameraMode() end))
system.print(probeScalar("firstPerson", function() return system.isFirstPerson() end))
system.print(probeVec("camWorldPos", function() return system.getCameraWorldPos() end))
system.print(probeVec("camWorldFwd", function() return system.getCameraWorldForward() end))
system.print(probeVec("camWorldRight", function() return system.getCameraWorldRight() end))
system.print(probeVec("camWorldUp", function() return system.getCameraWorldUp() end))
system.print(probeVec("camLocalPos", function() return system.getCameraPos() end))
system.print(probeVec("camLocalFwd", function() return system.getCameraForward() end))
system.print(probeVec("playerWorldPos", function() return player.getWorldPosition() end))
system.print(probeVec("playerWorldHead", function() return player.getWorldHeadPosition() end))
system.print(probeVec("playerWorldFwd", function() return player.getWorldForward() end))
system.print(probeScalar("fovH", function() return system.getCameraHorizontalFov() end))
system.print(probeScalar("fovV", function() return system.getCameraVerticalFov() end))
