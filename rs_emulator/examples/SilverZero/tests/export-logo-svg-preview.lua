package.path = "../../../?.lua;../../../?/init.lua;" .. package.path

local SvgParser = require("lib.SvgParser")
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

local function rgbaToCss(color)
    local r = math.floor((color[1] or 0) * 255 + 0.5)
    local g = math.floor((color[2] or 0) * 255 + 0.5)
    local b = math.floor((color[3] or 0) * 255 + 0.5)
    local a = color[4] or 1
    return string.format("rgba(%d,%d,%d,%.3f)", r, g, b, a)
end

local function writeLogoPreview(outputPath)
    local doc = SvgParser.parse(css .. SimpleSignS_svgContent)
    local logoSvg = nil

    for _, entry in ipairs(doc.svgs or {}) do
        if entry.width and entry.width:find("20vw") then
            logoSvg = entry
            break
        end
    end

    assert(logoSvg, "Logo SVG not found")

    local out = assert(io.open(outputPath, "w"))
    out:write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 248.17 286.55" width="992" height="1146">\n')
    out:write('<rect width="100%" height="100%" fill="#140608"/>\n')

    for index, item in ipairs(logoSvg.items or {}) do
        if item.d then
            local fill = { 1, 1, 1, 1 }
            if item.fill then
                fill = SvgParser.parseColor(item.fill, doc.vars) or fill
            end

            local transformAttr = ""
            if item.transform then
                transformAttr = string.format(
                    ' transform="matrix(%0.6f %0.6f %0.6f %0.6f %0.6f %0.6f)"',
                    item.transform[1],
                    item.transform[2],
                    item.transform[3],
                    item.transform[4],
                    item.transform[5],
                    item.transform[6]
                )
            end

            out:write(string.format(
                '<path d="%s"%s fill="%s" fill-rule="nonzero" data-index="%d"/>\n',
                item.d,
                transformAttr,
                rgbaToCss(fill),
                index
            ))
        end
    end

    out:write("</svg>\n")
    out:close()
end

local scriptDir = debug.getinfo(1, "S").source:match("^@(.+[\\/])")
local outputPath = (scriptDir or "./") .. "logo-svg-parser-preview.svg"
writeLogoPreview(outputPath)
print("Wrote " .. outputPath)
