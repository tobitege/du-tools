RenderScript
Introduction
RenderScript is a new technology for creating screen unit contents using Lua (also referred to as "Lua Screen Units"), rather than HTML/CSS. In general, this technology causes less performance drops in the game, while simultaneously allowing significantly more complex animated and interactive screens.

Render scripts are Lua scripts residing inside screen units that provide rendering instructions for the screen. To use RenderScript, simply switch the screen mode from 'HTML' to 'Lua' in the screen unit content editor interface, then start writing a render script. Render scripts work by building up layers of geometric shapes, images, and text, that are then rendered sequentially to the screen.

The short example script below demonstrates drawing a box and some text on the screen:

local layer = createLayer() -- create a new layer
local rx, ry = getResolution() -- get the resolution of the screen
local font = loadFont("Play", 20) -- load the "Play" font at size 20

setNextFillColor(layer, 1, 0, 0, 1) -- set the fill color (red, green, blue, alpha) for the next shape
addBox(layer, rx/4, ry/4, rx/2, ry/2) -- add a box in the center of the screen
addText(layer, font, "Hello world!", rx/3, ry/2) -- add a text string using font
RenderScript API
The following built-in functions are available for use in render scripts. Along with these API functions, RenderScript also supports most native Lua functions, except for those that pose a security risk

addBezier(layer, x1, y1, x2, y2, x3, y3)
Add a quadratic bezier curve to the given layer. Supported properties: shadow, strokeColor, strokeWidth

Argument/Return	Type	Description
layer	int	The id of the layer to which to add
x1	float	X coordinate of the first point of the curve (the starting point)
y1	float	Y coordinate of the first point of the curve (the starting point)
x2	float	X coordinate of the second point of the curve (the control point)
y2	float	Y coordinate of the second point of the curve (the control point)
x3	float	X coordinate of the third point of the curve (the ending point)
y3	float	Y coordinate of the third point of the curve (the ending point)
addBox(layer, x, y, sx, sy)
Add a box to the given layer. Supported properties: fillColor, rotation, shadow, strokeColor, strokeWidth

Argument/Return	Type	Description
layer	int	The id of the layer to which to add
x	float	X coordinate of the box's top-left corner
y	float	Y coordinate of the box's top-left corner
sx	float	Width of the box
sy	float	Height of the box
addBoxRounded(layer, x, y, sx, sy, r)
Add a rounded box to the given layer. Supported properties: fillColor, rotation, shadow, strokeColor, strokeWidth

Argument/Return	Type	Description
layer	int	The id of the layer to which to add
x	float	X coordinate of the box's top-left corner
y	float	Y coordinate of the box's top-left corner
sx	float	Width of the box
sy	float	Height of the box
r	float	Rounding radius of the box
addCircle(layer, x, y, r)
Add a circle to the given layer. Supported properties: fillColor, shadow, strokeColor, strokeWidth

Argument/Return	Type	Description
layer	int	The id of the layer to which to add
x	float	X coordinate of the circle's center
y	float	Y coordinate of the circle's center
r	float	Radius of the circle
addImage(layer, image, x, y, sx, sy)
Add an image to the given layer. Supported properties: fillColor, rotation

Argument/Return	Type	Description
layer	int	The id of the layer to which to add
image	int	The id of the image to add
x	float	X coordinate of the image's top-left corner
y	float	Y coordinate of the image's top-left corner
sx	float	Width of the image
sy	float	Height of the image
addImageSub(layer, image, x, y, sx, sy, subX, subY, subSx, subSy)
Add a sub-region of an image to the given layer. Supported properties: fillColor, rotation

Argument/Return	Type	Description
layer	int	The id of the layer to which to add
image	int	The id of the image to add
x	float	X coordinate of the image's top-left corner
y	float	Y coordinate of the image's top-left corner
sx	float	Width of the image
sy	float	Height of the image
subX	float	X coordinate of the top-left corner of the sub-region to draw
subY	float	Y coordinate of the top-left corner of the sub-region to draw
subSx	float	Width of the sub-region within the image to draw
subSy	float	Height of the sub-region within the image to draw
addLine(layer, x1, y1, x2, y2)
Add a line to the given layer. Supported properties: rotation, shadow, strokeColor, strokeWidth

