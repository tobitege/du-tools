-- HudEditorScreen.lua
-- Stable linked-screen runtime for the HUD editor board flow.
-- The board sends the current compact layout document through setScriptInput(...).

local D=nil
local DI=nil
local DE=""
local DW=0
local F={}
local I={}

local function G(s)
    s=math.max(1,math.floor(tonumber(s) or 16))
    local f=F[s]
    if not f then
        f=loadFont("Play",s)
        F[s]=f
    end
    return f
end

local function IM(path)
    if type(path)~="string" or path=="" then
        return nil
    end
    local image=I[path]
    if not image then
        image=loadImage(path)
        I[path]=image
    end
    return image
end

local function FC(l,c,d)
    c=c or d
    setNextFillColor(l,tonumber(c[1]) or d[1],tonumber(c[2]) or d[2],tonumber(c[3]) or d[3],tonumber(c[4]) or d[4])
end

local function SC(l,c,d)
    c=c or d
    setNextStrokeColor(l,tonumber(c[1]) or d[1],tonumber(c[2]) or d[2],tonumber(c[3]) or d[3],tonumber(c[4]) or d[4])
end

local function P(raw)
    if type(raw)~="string" or raw=="" then
        return nil,"no_input"
    end
    local loader,err=load("return "..raw,"@HudEditorScreenInput","t",{})
    if not loader then
        return nil,err
    end
    local ok,val=pcall(loader)
    if not ok then
        return nil,val
    end
    if type(val)~="table" then
        return nil,"bad_input_type"
    end
    return val,nil
end

local function RD()
    local raw=""
    if type(getInput)=="function" then
        local val=getInput()
        if type(val)=="string" then
            raw=val
        end
    end
    if raw~=DI then
        DI=raw
        local doc,err=P(raw)
        D=doc
        DE=doc and "" or tostring(err or "input_error")
    end
    return D,DE,raw
end

local function SX(v,s)
    return (tonumber(v) or 0)*s
end

local function ST(l,c,sc)
    local r=tonumber(c.rot) or 0
    if r~=0 then
        setNextRotation(l,r)
    end
    local sh=c.sh
    local sca=sh and sh.c or nil
    local blur=sh and tonumber(sh.b) or 0
    if sca and blur and blur>0 then
        setNextShadow(
            l,
            math.max(0, blur*sc),
            tonumber(sca[1]) or 0,
            tonumber(sca[2]) or 0,
            tonumber(sca[3]) or 0,
            tonumber(sca[4]) or 0
        )
    end
end

local function TX(l,c,sc,sx,sy)
    local lines=c.l
    if not lines or #lines==0 then
        return
    end
    ST(l,c,sc)
    SC(l,c.s,{0,0,0,0})
    setNextStrokeWidth(l,math.max(0,(tonumber(c.sw) or 0)*sc))
    local s=math.max(1,math.floor((tonumber(c.ts) or 16)*sc+0.5))
    local f=G(s)
    if not f then
        return
    end
    local a=c.ta or "left"
    local va=c.tv or "center"
    local x=SX(c.x,sx)+12*sc
    local h=AlignH_Left
    local v=AlignV_Middle
    local w=SX(c.w,sx)
    if a=="center" then
        x=SX(c.x,sx)+w*0.5
        h=AlignH_Center
    elseif a=="right" then
        x=SX(c.x,sx)+w-12*sc
        h=AlignH_Right
    end
    if va=="top" then
        v=AlignV_Top
    elseif va=="bottom" then
        v=AlignV_Bottom
    end
    setNextTextAlign(l,h,v)
    local g=math.max(2,math.floor(s*0.2))
    local blockHeight=#lines*s+(#lines-1)*g
    local y=SX(c.y,sy)+SX(c.h,sy)*0.5-(blockHeight-s)*0.5
    if va=="top" then
        y=SX(c.y,sy)+12*sc
    elseif va=="bottom" then
        y=SX(c.y,sy)+SX(c.h,sy)-12*sc-(blockHeight-s)
    end
    local tc=c.tc or {1,1,1,1}
    for i=1,#lines do
        FC(l,tc,{1,1,1,1})
        addText(l,f,tostring(lines[i] or ""),x,y+(i-1)*(s+g))
    end
end

