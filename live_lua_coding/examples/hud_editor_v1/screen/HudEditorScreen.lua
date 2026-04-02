-- HudEditorScreen.lua
-- Reference top-level RenderScript template for linked screens.
-- Actual layout-specific code is generated from the currently loaded document.

local D={
    w=1920,
    h=1080,
    e={}
}

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

local function TX(l,e)
    local lines=e.l
    if not lines or #lines==0 then
        return
    end
    local s=math.max(1,math.floor(tonumber(e.ts) or 16))
    local f=G(s)
    if not f then
        return
    end
    local a=e.ta or "left"
    local x=(tonumber(e.x) or 0)+12
    local h=AlignH_Left
    local w=tonumber(e.w) or 0
    if a=="center" then
        x=(tonumber(e.x) or 0)+w*0.5
        h=AlignH_Center
    elseif a=="right" then
        x=(tonumber(e.x) or 0)+w-12
        h=AlignH_Right
    end
    setNextTextAlign(l,h,AlignV_Middle)
    local g=math.max(2,math.floor(s*0.2))
    local y=(tonumber(e.y) or 0)+(tonumber(e.h) or 0)*0.5-((#lines-1)*(s+g))*0.5
    local c=e.tc or {1,1,1,1}
    for i=1,#lines do
        FC(l,c,{1,1,1,1})
        addText(l,f,tostring(lines[i] or ""),x,y+(i-1)*(s+g))
    end
end

setBackgroundColor(0,0,0)

for i=1,#(D.e or {}) do
    local e=D.e[i]
    if e and e.v~=false then
        local l=createLayer()
        local t=e.t or "box"
        if t=="text" then
            TX(l,e)
        elseif t=="line" then
            SC(l,e.s,{1,1,1,1})
            setNextStrokeWidth(l,tonumber(e.sw) or 2)
            local x=tonumber(e.x) or 0
            local y=tonumber(e.y) or 0
            addLine(l,x,y,x+(tonumber(e.w) or 0),y+(tonumber(e.h) or 0))
            TX(l,e)
        else
            FC(l,e.f,{0.2,0.2,0.2,1})
            SC(l,e.s,{1,1,1,1})
            setNextStrokeWidth(l,tonumber(e.sw) or 0)
            local x=tonumber(e.x) or 0
            local y=tonumber(e.y) or 0
            local w=tonumber(e.w) or 0
            local h=tonumber(e.h) or 0
            if t=="circle" then
                addCircle(l,x+w*0.5,y+h*0.5,math.min(w,h)*0.5)
            elseif t=="boxRounded" then
                addBoxRounded(l,x,y,w,h,tonumber(e.r) or 0)
            else
                addBox(l,x,y,w,h)
            end
            TX(l,e)
        end
    end
end
