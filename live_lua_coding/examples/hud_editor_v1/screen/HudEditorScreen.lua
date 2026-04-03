-- HudEditorScreen.lua
-- Stable linked-screen runtime for the HUD editor board flow.
-- The board sends the current compact layout document through setScriptInput(...).

local D=nil
local DI=nil
local DE=""
local DW=0
local F={}

local function G(s)
    s=math.max(1,math.floor(tonumber(s) or 16))
    local f=F[s]
    if not f then
        f=loadFont("Play",s)
        F[s]=f
    end
    return f
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

local function TX(l,e,sc,sx,sy)
    local lines=e.l
    if not lines or #lines==0 then
        return
    end
    local s=math.max(1,math.floor((tonumber(e.ts) or 16)*sc+0.5))
    local f=G(s)
    if not f then
        return
    end
    local a=e.ta or "left"
    local x=SX(e.x,sx)+12*sc
    local h=AlignH_Left
    local w=SX(e.w,sx)
    if a=="center" then
        x=SX(e.x,sx)+w*0.5
        h=AlignH_Center
    elseif a=="right" then
        x=SX(e.x,sx)+w-12*sc
        h=AlignH_Right
    end
    setNextTextAlign(l,h,AlignV_Middle)
    local g=math.max(2,math.floor(s*0.2))
    local y=SX(e.y,sy)+SX(e.h,sy)*0.5-((#lines-1)*(s+g))*0.5
    local c=e.tc or {1,1,1,1}
    for i=1,#lines do
        FC(l,c,{1,1,1,1})
        addText(l,f,tostring(lines[i] or ""),x,y+(i-1)*(s+g))
    end
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

for i=1,#(doc.e or {}) do
    local e=doc.e[i]
    if e and e.v~=false then
        local l=createLayer()
        local t=e.t or "box"
        if t=="text" then
            TX(l,e,sc,sx,sy)
        elseif t=="line" then
            SC(l,e.s,{1,1,1,1})
            setNextStrokeWidth(l,math.max(1,(tonumber(e.sw) or 2)*sc))
            local x=SX(e.x,sx)
            local y=SX(e.y,sy)
            addLine(l,x,y,x+SX(e.w,sx),y+SX(e.h,sy))
            TX(l,e,sc,sx,sy)
        else
            FC(l,e.f,{0.2,0.2,0.2,1})
            SC(l,e.s,{1,1,1,1})
            setNextStrokeWidth(l,math.max(0,(tonumber(e.sw) or 0)*sc))
            local x=SX(e.x,sx)
            local y=SX(e.y,sy)
            local w=SX(e.w,sx)
            local h=SX(e.h,sy)
            if t=="circle" then
                addCircle(l,x+w*0.5,y+h*0.5,math.min(w,h)*0.5)
            elseif t=="boxRounded" then
                addBoxRounded(l,x,y,w,h,math.max(0,(tonumber(e.r) or 0)*sc))
            else
                addBox(l,x,y,w,h)
            end
            TX(l,e,sc,sx,sy)
        end
    end
end