Argument/Return	Type	Description
layer	int	The id of the layer to which to add
x1	float	X coordinate of the start of the line
y1	float	Y coordinate of the start of the line
x2	float	X coordinate of the end of the line
y2	float	Y coordinate of the end of the line
addQuad(layer, x1, y1, x2, y2, x3, y3, x4, y4)
Add a quadrilateral to the given layer. Supported properties: fillColor, rotation, shadow, strokeColor, strokeWidth

Argument/Return	Type	Description
layer	int	The id of the layer to which to add
x1	float	X coordinate of the first point of the quad
y1	float	Y coordinate of the first point of the quad
x2	float	X coordinate of the second point of the quad
y2	float	Y coordinate of the second point of the quad
x3	float	X coordinate of the third point of the quad
y3	float	Y coordinate of the third point of the quad
x4	float	X coordinate of the fourth point of the quad
y4	float	Y coordinate of the fourth point of the quad
addText(layer, font, text, x, y)
Add a string of text to the given layer. See setNextTextAlign for information on controlling text anchoring. Supported properties: fillColor, shadow, strokeColor, strokeWidth

Argument/Return	Type	Description
layer	int	The id of the layer to which to add
font	int	The id of the font to use
text	string	The string of text to be added
x	float	X coordinate of the text anchor
y	float	Y coordinate of the text anchor
addTriangle(layer, x1, y1, x2, y2, x3, y3)
Add a triangle to the given layer. Supported properties: fillColor, rotation, shadow, strokeColor, strokeWidth

Argument/Return	Type	Description
layer	int	The id of the layer to which to add
x1	float	X coordinate of the first point of the triangle
y1	float	Y coordinate of the first point of the triangle
x2	float	X coordinate of the second point of the triangle
y2	float	Y coordinate of the second point of the triangle
x3	float	X coordinate of the third point of the triangle
y3	float	Y coordinate of the third point of the triangle
createLayer()
Create a new layer that will be rendered on top of all previously-created layers

Argument/Return	Type	Description
return	int	The id that can be used to uniquely identify the layer for use with other API functions
getAvailableFontCount()
Return the number of fonts available to be used by render script

Argument/Return	Type	Description
return	int	The total number of fonts available
getAvailableFontName(index)
Return the name of the nth available font

Argument/Return	Type	Description
index	int	A number between 1 and the return value of getAvailableFontCount
return	string	The name of the font, which can be used with the loadFont function
getCursor()
Return the screen location that is currently raycasted by the player

Argument/Return	Type	Description
return	float, float	A tuple containing the (x, y) coordinates of the cursor, or (-1, -1) if the screen is not currently raycasted
getCursorDown()
Return the status of the mouse button

Argument/Return	Type	Description
return	boolean	True if the mouse cursor is currently pressed down on the screen, false otherwise
getCursorPressed()
Return the status of the mouse button

Argument/Return	Type	Description
return	boolean	True if the mouse cursor has been pressed down on the screen at any time since the last script execution, false otherwise
getCursorReleased()
Return the status of the mouse button

Argument/Return	Type	Description
return	boolean	True if the mouse cursor has been released on the screen at any time since the last script execution, false otherwise
getDeltaTime()
Return the time, in seconds, since the screen was last updated. Useful for creating timing-based animations. Since screens are not guaranteed to be updated at any specific time interval it is more reliable to update animations based on this timer than based on a frame counter.

Argument/Return	Type	Description
return	float	Time, in seconds, since the last screen update
getFontMetrics(font)
Return informational metrics of a font Can be used for advanced text layout, although setNextTextAlign is all that is needed in most use cases.

Argument/Return	Type	Description
font	int	The font to query
return	float, float	A tuple containing the maximal ascender and descender, respectively, of the given font
getFontSize(font)
Return the currently-set size for the given font

Argument/Return	Type	Description
font	int	The font to query
return	float	The font size in vertical pixels
getImageSize(image)
Return the width and height of an image.

