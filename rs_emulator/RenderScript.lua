local Vec2 = require("native/Vec2")

---@enum RSShape
RSShape = {
    Bezier = 0,
    Box = 1,
    BoxRounded = 2,
    Circle = 3,
    Image = 4,
    Line = 5,
    Polygon = 6,
    Text = 7,
}

---@class Render
---@field AddBezier fun(layer:integer, x1:number, y1:number, x2:number, y2:number, x3:number, y3:number)
---@field AddBox fun(layer:integer, x:number, y:number, width:number, height:number)
---@field AddBoxRounded fun(layer:integer, x:number, y:number, width:number, height:number, radius:number)
---@field AddCircle fun(layer:integer, x:number, y:number, radius:number)
---@field AddImage fun(layer:integer, image:integer, x:number, y:number, width:number, height:number)
---@field AddImageSub fun(layer:integer, image:integer, x:number, y:number, width:number, height:number, subX:number, subY:number, subWidth:number, subHeight:number)
---@field AddLine fun(layer:integer, x1:number, y1:number, x2:number, y2:number)
---@field AddQuad fun(layer:integer, x1:number, y1:number, x2:number, y2:number, x3:number, y3:number, x4:number, y4:number)
---@field AddText fun(layer:integer, font:FontHandle, text:string, x:number, y:number)
---@field AddTriangle fun(layer:integer, x1:number, y1:number, x2:number, y2:number, x3:number, y3:number)
---@field CreateLayer fun():integer
---@field GetAvailableFontCount fun():integer
---@field GetAvailableFontName fun(index):string
---@field GetCursor fun():number,number Returns a tuple containing the (x, y) coordinates of the cursor, or (-1, -1) if the screen is not currently raycasted
---@field GetCursorDown fun():boolean True if the mouse cursor is currently pressed down on the screen, false otherwise
---@field GetCursorPressed fun():boolean True if the mouse cursor has been pressed down on the screen at any time since the last script execution, false otherwise
---@field GetCursorReleased fun():boolean True if the mouse cursor has been released on the screen at any time since the last script execution, false otherwise
---@field GetDeltaTime fun():number Return the time, in seconds, since the screen was last updated.
---@field GetFontMetrics fun(font:integer):number,number A tuple containing the maximal ascender and descender, respectively, of the given font
---@field GetFontSize fun(font:integer):number The font size in vertical pixels
---@field GetImageSize fun(image:integer):number,number A tuple containing the width and height, respectively, of the image, or (0, 0) if the image is not yet loaded
---@field GetInput fun():string The input string, as set by the screen unit API function setScriptInput, or an empty string if there is no current input
---@field GetLocale fun():string The locale, currently one of "en-US", "fr-FR", or "de-DE"
---@field GetRenderCost fun():number The cost of all rendering operations performed by the render script so far (at the time of the call to this function)
---@field GetRenderCostMax fun():number The render cost limit. A script that exceeds this limit (in one execution) will not render correctly and will instead throw an error. Note that this value may change between version releases
---@field GetResolution fun():number,number A tuple containing the (width, height) of the screen's render surface, in pixels
---@field GetTextBounds fun(font:LoadedFont, text:string):Vec2 A tuple containing the width and height, respectively, of the bounding box
---@field GetTime fun():number Time, in seconds, since the render script started running
---@field IsImageLoaded fun(image:integer):boolean True if the image is fully loaded and ready to use, false otherwise
---@field LoadImage fun(url:string):integer Load an image to be used with addImage from the given URL
---@field LoadFont fun(name:string, size:integer):integer Load a font to be used with addText
---@field Log fun(message:string) Log a message for debugging purposes. If the "enable output in Lua channel" box is checked on the editor panel for the given screen, the message will be displayed in the Lua channel.
---@field RequestAnimationFrame fun(frames:integer) Request that this screen should be redrawn in a certain number of frames. A screen that requires highly-fluid animations should call requestAnimationFrame(1) before it returns.
---@field SetBackgroundColor fun(red:number, green:number, blue:number) Set the background color of the screen
---@field SetDefaultFillColor fun(layer:integer, shape:RSShape, red:number, green:number, blue:number, alpha:number) Set the default fill color for all subsequent shapes of the given type added to the given layer
---@field SetDefaultRotation fun(layer:integer, shape:RSShape, rotationRad:number) Set the default rotation for all subsequent shapes of the given type added to the given layer in radians; positive is counter-clockwise, negative is clockwise
---@field SetDefaultShadow fun(layer:integer, shape:RSShape, radius:number, red:number, green:number, blue:number, alpha:number) Set the default shadow for all subsequent shapes of the given type added to the given layer
---@field SetDefaultStrokeColor fun(layer:integer, shape:RSShape, red:number, green:number, blue:number, alpha:number) Set the default stroke color for all subsequent shapes of the given type added to the given layer
---@field SetDefaultStrokeWidth fun(layer:integer, shape:RSShape, strokeWidth:number)  Set the default stroke width for all subsequent shapes of the given type added to the given layer
---@field SetDefaultTextAlign fun(layer:integer, hor:RSAlignHor, ver:RSAlignVer) Set the default text alignment of all subsequent text strings on the given layer
---@field SetFontSize fun(font:integer, size:integer) Set the size at which a font will render.
---@field SetLayerClipRect fun(layer:integer, x:number, y:number, width:number, height:number) Set a clipping rectangle applied to the layer as a whole.
---@field SetLayerOrigin fun(layer:integer, x:number, y:number) Set the transform origin of a layer; layer scaling and rotation are applied relative to this origin
---@field SetLayerRotation fun(layer:integer, rotationRad:number) Set a rotation applied to the layer as a whole, relative to the layer's transform origin
---@field SetLayerScale fun(layer:integer, widthScale:number, hightScale:number) Set a scale factor applied to the layer as a whole, relative to the layer's transform origin.
---@field SetLayerTranslation fun(layer:integer, tx:number, ty:number) Set a translation applied to the layer as a whole
---@field SetNextFillColor fun(layer:integer, red:number, green:number, blue:number, alpha:number) Set the fill color of the next rendered shape on the given layer; has no effect on shapes that do not support a fill color
---@field SetNextRotation fun(layer:integer, rotationRad:number) Set the rotation of the next rendered shape on the given layer; has no effect on shapes that do not support rotation, in radians; positive is counter-clockwise, negative is clockwise
---@field SetNextRotationDegrees fun(layer:integer, rotationDeg:number) Set the rotation of the next rendered shape on the given layer; has no effect on shapes that do not support rotation, in degrees; positive is counter-clockwise, negative is clockwise
---@field SetNextShadow fun(layer:integer, radius, red:number, green:number, blue:number, alpha:number) Set the shadow of the next rendered shape on the given layer; has no effect on shapes that do not support a shadow
---@field SetNextStrokeColor fun(layer:integer, red:number, green:number, blue:number, alpha:number) Set the stroke color of the next rendered shape on the given layer; has no effect on shapes that do not support a stroke color
---@field SetNextStrokeWidth fun(layer:integer, strokeWidth:integer) Set the stroke width of the next rendered shape on the given layer; has no effect on shapes that do not support a stroke width
---@field SetNextTextAlign fun(layer:integer, hor:RSAlignHor, ver:RSAlignVer) Set the text alignment of the next rendered text string on the given layer. By default, text is anchored horizontally on the left, and vertically on the baseline.
---@field SetOutput fun(output:string) Set the script's output string, which can be retrieved via a programming board with the screen unit API function getScriptOutput
local RenderScript = {}
RenderScript.__index = _ENV

