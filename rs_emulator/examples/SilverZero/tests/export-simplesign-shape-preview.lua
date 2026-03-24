local scriptPath = debug.getinfo(1, "S").source:match("^@(.+)$")
local scriptDir = scriptPath and scriptPath:match("^(.+[\\/])[^\\/]-$") or "./"
local projectRoot = scriptDir:gsub("[\\/]examples[\\/]SilverZero[\\/]tests[\\/]*$", "")

package.path =
    projectRoot .. "/?.lua;" ..
    projectRoot .. "/?/init.lua;" ..
    package.path

local SvgParser = require("lib.SvgParser")
local SvgShapeClassifier = require("lib.SvgShapeClassifier")
local SimpleSignS_svgContent = require("examples.SilverZero.SimpleSignS_html")

local css = [[
<style>
:root {
  --primary-color: #ff0000;
  --highlight-color: #ffffff;
  --text-color: #ffffff;
  --circuit-color-A: #5008;
  --circuit-color-B: #4008;
  --circuit-color-C: #f008;
}
</style>
]]

local kindColors = {
    outline_path = "#53d7ff",
    closed_polygon = "#ffb347",
    triangle = "#96f550",
    quad = "#5ce1a8",
    trapezoid = "#ff7db8",
    polygon_ring = "#f7eb63",
    hex_ring = "#c392ff",
    compound_path = "#ffd966",
}

local function xmlEscape(value)
    value = tostring(value or "")
    value = value:gsub("&", "&amp;")
    value = value:gsub("<", "&lt;")
    value = value:gsub(">", "&gt;")
    value = value:gsub('"', "&quot;")
    return value
end

local function rgbaToCss(color, fallback)
    if not color then
        return fallback or "rgba(255,255,255,0.85)"
    end
    local r = math.floor((color[1] or 0) * 255 + 0.5)
    local g = math.floor((color[2] or 0) * 255 + 0.5)
    local b = math.floor((color[3] or 0) * 255 + 0.5)
    local a = color[4] or 1
    return string.format("rgba(%d,%d,%d,%.3f)", r, g, b, a)
end