Argument/Return	Type	Description
image	int	The image to query
return	float, float	A tuple containing the width and height, respectively, of the image, or (0, 0) if the image is not yet loaded
getInput()
Return the screen's current input string

Argument/Return	Type	Description
return	string	The input string, as set by the screen unit API function setScriptInput, or an empty string if there is no current input
getLocale()
Return the locale in which the game is currently running

Argument/Return	Type	Description
return	string	The locale, currently one of "en-US", "fr-FR", or "de-DE"
getRenderCost()
Return the current render cost of the script

Argument/Return	Type	Description
return	float	The cost of all rendering operations performed by the render script so far (at the time of the call to this function)
getRenderCostMax()
Return the current render cost limit

Argument/Return	Type	Description
return	float	The render cost limit. A script that exceeds this limit (in one execution) will not render correctly and will instead throw an error. Note that this value may change between version releases
getResolution()
Return the screen's current resolution. Ideally, your render scripts should be written to adapt to the resolution, as it may change in the future

Argument/Return	Type	Description
return	(int, int)	A tuple containing the (width, height) of the screen's render surface, in pixels
getTextBounds(font, text)
Compute and return the bounding box of a text string rendered with a specific font

Argument/Return	Type	Description
font	int	The font with which to render
text	string	The text string to render
return	float, float	A tuple containing the width and height, respectively, of the bounding box
getTime()
Return the time, in seconds, relative to the first execution

Argument/Return	Type	Description
return	float	Time, in seconds, since the render script started running
isImageLoaded(image)
Return the load status of an image. Note that render scripts will still render even when not all images are loaded (the call to addImage will silently fail). You can use this function to do something else instead, such as draw a placeholder or loading bar while images load

Argument/Return	Type	Description
image	int	The image to query
return	boolean	True if the image is fully loaded and ready to use, false otherwise
loadImage(url)
Load an image to be used with addImage from the given URL

Argument/Return	Type	Description
url	string	The URL of the image to be loaded; Novaquark CDN restrictions apply as usual
return	int	The id that can be used to uniquely identify the image for use with other API functions
loadFont(name, size)
Load a font to be used with addText

Argument/Return	Type	Description
name	string	The name of the font to load; see the font list section for available font names
size	int	The size, in vertical pixels, at which the font will render. Note that this size can be changed during script execution with the setFontSize function
return	int	The id that can be used to uniquely identify the font for use with other API functions
logMessage(message)
Log a message for debugging purposes. If the "enable output in Lua channel" box is checked on the editor panel for the given screen, the message will be displayed in the Lua channel, otherwise, this function does nothing. The checkbox is off by default, so you must explicitly enable this on a screen to see debug output

Argument/Return	Type	Description
message	string	The message to log, as a string
requestAnimationFrame(frames)
Request that this screen should be redrawn in a certain number of frames. A screen that requires highly-fluid animations should call requestAnimationFrame(1) before it returns. Usage of this function has a significant performance impact on the screen unit system, so scripts should try to request updates as infrequently as possible. A screen with unchanging (static) contents should not call this function at all.

Argument/Return	Type	Description
frames	int	The (approximate) number of frames after which the render script will run again and the screen will be redrawn
setBackgroundColor(r, g, b)
Set the background color of the screen

Argument/Return	Type	Description
r	float	Red component, between 0 and 1
g	float	Green component, between 0 and 1
b	float	Blue component, between 0 and 1
setDefaultFillColor(layer, shapeType, r, g, b, a)
Set the default fill color for all subsequent shapes of the given type added to the given layer

Argument/Return	Type	Description
layer	int	The layer for which the default will be set
shapeType	ShapeType	The type of shape to which the default will apply
r	float	Red component, between 0 and 1
g	float	Green component, between 0 and 1
b	float	Blue component, between 0 and 1
a	float	Alpha component, between 0 and 1
setDefaultRotation(layer, shapeType, rotation)
Set the default rotation for all subsequent shapes of the given type added to the given layer

Argument/Return	Type	Description
layer	int	The layer for which the default will be set
shapeType	ShapeType	The type of shape to which the default will apply
rotation	float	Rotation, in radians; positive is counter-clockwise, negative is clockwise
setDefaultShadow(layer, shapeType, radius, r, g, b, a)
Set the default shadow for all subsequent shapes of the given type added to the given layer

