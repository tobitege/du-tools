lastReportAt = nil
reportIntervalSeconds = 1.0

function safeCall(fn)
    local ok, value = pcall(fn)
    if ok then
        return value
    end
    return nil
end

function fmtNum(value)
    if type(value) ~= "number" then
        return "nil"
    end
    return string.format("%.3f", value)
end

function fmtVec(vec)
    if type(vec) ~= "table" then
        return "nil"
    end
    return string.format("(%.3f, %.3f, %.3f)", vec.x or 0, vec.y or 0, vec.z or 0)
end

function dot(a, b)
    if type(a) ~= "table" or type(b) ~= "table" then
        return nil
    end
    return (a.x or 0) * (b.x or 0) + (a.y or 0) * (b.y or 0) + (a.z or 0) * (b.z or 0)
end

function screenDistanceSq(point)
    if type(point) ~= "table" then
        return nil
    end
    local dx = (point.x or 0) - 0.5
    local dy = (point.y or 0) - 0.5
    return dx * dx + dy * dy
end

function projectWorld(worldPos)
    return safeCall(function()
        return library.getPointOnScreen(worldPos)
    end)
end

system.print("PB70 camera helper initialized")
