local SvgParser = require("lib.SvgParser")

local M = {}

local function clonePoint(point)
    return { x = point.x, y = point.y }
end

local function clonePoints(points)
    local result = {}
    for i = 1, #points do
        result[i] = clonePoint(points[i])
    end
    return result
end

local function copyBounds(bounds)
    if not bounds then
        return nil
    end
    return {
        x = bounds.x,
        y = bounds.y,
        w = bounds.w,
        h = bounds.h,
    }
end

local function boundsFromPoints(points)
    if not points or #points == 0 then
        return nil
    end

    local minX, maxX = points[1].x, points[1].x
    local minY, maxY = points[1].y, points[1].y
    for i = 2, #points do
        local point = points[i]
        if point.x < minX then minX = point.x end
        if point.x > maxX then maxX = point.x end
        if point.y < minY then minY = point.y end
        if point.y > maxY then maxY = point.y end
    end

    return {
        x = minX,
        y = minY,
        w = maxX - minX,
        h = maxY - minY,
    }
end

local function mergeBounds(boundsList)
    local minX, minY, maxX, maxY = nil, nil, nil, nil
    for _, bounds in ipairs(boundsList or {}) do
        if bounds then
            local bMinX = bounds.x
            local bMinY = bounds.y
            local bMaxX = bounds.x + bounds.w
            local bMaxY = bounds.y + bounds.h
            if minX == nil or bMinX < minX then minX = bMinX end
            if minY == nil or bMinY < minY then minY = bMinY end
            if maxX == nil or bMaxX > maxX then maxX = bMaxX end
            if maxY == nil or bMaxY > maxY then maxY = bMaxY end
        end
    end

    if minX == nil then
        return nil
    end

    return {
        x = minX,
        y = minY,
        w = maxX - minX,
        h = maxY - minY,
    }
end

local function boundsCenter(bounds)
    if not bounds then
        return nil, nil
    end
    return bounds.x + bounds.w * 0.5, bounds.y + bounds.h * 0.5
end

local function pointEquals(a, b, epsilon)
    epsilon = epsilon or 1e-6
    return math.abs(a.x - b.x) <= epsilon and math.abs(a.y - b.y) <= epsilon
end

local function pointDistance(a, b)
    local dx = b.x - a.x
    local dy = b.y - a.y
    return math.sqrt(dx * dx + dy * dy)
end