Argument/Return	Type	Description
layer	int	The layer for which the default will be set
shapeType	ShapeType	The type of shape to which the default will apply
radius	float	The distance that the shadow extends from the shape's border
r	float	Red component, between 0 and 1
g	float	Green component, between 0 and 1
b	float	Blue component, between 0 and 1
a	float	Alpha component, between 0 and 1
setDefaultStrokeColor(layer, shapeType, r, g, b, a)
Set the default stroke color for all subsequent shapes of the given type added to the given layer

Argument/Return	Type	Description
layer	int	The layer for which the default will be set
shapeType	ShapeType	The type of shape to which the default will apply
r	float	Red component, between 0 and 1
g	float	Green component, between 0 and 1
b	float	Blue component, between 0 and 1
a	float	Alpha component, between 0 and 1
setDefaultStrokeWidth(layer, shapeType, strokeWidth)
Set the default stroke width for all subsequent shapes of the given type added to the given layer

Argument/Return	Type	Description
layer	int	The layer for which the default will be set
shapeType	ShapeType	The type of shape to which the default will apply
strokeWidth	float	Stroke width, in pixels
setDefaultTextAlign(layer, alignH, alignV)
Set the default text alignment of all subsequent text strings on the given layer

Argument/Return	Type	Description
layer	int	The layer for which the default will be set
alignH	AlignH	Specifies the horizontal anchoring of a text string relative to the draw coordinates; must be one of the following built-in constants: AlignH_Left, AlignH_Center, AlignH_Right
alignV	AlignV	Specifies the vertical anchoring of a text string relative to the draw coordinates; must be one of the following built-in constants: AlignV_Ascender, AlignV_Top, AlignV_Middle, AlignV_Baseline, AlignV_Bottom, AlignV_Descender
setFontSize(font, size)
Set the size at which a font will render. Impacts all subsequent font-related calls, including addText, getFontMetrics, and getTextBounds.

Argument/Return	Type	Description
font	int	The font for which the size will be set
size	int	The new size, in vertical pixels, at which the font will render
setLayerClipRect(layer, x, y, sx, sy)
Set a clipping rectangle applied to the layer as a whole. Layer contents that fall outside the clipping rectangle will not be rendered, and those that are partially within the rectangle will be 'clipped' against it. The clipping rectangle is applied before layer transformations. Note that clipped contents still count toward the render cost.

Argument/Return	Type	Description
layer	int	The layer for which the clipping rectangle will be set
x	float	X coordinate of the clipping rectangle's top-left corner
y	float	Y coordinate of the clipping rectangle's top-left corner
sx	float	Width of the clipping rectangle
sy	float	Height of the clipping rectangle
setLayerOrigin(layer, x, y)
Set the transform origin of a layer; layer scaling and rotation are applied relative to this origin

Argument/Return	Type	Description
layer	int	The layer for which the origin will be set
x	float	X coordinate of the layer's transform origin
y	float	Y coordinate of the layer's transform origin
setLayerRotation(layer, rotation)
Set a rotation applied to the layer as a whole, relative to the layer's transform origin

Argument/Return	Type	Description
layer	int	The layer for which the rotation will be set
rotation	float	Rotation, in radians; positive is counter-clockwise, negative is clockwise
setLayerScale(layer, sx, sy)
Set a scale factor applied to the layer as a whole, relative to the layer's transform origin. Scale factors are multiplicative, so that a scale >1 enlarges the size of the layer, 1.0 does nothing, and <1 reduces the size of the layer.

Argument/Return	Type	Description
layer	int	The layer for which the scale factor will be set
sx	float	Scale factor along the X axis
sy	float	Scale factor along the Y axis
setLayerTranslation(layer, tx, ty)
Set a translation applied to the layer as a whole

Argument/Return	Type	Description
layer	int	The layer for which the translation will be set
tx	float	Translation along the X axis
ty	float	Translation along the Y axis
setNextFillColor(layer, r, g, b, a)
Set the fill color of the next rendered shape on the given layer; has no effect on shapes that do not support a fill color