local function parseViewBox(svgEntry)
    local values = {}
    for number in tostring(svgEntry and svgEntry.viewBox or ""):gmatch("[%+%-%d%.eE]+") do
        values[#values + 1] = tonumber(number) or 0
    end
    if #values >= 4 then
        return {
            x = values[1],
            y = values[2],
            w = values[3],
            h = values[4],
        }
    end
    return nil
end

local function shapeCountSummary(shapes)
    local counts = {}
    for _, shape in ipairs(shapes or {}) do
        counts[shape.kind] = (counts[shape.kind] or 0) + 1
    end

    local order = {
        "outline_path",
        "closed_polygon",
        "triangle",
        "quad",
        "trapezoid",
        "polygon_ring",
        "hex_ring",
        "compound_path",
    }

    local parts = {}
    for _, kind in ipairs(order) do
        if counts[kind] then
            parts[#parts + 1] = string.format("%s=%d", kind, counts[kind])
        end
    end
    return table.concat(parts, ", ")
end

local function pointsToString(points)
    local parts = {}
    for i = 1, #points do
        parts[#parts + 1] = string.format("%.3f,%.3f", points[i].x, points[i].y)
    end
    return table.concat(parts, " ")
end

local function writeShapeOverlay(out, shape)
    local color = kindColors[shape.kind] or "#ffffff"
    local geometry = shape.geometry or {}
    local strokeWidth = (shape.kind == "outline_path" and 0.85) or 1.2

    if shape.kind == "compound_path" then
        for _, subpath in ipairs(geometry.subpaths or {}) do
            if subpath.closed then
                out:write(string.format(
                    '<polygon points="%s" fill="none" stroke="%s" stroke-width="%.3f" opacity="0.95"/>\n',
                    pointsToString(subpath.points or {}),
                    color,
                    strokeWidth
                ))
            else
                out:write(string.format(
                    '<polyline points="%s" fill="none" stroke="%s" stroke-width="%.3f" opacity="0.95"/>\n',
                    pointsToString(subpath.points or {}),
                    color,
                    strokeWidth
                ))
            end
        end
        return
    end

    local points = geometry.points or {}
    if #points == 0 then
        return
    end

    if shape.kind == "outline_path" then
        out:write(string.format(
            '<polyline points="%s" fill="none" stroke="%s" stroke-width="%.3f" opacity="0.95"/>\n',
            pointsToString(points),
            color,
            strokeWidth
        ))
    else
        out:write(string.format(
            '<polygon points="%s" fill="none" stroke="%s" stroke-width="%.3f" opacity="0.95"/>\n',
            pointsToString(points),
            color,
            strokeWidth
        ))
    end
end

local function shouldLabelShape(shape)
    if shape.kind == "outline_path" or shape.kind == "compound_path" then
        return false
    end
    local bounds = shape.geometry and shape.geometry.bounds
    if not bounds then
        return false
    end
    return (bounds.w * bounds.h) >= 20
end

local function svgTitle(svgEntry, svgIndex)
    local label = {}
    label[#label + 1] = string.format("SVG %d", svgIndex)
    if svgEntry.id and svgEntry.id ~= "" then
        label[#label + 1] = "id=" .. svgEntry.id
    end
    if svgEntry.class and svgEntry.class ~= "" then
        label[#label + 1] = "class=" .. svgEntry.class
    end
    if svgEntry.width then
        label[#label + 1] = "width=" .. svgEntry.width
    end
    return table.concat(label, " | ")
end

local function writePreview(outputSvgPath, outputSummaryPath)
    local doc = SvgParser.parse(css .. SimpleSignS_svgContent)
    local panels = {}
    local targetWidth = 940
    local outerPad = 28
    local panelGap = 34
    local panelHeaderHeight = 42
    local totalHeight = outerPad
    local maxWidth = targetWidth + outerPad * 2

    for svgIndex, svgEntry in ipairs(doc.svgs or {}) do
        local viewBox = parseViewBox(svgEntry)
        if viewBox and viewBox.w > 0 and viewBox.h > 0 then
            local shapes = SvgShapeClassifier.classifySvg(svgEntry, {
                vars = doc.vars,
                svgIndex = svgIndex,
            })

            local scale = targetWidth / viewBox.w
            local panelHeight = viewBox.h * scale
            panels[#panels + 1] = {
                svgIndex = svgIndex,
                svgEntry = svgEntry,
                shapes = shapes,
                viewBox = viewBox,
                scale = scale,
                x = outerPad,
                y = totalHeight,
                width = targetWidth,
                height = panelHeight,
            }
            totalHeight = totalHeight + panelHeaderHeight + panelHeight + panelGap
        end
    end

    totalHeight = totalHeight - panelGap + outerPad

    local out = assert(io.open(outputSvgPath, "w"))
    out:write(string.format(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %.1f %.1f" width="%.1f" height="%.1f">\n',
        maxWidth,
        totalHeight,
        maxWidth,
        totalHeight
    ))
    out:write('<rect width="100%" height="100%" fill="#101318"/>\n')
    out:write('<style>\n')
    out:write('text { font-family: Consolas, "Courier New", monospace; }\n')
    out:write('.header { fill: #f6f8fb; font-size: 18px; font-weight: 700; }\n')
    out:write('.meta { fill: #aeb8c7; font-size: 12px; }\n')
    out:write('.label { fill: #ffffff; font-size: 6px; font-weight: 700; paint-order: stroke; stroke: #0b0d10; stroke-width: 1.2; }\n')
    out:write('</style>\n')

    for _, panel in ipairs(panels) do
        local panelY = panel.y
        local contentY = panelY + panelHeaderHeight
        local borderColor = panel.svgEntry.id == "master-artboard" and "#3e556d" or "#344553"
        local panelTitle = svgTitle(panel.svgEntry, panel.svgIndex)
        local summary = shapeCountSummary(panel.shapes)

        out:write(string.format(
            '<rect x="%.2f" y="%.2f" width="%.2f" height="%.2f" rx="12" fill="#161b22" stroke="%s" stroke-width="1.2"/>\n',
            panel.x - 10,
            panelY - 10,
            panel.width + 20,
            panelHeaderHeight + panel.height + 20,
            borderColor
        ))
        out:write(string.format(
            '<text class="header" x="%.2f" y="%.2f">%s</text>\n',
            panel.x,
            panelY + 18,
            xmlEscape(panelTitle)
        ))
        out:write(string.format(
            '<text class="meta" x="%.2f" y="%.2f">%s</text>\n',
            panel.x,
            panelY + 34,
            xmlEscape(summary)
        ))

        out:write(string.format(
            '<g transform="translate(%.3f %.3f) scale(%.6f)">\n',
            panel.x,
            contentY,
            panel.scale
        ))
        out:write(string.format(
            '<rect x="%.3f" y="%.3f" width="%.3f" height="%.3f" fill="#0e1116" stroke="#2d3642" stroke-width="0.4"/>\n',
            panel.viewBox.x,
            panel.viewBox.y,
            panel.viewBox.w,
            panel.viewBox.h
        ))

        for shapeIndex, shape in ipairs(panel.shapes) do
            local fillCss = rgbaToCss(shape.style and shape.style.resolvedFill, "rgba(255,255,255,0.85)")
            local sourcePath = shape.source and shape.source.path
            local transformAttr = ""
            local transform = shape.source and shape.source.transform
            if transform then
                transformAttr = string.format(
                    ' transform="matrix(%0.6f %0.6f %0.6f %0.6f %0.6f %0.6f)"',
                    transform[1], transform[2], transform[3], transform[4], transform[5], transform[6]
                )
            end

            if sourcePath then
                out:write(string.format(
                    '<path d="%s"%s fill="%s" fill-opacity="0.10" stroke="none" data-kind="%s" data-index="%d"/>\n',
                    xmlEscape(sourcePath),
                    transformAttr,
                    fillCss,
                    xmlEscape(shape.kind),
                    shapeIndex
                ))
            end

            writeShapeOverlay(out, shape)

            if shouldLabelShape(shape) then
                local bounds = shape.geometry.bounds
                out:write(string.format(
                    '<text class="label" x="%.3f" y="%.3f">%d:%s</text>\n',
                    bounds.x + 1.5,
                    bounds.y - 1.5,
                    shapeIndex,
                    xmlEscape(shape.kind)
                ))
            end
        end

        out:write('</g>\n')
    end

    out:write('</svg>\n')
    out:close()

    local summaryOut = assert(io.open(outputSummaryPath, "w"))
    summaryOut:write("SimpleSignS classifier preview\n")
    summaryOut:write("==============================\n\n")
    for _, panel in ipairs(panels) do
        summaryOut:write(svgTitle(panel.svgEntry, panel.svgIndex) .. "\n")
        summaryOut:write(shapeCountSummary(panel.shapes) .. "\n")
        for shapeIndex, shape in ipairs(panel.shapes) do
            local bounds = shape.geometry and shape.geometry.bounds
            summaryOut:write(string.format(
                "  #%02d  %-14s subpaths=%d points=%d bounds=%s\n",
                shapeIndex,
                shape.kind,
                shape.analysis and shape.analysis.subpathCount or 0,
                shape.analysis and shape.analysis.pointCount or 0,
                bounds and string.format("(%.3f, %.3f, %.3f, %.3f)", bounds.x, bounds.y, bounds.w, bounds.h) or "(nil)"
            ))
        end
        summaryOut:write("\n")
    end
    summaryOut:close()
end

local baseDir = scriptDir or "./"
local svgPath = baseDir .. "simplesign-shape-classifier-preview.svg"
local summaryPath = baseDir .. "simplesign-shape-classifier-summary.txt"

writePreview(svgPath, summaryPath)
print("Wrote " .. svgPath)
print("Wrote " .. summaryPath)