local function SH(l,c,sc,sx,sy)
    ST(l,c,sc)
    FC(l,c.f,{0.2,0.2,0.2,1})
    SC(l,c.s,{1,1,1,1})
    setNextStrokeWidth(l,math.max(0,(tonumber(c.sw) or 0)*sc))
    local x=SX(c.x,sx)
    local y=SX(c.y,sy)
    local w=SX(c.w,sx)
    local h=SX(c.h,sy)
    local k=c.k or "box"
    if k=="circle" then
        addCircle(l,x+w*0.5,y+h*0.5,math.min(w,h)*0.5)
    elseif k=="boxRounded" then
        addBoxRounded(l,x,y,w,h,math.max(0,(tonumber(c.r) or 0)*sc))
    elseif k=="triangle" then
        addTriangle(l,x,y,x+w,y,x,y+h)
    elseif k=="quad" then
        local qi=tonumber(c.qi) or 0.125
        addQuad(l,x,y,x+w*(1-qi),y+h*qi,x+w,y+h,x+w*qi,y+h*(1-qi))
    else
        addBox(l,x,y,w,h)
    end
end

local function BZ(l,c,sc,sx,sy)
    ST(l,c,sc)
    SC(l,c.s,{1,1,1,1})
    setNextStrokeWidth(l,math.max(1,(tonumber(c.sw) or 2)*sc))
    local x=SX(c.x,sx)
    local y=SX(c.y,sy)
    local w=SX(c.w,sx)
    local h=SX(c.h,sy)
    addBezier(l,x,y+h,x+w*0.5,y,x+w,y+h)
end

local function LN(l,c,sc,sx,sy)
    ST(l,c,sc)
    SC(l,c.s,{1,1,1,1})
    setNextStrokeWidth(l,math.max(1,(tonumber(c.sw) or 2)*sc))
    local x=SX(c.x,sx)
    local y=SX(c.y,sy)
    addLine(l,x,y,x+SX(c.w,sx),y+SX(c.h,sy))
end

local function IG(l,c,sc,sx,sy)
    ST(l,c,sc)
    local image=IM(c.src)
    if not image then
        return
    end
    addImage(l,image,SX(c.x,sx),SX(c.y,sy),SX(c.w,sx),SX(c.h,sy))
end

local function ER(rx,ry,msg)
    local l=createLayer()
    FC(l,{0.1,0.1,0.12,1},{0.1,0.1,0.12,1})
    addBoxRounded(l,24,24,math.max(80,rx-48),math.max(80,ry-48),20)
    SC(l,{0.92,0.28,0.28,1},{0.92,0.28,0.28,1})
    setNextStrokeWidth(l,2)
    addBoxRounded(l,24,24,math.max(80,rx-48),math.max(80,ry-48),20)
    FC(l,{1,0.85,0.85,1},{1,0.85,0.85,1})
    setNextTextAlign(l,AlignH_Center,AlignV_Middle)
    addText(l,G(math.max(14,math.floor(math.min(rx,ry)*0.05))),tostring(msg or "SCREEN INPUT ERROR"),rx*0.5,ry*0.5)
end

local rx,ry=getResolution()
setBackgroundColor(0,0,0)

local doc,err,raw=RD()
if not doc then
    ER(rx,ry,raw=="" and "HUD EDITOR: NO INPUT" or "HUD EDITOR: INPUT ERROR")
    if raw=="" and type(requestAnimationFrame)=="function" then
        DW=(DW or 0)+1
        if DW<=10 then
            requestAnimationFrame(1)
        end
    else
        DW=0
    end
    return
end

DW=0
local dw=math.max(1,tonumber(doc.w) or rx)
local dh=math.max(1,tonumber(doc.h) or ry)
local sx=rx/dw
local sy=ry/dh
local sc=math.min(sx,sy)

for i=1,#(doc.c or {}) do
    local c=doc.c[i]
    if c then
        local l=createLayer()
        local op=c.o or "shape"
        if op=="text" then
            TX(l,c,sc,sx,sy)
        elseif op=="line" then
            LN(l,c,sc,sx,sy)
        elseif op=="bezier" then
            BZ(l,c,sc,sx,sy)
        elseif op=="image" then
            IG(l,c,sc,sx,sy)
        else
            SH(l,c,sc,sx,sy)
        end
    end
end