Argument/Return	Type	Description
layer	int	The layer to which this property applies
r	float	Red component, between 0 and 1
g	float	Green component, between 0 and 1
b	float	Blue component, between 0 and 1
a	float	Alpha component, between 0 and 1
setNextRotation(layer, rotation)
Set the rotation of the next rendered shape on the given layer; has no effect on shapes that do not support rotation

Argument/Return	Type	Description
layer	int	The layer to which this property applies
rotation	float	Rotation, in radians; positive is counter-clockwise, negative is clockwise
setNextRotationDegrees(layer, rotation)
Set the rotation of the next rendered shape on the given layer; has no effect on shapes that do not support rotation

Argument/Return	Type	Description
layer	int	The layer to which this property applies
rotation	float	Rotation, in degrees; positive is counter-clockwise, negative is clockwise
setNextShadow(layer, radius, r, g, b, a)
Set the shadow of the next rendered shape on the given layer; has no effect on shapes that do not support a shadow

Argument/Return	Type	Description
layer	int	The layer to which this property applies
radius	float	The distance that the shadow extends from the shape's border
r	float	Red component, between 0 and 1
g	float	Green component, between 0 and 1
b	float	Blue component, between 0 and 1
a	float	Alpha component, between 0 and 1
setNextStrokeColor(layer, r, g, b, a)
Set the stroke color of the next rendered shape on the given layer; has no effect on shapes that do not support a stroke color

Argument/Return	Type	Description
layer	int	The layer to which this property applies
r	float	Red component, between 0 and 1
g	float	Green component, between 0 and 1
b	float	Blue component, between 0 and 1
a	float	Alpha component, between 0 and 1
setNextStrokeWidth(layer, strokeWidth)
Set the stroke width of the next rendered shape on the given layer; has no effect on shapes that do not support a stroke width

Argument/Return	Type	Description
layer	int	The layer to which this property applies
strokeWidth	float	Stroke width, in pixels
setNextTextAlign(layer, alignH, alignV)
Set the text alignment of the next rendered text string on the given layer. By default, text is anchored horizontally on the left, and vertically on the baseline

Argument/Return	Type	Description
layer	int	The layer to which this property applies
alignH	AlignH	Specifies the horizontal anchoring of a text string relative to the draw coordinates; must be one of the following built-in constants: AlignH_Left, AlignH_Center, AlignH_Right
alignV	AlignV	Specifies the vertical anchoring of a text string relative to the draw coordinates; must be one of the following built-in constants: AlignV_Ascender, AlignV_Top, AlignV_Middle, AlignV_Baseline, AlignV_Bottom, AlignV_Descender
setOutput(output)
Set the script's output string, which can be retrieved via a programming board with the screen unit API function getScriptOutput

Argument/Return	Type	Description
output	string	The output string
Animation
It is entirely possible to create animated screens with RenderScript; in fact, the technology really shines for complex animations, where the performance of HTML/CSS is generally low.

Animations are made possible by using the requestAnimationFrame(frames) function to force the script to re-run in some number of frames, then changing the positioning of geometry within the layers, based on some variable such as time. Effectively, you will simply draw one frame of your animation at a time, but since RenderScript is fast enough to execute at 60 frames per second, the result will look smooth.

The minimal example script below demonstrates using the getTime function to animate the location of a circle on the screen:

local layer = createLayer()
local rx, ry = getResolution()
local t = getTime()
local r = math.min(rx/4, ry/4)
local x = rx/2 + r * math.cos(t)
local y = ry/2 + r * math.sin(t)

addCircle(layer, x, y, 16)
requestAnimationFrame(1)
Coordinate Space
All render script coordinates are in screen pixels, ranging from (0, 0) at the top-left of the screen, to (width, height) at the bottom-right. The width and height of the screen in pixels can be retrieved by calling getResolution.

For maximal robustness, scripts should be written so as to adapt to the resolution, as screens with different sizes or aspect ratios will use different display resolutions.

Fonts
The fonts available for use with the loadFont function are limited to a preset number. You can query this list programmatically using the getAvailableFontCount and getAvailableFontName functions.