local function signedPolygonArea(points)
    if not points or #points < 3 then
        return 0
    end

    local area = 0
    for i = 1, #points do
        local current = points[i]
        local nextPoint = points[(i % #points) + 1]
        area = area + current.x * nextPoint.y - nextPoint.x * current.y
    end
    return area * 0.5
end

local function normalizeTolerance(points, fallback)
    local bounds = boundsFromPoints(points)
    local maxDim = 1
    if bounds then
        maxDim = math.max(bounds.w, bounds.h, 1)
    end
    return math.max(fallback or 1e-4, maxDim * 1e-5)
end

local function removeConsecutiveDuplicates(points, epsilon)
    if not points or #points == 0 then
        return {}
    end

    local result = { clonePoint(points[1]) }
    for i = 2, #points do
        local point = points[i]
        if not pointEquals(point, result[#result], epsilon) then
            result[#result + 1] = clonePoint(point)
        end
    end
    return result
end

local function stripClosedDuplicate(points, closed, epsilon)
    if not closed or #points < 2 then
        return points
    end
    if pointEquals(points[1], points[#points], epsilon) then
        table.remove(points, #points)
    end
    return points
end

local function pointLineDistance(prevPoint, point, nextPoint)
    local vx = nextPoint.x - prevPoint.x
    local vy = nextPoint.y - prevPoint.y
    local len = math.sqrt(vx * vx + vy * vy)
    if len == 0 then
        return pointDistance(prevPoint, point)
    end
    local cross = math.abs((point.x - prevPoint.x) * vy - (point.y - prevPoint.y) * vx)
    return cross / len
end

local function pointProjection(prevPoint, point, nextPoint)
    local vx = nextPoint.x - prevPoint.x
    local vy = nextPoint.y - prevPoint.y
    local lenSq = vx * vx + vy * vy
    if lenSq == 0 then
        return 0
    end
    return ((point.x - prevPoint.x) * vx + (point.y - prevPoint.y) * vy) / lenSq
end

local function simplifyPoints(points, closed, options)
    local epsilon = options.pointEpsilon or normalizeTolerance(points, 1e-6)
    local collinearTolerance = options.collinearTolerance or math.max(1e-4, normalizeTolerance(points, 1e-4))
    local result = removeConsecutiveDuplicates(points, epsilon)
    result = stripClosedDuplicate(result, closed, epsilon)

    local minPoints = closed and 3 or 2
    if #result <= minPoints then
        return result
    end

    local changed = true
    while changed do
        changed = false
        local i = 1
        local limit = #result
        while i <= limit do
            local isEndpoint = (not closed) and (i == 1 or i == limit)
            if isEndpoint then
                i = i + 1
            else
                local prevIndex = i == 1 and limit or (i - 1)
                local nextIndex = i == limit and 1 or (i + 1)
                local prevPoint = result[prevIndex]
                local point = result[i]
                local nextPoint = result[nextIndex]
                local projection = pointProjection(prevPoint, point, nextPoint)
                local distance = pointLineDistance(prevPoint, point, nextPoint)
                if projection >= 0 and projection <= 1 and distance <= collinearTolerance then
                    table.remove(result, i)
                    changed = true
                    limit = limit - 1
                    if limit <= minPoints then
                        break
                    end
                else
                    i = i + 1
                end
            end
        end
    end

    return result
end

local function applyTransform(transform, x, y)
    if not transform then
        return x, y
    end
    return
        transform[1] * x + transform[3] * y + transform[5],
        transform[2] * x + transform[4] * y + transform[6]
end

local function cubicPoint(x0, y0, x1, y1, x2, y2, x3, y3, t)
    local inv = 1 - t
    local inv2 = inv * inv
    local inv3 = inv2 * inv
    local t2 = t * t
    local t3 = t2 * t
    return
        inv3 * x0 + 3 * inv2 * t * x1 + 3 * inv * t2 * x2 + t3 * x3,
        inv3 * y0 + 3 * inv2 * t * y1 + 3 * inv * t2 * y2 + t3 * y3
end

local function quadraticPoint(x0, y0, x1, y1, x2, y2, t)
    local inv = 1 - t
    local inv2 = inv * inv
    local t2 = t * t
    return
        inv2 * x0 + 2 * inv * t * x1 + t2 * x2,
        inv2 * y0 + 2 * inv * t * y1 + t2 * y2
end

local function arcPoints(x1, y1, rx, ry, rot, large, sweep, x2, y2)
    local points = {}
    if rx == 0 or ry == 0 then
        return points
    end

    rx = math.abs(rx)
    ry = math.abs(ry)
    local rotRad = math.rad(rot)
    local cosr = math.cos(rotRad)
    local sinr = math.sin(rotRad)
    local dx = (x1 - x2) * 0.5
    local dy = (y1 - y2) * 0.5
    local x1p = cosr * dx + sinr * dy
    local y1p = -sinr * dx + cosr * dy
    local x1pp = x1p * x1p
    local y1pp = y1p * y1p
    local lambda = x1pp / (rx * rx) + y1pp / (ry * ry)
    if lambda > 1 then
        local scale = math.sqrt(lambda)
        rx = rx * scale
        ry = ry * scale
    end

    local numerator = rx * rx * ry * ry - rx * rx * y1pp - ry * ry * x1pp
    local denominator = rx * rx * y1pp + ry * ry * x1pp
    if denominator == 0 then
        return points
    end

    local factor = math.sqrt(math.max(0, numerator / denominator))
    if large == sweep then
        factor = -factor
    end

    local cxp = factor * (rx * y1p) / ry
    local cyp = factor * (-ry * x1p) / rx
    local cx = cosr * cxp - sinr * cyp + (x1 + x2) * 0.5
    local cy = sinr * cxp + cosr * cyp + (y1 + y2) * 0.5

    local function vectorAngle(ux, uy, vx, vy)
        local dot = ux * vx + uy * vy
        local len = math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy))
        if len == 0 then
            return 0
        end
        local value = math.max(-1, math.min(1, dot / len))
        local angle = math.acos(value)
        if ux * vy - uy * vx < 0 then
            angle = -angle
        end
        return angle
    end

    local ux = (x1p - cxp) / rx
    local uy = (y1p - cyp) / ry
    local vx = (-x1p - cxp) / rx
    local vy = (-y1p - cyp) / ry
    local startAngle = vectorAngle(1, 0, ux, uy)
    local deltaAngle = vectorAngle(ux, uy, vx, vy)

    if sweep == 0 and deltaAngle > 0 then
        deltaAngle = deltaAngle - 2 * math.pi
    elseif sweep == 1 and deltaAngle < 0 then
        deltaAngle = deltaAngle + 2 * math.pi
    end

    local segments = math.max(4, math.ceil(math.abs(deltaAngle) / (math.pi / 8)))
    for i = 1, segments do
        local angle = startAngle + deltaAngle * (i / segments)
        local cosAngle = math.cos(angle)
        local sinAngle = math.sin(angle)
        points[#points + 1] = {
            x = cx + cosr * rx * cosAngle - sinr * ry * sinAngle,
            y = cy + sinr * rx * cosAngle + cosr * ry * sinAngle,
        }
    end

    return points
end

local function finalizeSubpath(rawSubpath, options)
    local epsilon = options.pointEpsilon or 1e-6
    local rawClosed = rawSubpath.closed
    if not rawClosed and #rawSubpath.rawPoints >= 2 then
        rawClosed = pointEquals(rawSubpath.rawPoints[1], rawSubpath.rawPoints[#rawSubpath.rawPoints], epsilon)
    end
    local rawPoints = stripClosedDuplicate(
        removeConsecutiveDuplicates(rawSubpath.rawPoints, epsilon),
        rawClosed,
        epsilon
    )
    local points = simplifyPoints(rawPoints, rawClosed, options)
    local bounds = boundsFromPoints(points)
    local area = rawClosed and signedPolygonArea(points) or 0

    return {
        closed = rawClosed,
        points = points,
        rawPointCount = #rawPoints,
        pointCount = #points,
        bounds = bounds,
        area = area,
        orientation = area == 0 and nil or (area > 0 and "ccw" or "cw"),
    }
end

local function flattenPath(pathData, transform, options)
    options = options or {}
    local tokens = SvgParser.parsePath(pathData) or {}
    local subpaths = {}
    local currentSubpath = nil
    local cx, cy = 0, 0
    local startX, startY = 0, 0
    local tokenIndex = 1
    local currentCmd = nil
    local lastCubicCtrlX, lastCubicCtrlY = nil, nil
    local lastQuadCtrlX, lastQuadCtrlY = nil, nil

    local function commitSubpath()
        if currentSubpath and #currentSubpath.rawPoints > 0 then
            subpaths[#subpaths + 1] = finalizeSubpath(currentSubpath, options)
        end
        currentSubpath = nil
    end

    local function pushRawPoint(x, y)
        if not currentSubpath then
            currentSubpath = { rawPoints = {}, closed = false }
        end
        local tx, ty = applyTransform(transform, x, y)
        local points = currentSubpath.rawPoints
        local point = { x = tx, y = ty }
        if #points == 0 or not pointEquals(points[#points], point, options.pointEpsilon or 1e-6) then
            points[#points + 1] = point
        end
    end

    local function beginSubpath(x, y)
        commitSubpath()
        currentSubpath = { rawPoints = {}, closed = false }
        startX, startY = x, y
        cx, cy = x, y
        pushRawPoint(x, y)
    end

    local function lineTo(x, y)
        if not currentSubpath then
            beginSubpath(cx, cy)
        end
        pushRawPoint(x, y)
        cx, cy = x, y
    end

    local function hasNum(count)
        for offset = 0, count - 1 do
            local token = tokens[tokenIndex + offset]
            if not token or token.type ~= "num" then
                return false
            end
        end
        return true
    end

    local function getNum()
        if not hasNum(1) then
            return nil
        end
        local value = tokens[tokenIndex].value
        tokenIndex = tokenIndex + 1
        return value
    end

    while tokenIndex <= #tokens do
        local token = tokens[tokenIndex]
        if token.type == "cmd" then
            currentCmd = token.value
            tokenIndex = tokenIndex + 1
            if currentCmd:upper() == "Z" then
                if currentSubpath then
                    currentSubpath.closed = true
                    if cx ~= startX or cy ~= startY then
                        pushRawPoint(startX, startY)
                        cx, cy = startX, startY
                    end
                end
                lastCubicCtrlX, lastCubicCtrlY = nil, nil
                lastQuadCtrlX, lastQuadCtrlY = nil, nil
                currentCmd = nil
            end
        elseif not currentCmd then
            tokenIndex = tokenIndex + 1
        else
            local cmd = currentCmd
            local upper = cmd:upper()
            local isRelative = cmd:lower() == cmd

            if upper == "M" then
                local isFirstPair = true
                while hasNum(2) do
                    local x = getNum()
                    local y = getNum()
                    local nx = isRelative and (cx + x) or x
                    local ny = isRelative and (cy + y) or y
                    if isFirstPair then
                        beginSubpath(nx, ny)
                        isFirstPair = false
                    else
                        lineTo(nx, ny)
                    end
                end
                currentCmd = isRelative and "l" or "L"
                lastCubicCtrlX, lastCubicCtrlY = nil, nil
                lastQuadCtrlX, lastQuadCtrlY = nil, nil
            elseif upper == "L" then
                while hasNum(2) do
                    local x = getNum()
                    local y = getNum()
                    local nx = isRelative and (cx + x) or x
                    local ny = isRelative and (cy + y) or y
                    lineTo(nx, ny)
                end
                lastCubicCtrlX, lastCubicCtrlY = nil, nil
                lastQuadCtrlX, lastQuadCtrlY = nil, nil
            elseif upper == "H" then
                while hasNum(1) do
                    local x = getNum()
                    local nx = isRelative and (cx + x) or x
                    lineTo(nx, cy)
                end
                lastCubicCtrlX, lastCubicCtrlY = nil, nil
                lastQuadCtrlX, lastQuadCtrlY = nil, nil
            elseif upper == "V" then
                while hasNum(1) do
                    local y = getNum()
                    local ny = isRelative and (cy + y) or y
                    lineTo(cx, ny)
                end
                lastCubicCtrlX, lastCubicCtrlY = nil, nil
                lastQuadCtrlX, lastQuadCtrlY = nil, nil
            elseif upper == "C" then
                while hasNum(6) do
                    local x1 = getNum()
                    local y1 = getNum()
                    local x2 = getNum()
                    local y2 = getNum()
                    local x = getNum()
                    local y = getNum()
                    local c1x = isRelative and (cx + x1) or x1
                    local c1y = isRelative and (cy + y1) or y1
                    local c2x = isRelative and (cx + x2) or x2
                    local c2y = isRelative and (cy + y2) or y2
                    local nx = isRelative and (cx + x) or x
                    local ny = isRelative and (cy + y) or y
                    local segments = math.max(6, math.ceil((math.abs(nx - cx) + math.abs(ny - cy)) / 18))
                    for step = 1, segments do
                        local qx, qy = cubicPoint(cx, cy, c1x, c1y, c2x, c2y, nx, ny, step / segments)
                        lineTo(qx, qy)
                    end
                    lastCubicCtrlX, lastCubicCtrlY = c2x, c2y
                    lastQuadCtrlX, lastQuadCtrlY = nil, nil
                end
            elseif upper == "S" then
                while hasNum(4) do
                    local x2 = getNum()
                    local y2 = getNum()
                    local x = getNum()
                    local y = getNum()
                    local c1x = cx
                    local c1y = cy
                    if lastCubicCtrlX and lastCubicCtrlY then
                        c1x = cx * 2 - lastCubicCtrlX
                        c1y = cy * 2 - lastCubicCtrlY
                    end
                    local c2x = isRelative and (cx + x2) or x2
                    local c2y = isRelative and (cy + y2) or y2
                    local nx = isRelative and (cx + x) or x
                    local ny = isRelative and (cy + y) or y
                    local segments = math.max(6, math.ceil((math.abs(nx - cx) + math.abs(ny - cy)) / 18))
                    for step = 1, segments do
                        local qx, qy = cubicPoint(cx, cy, c1x, c1y, c2x, c2y, nx, ny, step / segments)
                        lineTo(qx, qy)
                    end
                    lastCubicCtrlX, lastCubicCtrlY = c2x, c2y
                    lastQuadCtrlX, lastQuadCtrlY = nil, nil
                end
            elseif upper == "Q" then
                while hasNum(4) do
                    local x1 = getNum()
                    local y1 = getNum()
                    local x = getNum()
                    local y = getNum()
                    local c1x = isRelative and (cx + x1) or x1
                    local c1y = isRelative and (cy + y1) or y1
                    local nx = isRelative and (cx + x) or x
                    local ny = isRelative and (cy + y) or y
                    local segments = math.max(5, math.ceil((math.abs(nx - cx) + math.abs(ny - cy)) / 20))
                    for step = 1, segments do
                        local qx, qy = quadraticPoint(cx, cy, c1x, c1y, nx, ny, step / segments)
                        lineTo(qx, qy)
                    end
                    lastQuadCtrlX, lastQuadCtrlY = c1x, c1y
                    lastCubicCtrlX, lastCubicCtrlY = nil, nil
                end
            elseif upper == "T" then
                while hasNum(2) do
                    local x = getNum()
                    local y = getNum()
                    local c1x = cx
                    local c1y = cy
                    if lastQuadCtrlX and lastQuadCtrlY then
                        c1x = cx * 2 - lastQuadCtrlX
                        c1y = cy * 2 - lastQuadCtrlY
                    end
                    local nx = isRelative and (cx + x) or x
                    local ny = isRelative and (cy + y) or y
                    local segments = math.max(5, math.ceil((math.abs(nx - cx) + math.abs(ny - cy)) / 20))
                    for step = 1, segments do
                        local qx, qy = quadraticPoint(cx, cy, c1x, c1y, nx, ny, step / segments)
                        lineTo(qx, qy)
                    end
                    lastQuadCtrlX, lastQuadCtrlY = c1x, c1y
                    lastCubicCtrlX, lastCubicCtrlY = nil, nil
                end
            elseif upper == "A" then
                while hasNum(7) do
                    local rx = getNum()
                    local ry = getNum()
                    local rot = getNum()
                    local large = getNum()
                    local sweep = getNum()
                    local x = getNum()
                    local y = getNum()
                    local nx = isRelative and (cx + x) or x
                    local ny = isRelative and (cy + y) or y
                    local points = arcPoints(cx, cy, rx, ry, rot, large, sweep, nx, ny)
                    for i = 1, #points do
                        lineTo(points[i].x, points[i].y)
                    end
                    if cx ~= nx or cy ~= ny then
                        lineTo(nx, ny)
                    end
                    lastCubicCtrlX, lastCubicCtrlY = nil, nil
                    lastQuadCtrlX, lastQuadCtrlY = nil, nil
                end
            else
                tokenIndex = tokenIndex + 1
            end
        end
    end

    commitSubpath()
    return subpaths
end

local function segmentVector(points, index)
    local a = points[index]
    local b = points[(index % #points) + 1]
    return b.x - a.x, b.y - a.y
end

local function isParallel(points, firstIndex, secondIndex, tolerance)
    local ax, ay = segmentVector(points, firstIndex)
    local bx, by = segmentVector(points, secondIndex)
    local lenA = math.sqrt(ax * ax + ay * ay)
    local lenB = math.sqrt(bx * bx + by * by)
    if lenA == 0 or lenB == 0 then
        return false
    end
    local cross = math.abs(ax * by - ay * bx)
    return (cross / (lenA * lenB)) <= tolerance
end

local function orientationValue(a, b, c)
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
end

local function segmentsIntersect(a, b, c, d, epsilon)
    epsilon = epsilon or 1e-6
    local o1 = orientationValue(a, b, c)
    local o2 = orientationValue(a, b, d)
    local o3 = orientationValue(c, d, a)
    local o4 = orientationValue(c, d, b)

    local function differentSigns(v1, v2)
        return (v1 > epsilon and v2 < -epsilon) or (v1 < -epsilon and v2 > epsilon)
    end

    return differentSigns(o1, o2) and differentSigns(o3, o4)
end

local function isSimpleQuad(points)
    if #points ~= 4 then
        return false
    end
    return
        not segmentsIntersect(points[1], points[2], points[3], points[4]) and
        not segmentsIntersect(points[2], points[3], points[4], points[1])
end

local function classifyQuad(points, options)
    local tolerance = options.parallelTolerance or 0.05
    local firstPairParallel = isParallel(points, 1, 3, tolerance)
    local secondPairParallel = isParallel(points, 2, 4, tolerance)
    if (firstPairParallel and not secondPairParallel) or (secondPairParallel and not firstPairParallel) then
        return "trapezoid", 0.98
    end
    return "quad", 0.98
end

local function primarySubpath(subpaths)
    local bestIndex = nil
    local bestScore = nil
    for index, subpath in ipairs(subpaths or {}) do
        local bounds = subpath.bounds
        local areaScore = math.abs(subpath.area or 0)
        local boundsScore = bounds and (bounds.w * bounds.h) or 0
        local score = areaScore > 0 and areaScore or boundsScore
        if bestIndex == nil or score > bestScore then
            bestIndex = index
            bestScore = score
        end
    end
    return bestIndex
end

function M.analyzePath(pathData, transform, options)
    options = options or {}
    local subpaths = flattenPath(pathData, transform, options)
    local totalPoints = 0
    local totalRawPoints = 0
    local closedCount = 0
    local boundsList = {}

    for _, subpath in ipairs(subpaths) do
        totalPoints = totalPoints + (subpath.pointCount or 0)
        totalRawPoints = totalRawPoints + (subpath.rawPointCount or 0)
        if subpath.closed then
            closedCount = closedCount + 1
        end
        boundsList[#boundsList + 1] = subpath.bounds
    end

    local primaryIndex = primarySubpath(subpaths)
    local primary = primaryIndex and subpaths[primaryIndex] or nil

    return {
        subpaths = subpaths,
        subpathCount = #subpaths,
        closed = #subpaths > 0 and closedCount == #subpaths,
        open = closedCount ~= #subpaths,
        compound = #subpaths > 1,
        pointCount = totalPoints,
        rawPointCount = totalRawPoints,
        bounds = mergeBounds(boundsList),
        primarySubpathIndex = primaryIndex,
        primarySubpath = primary,
    }
end

local function classifyAnalysis(analysis, options)
    local subpaths = analysis.subpaths or {}
    if #subpaths == 0 then
        return "outline_path", 0.4
    end

    if #subpaths > 1 then
        return "compound_path", 0.9
    end

    local primary = analysis.primarySubpath
    if not primary or not primary.closed or primary.pointCount < 3 then
        return "outline_path", 0.96
    end

    if primary.pointCount == 3 then
        return "triangle", 0.99
    end

    if primary.pointCount == 4 then
        if isSimpleQuad(primary.points) then
            return classifyQuad(primary.points, options or {})
        end
        return "closed_polygon", 0.82
    end

    return "closed_polygon", 0.9
end

local function copySubpath(subpath)
    return {
        closed = subpath.closed,
        pointCount = subpath.pointCount,
        rawPointCount = subpath.rawPointCount,
        points = clonePoints(subpath.points or {}),
        bounds = copyBounds(subpath.bounds),
        area = subpath.area,
        orientation = subpath.orientation,
    }
end

local function copySubpaths(subpaths)
    local result = {}
    for i = 1, #(subpaths or {}) do
        result[i] = copySubpath(subpaths[i])
    end
    return result
end

local function buildItemOptions(options, overrides)
    local merged = {}
    for key, value in pairs(options or {}) do
        merged[key] = value
    end
    for key, value in pairs(overrides or {}) do
        merged[key] = value
    end
    return merged
end

function M.classifyItem(item, options)
    options = options or {}
    local analysis = M.analyzePath(item and item.d or nil, item and item.transform or nil, options)
    local kind, confidence = classifyAnalysis(analysis, options)
    local primary = analysis.primarySubpath
    local bounds = analysis.bounds
    local centerX, centerY = boundsCenter(bounds)
    local source = {
        path = item and item.d or nil,
        transform = item and item.transform or nil,
        svgIndex = options.svgIndex,
        itemIndex = options.itemIndex,
        svgId = options.svgId,
        svgClass = options.svgClass,
    }

    return {
        kind = kind,
        role = nil,
        confidence = confidence,
        analysis = {
            open = analysis.open,
            closed = analysis.closed,
            compound = analysis.compound,
            subpathCount = analysis.subpathCount,
            pointCount = analysis.pointCount,
            rawPointCount = analysis.rawPointCount,
            primarySubpathIndex = analysis.primarySubpathIndex,
        },
        geometry = {
            points = primary and clonePoints(primary.points or {}) or {},
            subpaths = copySubpaths(analysis.subpaths),
            bounds = copyBounds(bounds),
            center = (centerX and centerY) and { x = centerX, y = centerY } or nil,
        },
        style = {
            fill = item and item.fill or nil,
            resolvedFill = options.vars and item and item.fill and SvgParser.parseColor(item.fill, options.vars) or nil,
            stroke = item and item.stroke or nil,
        },
        source = source,
    }
end

function M.classifyItems(items, options)
    local result = {}
    for itemIndex, item in ipairs(items or {}) do
        result[#result + 1] = M.classifyItem(item, buildItemOptions(options, {
            itemIndex = itemIndex,
        }))
    end
    return result
end

function M.classifySvg(svgEntry, options)
    options = options or {}
    return M.classifyItems(svgEntry and svgEntry.items or {}, buildItemOptions(options, {
        svgId = svgEntry and svgEntry.id or nil,
        svgClass = svgEntry and svgEntry.class or nil,
    }))
end

function M.classify(doc, options)
    options = options or {}
    local shapes = {}
    for svgIndex, svgEntry in ipairs(doc and doc.svgs or {}) do
        local classified = M.classifySvg(svgEntry, buildItemOptions(options, {
            vars = options.vars or (doc and doc.vars) or nil,
            svgIndex = svgIndex,
        }))
        for i = 1, #classified do
            shapes[#shapes + 1] = classified[i]
        end
    end
    return shapes
end

M.boundsFromPoints = boundsFromPoints
M.signedPolygonArea = signedPolygonArea
M.flattenPath = flattenPath
M.simplifyPoints = simplifyPoints

return M