---@type Render
local singelton


---Gets the RenderScript instance
---@return Render
function RenderScript.Instance()
    if singelton then
        return singelton
    end

    local loadedImages = {} ---@type table<string, integer>

    --- RenderScript functions are all in the global namespace so bind to them.
    singelton = {
        AddBezier = _ENV.addBezier,
        AddBox = _ENV.addBox,
        AddBoxRounded = _ENV.addBoxRounded,
        AddCircle = _ENV.addCircle,
        AddImage = _ENV.addImage,
        AddImageSub = _ENV.addImageSub,
        AddLine = _ENV.addLine,
        AddQuad = _ENV.addQuad,
        AddText = _ENV.addText,
        AddTriangle = _ENV.addTriangle,
        CreateLayer = _ENV.createLayer,
        GetAvailableFontCount = _ENV.getAvailableFontCount,
        GetAvailableFontName = _ENV.getAvailableFontName,
        GetCursor = _ENV.getCursor,
        GetCursorDown = _ENV.getCursorDown,
        GetCursorPressed = _ENV.getCursorPressed,
        GetCursorReleased = _ENV.getCursorReleased,
        GetDeltaTime = _ENV.getDeltaTime,
        GetFontMetrics = _ENV.getFontMetrics,
        GetFontSize = _ENV.getFontSize,
        GetImageSize = _ENV.getImageSize,
        GetInput = _ENV.getInput,
        GetLocale = _ENV.getLocale,
        GetRenderCost = _ENV.getRenderCost,
        GetRenderCostMax = _ENV.getRenderCostMax,
        GetResolution = _ENV.getResolution,
        ---@param font LoadedFont
        ---@param text string
        ---@return Vec2
        GetTextBounds = function(font, text)
            return Vec2.New(_ENV.getTextBounds(font.GetID(), text or ""))
        end,
        GetTime = _ENV.getTime,
        IsImageLoaded = _ENV.isImageLoaded,
        ---@param url string
        LoadImage = function(url)
            local existing = loadedImages[url]
            if existing then
                return existing
            else
                local id = _ENV.loadImage(url)
                loadedImages[url] = id
                return id
            end
        end,
        LoadFont = _ENV.loadFont,
        Log = _ENV.logMessage,
        ---@param frames integer
        RequestAnimationFrame = function(frames)
            _ENV.requestAnimationFrame(frames)
            loadedImages = {} -- images needs to be reloaded each frame
        end,
        SetBackgroundColor = _ENV.setBackgroundColor,
        SetDefaultFillColor = _ENV.setDefaultFillColor,
        SetDefaultRotation = _ENV.setDefaultRotation,
        SetDefaultShadow = _ENV.setDefaultShadow,
        SetDefaultStrokeColor = _ENV.setDefaultStrokeColor,
        SetDefaultStrokeWidth = _ENV.setDefaultStrokeWidth,
        SetDefaultTextAlign = _ENV.setDefaultTextAlign,
        SetFontSize = _ENV.setFontSize,
        SetLayerClipRect = _ENV.setLayerClipRect,
        SetLayerOrigin = _ENV.setLayerOrigin,
        SetLayerRotation = _ENV.setLayerRotation,
        SetLayerScale = _ENV.setLayerScale,
        SetLayerTranslation = _ENV.setLayerTranslation,
        SetNextFillColor = _ENV.setNextFillColor,
        SetNextRotation = _ENV.setNextRotation,
        SetNextRotationDegrees = _ENV.setNextRotationDegrees,
        SetNextShadow = _ENV.setNextShadow,
        SetNextStrokeColor = _ENV.setNextStrokeColor,
        SetNextStrokeWidth = _ENV.setNextStrokeWidth,
        SetNextTextAlign = _ENV.setNextTextAlign,
        SetOutput = _ENV.setOutput
    }

    setmetatable(singelton, RenderScript)
    return singelton
end

return RenderScript