Below is a list of the current font selection:

"BankGothic"
"BankGothic-Light"
"BankGothic-Medium"
"DatDot"
"DatDot-Light"
"DatDot-Bold"
"Dosis"
"Dosis-Light"
"Dosis-Bold"
"E1234"
"FiraMono"
"FiraMono-Bold"
"HelpMe"
"Indoscreen"
"LinuxLibertine"
"LinuxLibertine-Bold"
"LinuxLibertine-Italic"
"Montserrat"
"Montserrat-Thin"
"Montserrat-Light"
"Montserrat-ExtraLight"
"Montserrat-ExtraLightItalic"
"Montserrat-Bold"
"Montserrat-SemiBold"
"Montserrat-BoldItalic"
"Ontel"
"Oxanium"
"Oxanium-Light"
"Oxanium-Medium"
"Oxanium-Bold"
"Play"
"Play-Bold"
"RefrigeratorDeluxe"
"RefrigeratorDeluxe-Light"
"RobotoCondensed"
"RobotoMono"
"RobotoMono-Bold"
"TurretRoad"
"TurretRoad-Light"
"TurretRoad-Medium"
"TurretRoad-Bold"
Render Cost
Since render script is intended to solve screen unit performance problems, we impose relatively harsh restrictions on content compared to HTML. This does not mean you aren't able to create amazing, detailed, high-framerate screen content; it just means that youâ€™ll need to be aware of the budgeting mechanism.

Any render script call that draws a shape (box, circle, line, text..) adds to a cost metric that consumes some of the screenâ€™s total rendering budget. Although the exact cost metric is subject to change, roughly-speaking, the render cost incurred by any shape is proportional to the screen-space area of the shape, plus a constant factor. This means that a box of dimension 16 x 16 consumes roughly four times as much render cost as a box of 8 x 8. This is intuitive when you consider that the number of pixels filled by the larger box is four times that of the smaller box.

For most render scripts, it is unlikely that the maximum cost will ever be exceeded, so most users probably donâ€™t need to worry too much about this mechanism. However, drawing lots of large text or lots of large, overlapping images may cause you to exceed the budget.

To learn more about your script's usage of this budget, use the built-in API functions getRenderCost and getRenderCostMax. getRenderCost can be called at any point during a render script to see how much all the contents added so far cost.

Below is an example of how to add a simple render cost profiler to your screen so that you can see cost information in real-time:

local rx, ry = getResolution()
local layer = createLayer()
local font = loadFont('FiraMono-Bold', 16)
local text = string.format('render cost: %d / %d', getRenderCost(), getRenderCostMax())
setNextFillColor(layer, 1, 1, 1, 1)
setNextTextAlign(layer, AlignH_Left, AlignV_Descender)
addText(layer, font, text, 16, ry - 8)
Render Order
You should use layers when you need explicit control over the top-to-bottom ordering of rendered elements. As stated in the createLayer documentation, each layer created within a script will be rendered on top of the previous layer, such that the first layer created appears at the bottom. In contrast, the last layer created appears at the top.

Shapes that live on the same layer do not offer as much control. Among the same type of shape, instances rendered later will appear on top of those rendered before. So if you add two boxes to a layer, the last box added will appear on top. However, the situation is more complex when mixing different shapes. For rendering efficiency, all instances of a shape type on the same layer are drawn at the same time. This means that all instances of one shape will appear below or above all instances of other shapes, regardless of the relative order in which they were added to the layer. Currently, the ordering is as follows, from top to bottom:

Text
Quads
Triangles
Lines
Circles
Rounded Boxes
Boxes
Beziers
Images
Thus, all boxes will always render below all circles on the same layer, and text on the same layer will appear on top of both. It is not possible to control this behavior, nor is it a good idea to rely on it, as it is subject to change. If you need to rely on something appearing in front of something else, you should use multiple layers.

ShapeType List
The following built-in constants can be used with the setDefault* functions to specify a shape type:

Shape_Bezier
Shape_Box
Shape_BoxRounded
Shape_Circle
Shape_Image
Shape_Line
Shape_Polygon
Shape_Text