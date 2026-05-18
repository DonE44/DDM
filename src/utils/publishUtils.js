/**
 * publishUtils.js — FluxAura Studio Publish Engine
 *
 * Exports:
 *   buildPlayerHtml(pages, stage, projectVars, opts)  -> HTML string (full featured player)
 *   exportAsHtml(pages, stage, projectVars, opts)     -> downloads .html
 *   exportAsMmp(pages, stage, projectVars, opts)      -> downloads .mmp (AES-256 encrypted ZIP)
 *   exportAsZip(pages, stage, projectVars, opts)      -> downloads .zip (unencrypted bundle)
 *   importProjectPages(fileOrText)                    -> Promise<SmmPage[]>
 */

import { parseMME } from './scaUtils.js'

// ─── Animation CSS (mirrored from App.css) ───────────────────────────────────

const ANIM_CSS = `
@keyframes smm-fade-in { from{opacity:0} to{opacity:1} }
@keyframes smm-fly-left { from{transform:translateX(-120%);opacity:0} to{transform:translateX(0);opacity:1} }
@keyframes smm-fly-right { from{transform:translateX(120%);opacity:0} to{transform:translateX(0);opacity:1} }
@keyframes smm-fly-top { from{transform:translateY(-120%);opacity:0} to{transform:translateY(0);opacity:1} }
@keyframes smm-fly-bottom { from{transform:translateY(120%);opacity:0} to{transform:translateY(0);opacity:1} }
@keyframes smm-zoom-in { from{transform:scale(.05);opacity:0} 60%{opacity:1} to{transform:scale(1);opacity:1} }
@keyframes smm-zoom-big { from{transform:scale(2.8);opacity:0} 60%{opacity:1} to{transform:scale(1);opacity:1} }
@keyframes smm-spiral-in { from{transform:rotate(-720deg) scale(.05);opacity:0} 70%{opacity:1} to{transform:rotate(0) scale(1);opacity:1} }
@keyframes smm-bounce-in { 0%{transform:scale(0);opacity:0} 55%{transform:scale(1.18);opacity:1} 72%{transform:scale(.9)} 87%{transform:scale(1.07)} 95%{transform:scale(.97)} 100%{transform:scale(1);opacity:1} }
@keyframes smm-flip-x { from{transform:perspective(800px) rotateX(-90deg);opacity:0} 50%{opacity:1} to{transform:perspective(800px) rotateX(0);opacity:1} }
@keyframes smm-flip-y { from{transform:perspective(800px) rotateY(-90deg);opacity:0} 50%{opacity:1} to{transform:perspective(800px) rotateY(0);opacity:1} }
@keyframes smm-rotate-in { from{transform:rotate(-270deg) scale(.3);opacity:0} 70%{opacity:1} to{transform:rotate(0) scale(1);opacity:1} }
@keyframes smm-drop-in { 0%{transform:translateY(-160%) scaleY(.6);opacity:0} 60%{transform:translateY(8%) scaleY(1.04);opacity:1} 78%{transform:translateY(-4%)} 90%{transform:translateY(3%)} 100%{transform:translateY(0);opacity:1} }
@keyframes smm-swipe-left { from{transform:translateX(110%) skewX(-8deg);opacity:0} 80%{transform:translateX(4%) skewX(0);opacity:1} to{transform:translateX(0);opacity:1} }
@keyframes smm-swipe-right { from{transform:translateX(-110%) skewX(8deg);opacity:0} 80%{transform:translateX(-4%) skewX(0);opacity:1} to{transform:translateX(0);opacity:1} }
@keyframes smm-roll-left { from{transform:translateX(110%) rotate(360deg);opacity:0} 70%{opacity:1} to{transform:translateX(0) rotate(0);opacity:1} }
@keyframes smm-typewriter { from{clip-path:inset(0 100% 0 0);opacity:1} to{clip-path:inset(0 0% 0 0);opacity:1} }
@keyframes smm-fade-out { from{opacity:1} to{opacity:0} }
@keyframes smm-fly-left-out { from{transform:translateX(0);opacity:1} to{transform:translateX(-120%);opacity:0} }
@keyframes smm-fly-right-out { from{transform:translateX(0);opacity:1} to{transform:translateX(120%);opacity:0} }
@keyframes smm-fly-top-out { from{transform:translateY(0);opacity:1} to{transform:translateY(-120%);opacity:0} }
@keyframes smm-fly-bottom-out { from{transform:translateY(0);opacity:1} to{transform:translateY(120%);opacity:0} }
@keyframes smm-zoom-out { from{transform:scale(1);opacity:1} 40%{opacity:.8} to{transform:scale(.05);opacity:0} }
@keyframes smm-zoom-big-out { from{transform:scale(1);opacity:1} 40%{opacity:.6} to{transform:scale(2.8);opacity:0} }
@keyframes smm-spiral-out { from{transform:rotate(0) scale(1);opacity:1} 30%{opacity:.8} to{transform:rotate(720deg) scale(.05);opacity:0} }
@keyframes smm-flip-x-out { from{transform:perspective(800px) rotateX(0);opacity:1} 50%{opacity:.3} to{transform:perspective(800px) rotateX(90deg);opacity:0} }
@keyframes smm-flip-y-out { from{transform:perspective(800px) rotateY(0);opacity:1} 50%{opacity:.3} to{transform:perspective(800px) rotateY(90deg);opacity:0} }
@keyframes smm-rotate-out { from{transform:rotate(0) scale(1);opacity:1} 30%{opacity:.8} to{transform:rotate(270deg) scale(.3);opacity:0} }
@keyframes smm-swipe-left-out { from{transform:translateX(0) skewX(0);opacity:1} to{transform:translateX(-110%) skewX(8deg);opacity:0} }
@keyframes smm-swipe-right-out { from{transform:translateX(0) skewX(0);opacity:1} to{transform:translateX(110%) skewX(-8deg);opacity:0} }
@keyframes smm-loop-pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
@keyframes smm-loop-zoom-pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.15)} }
@keyframes smm-loop-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
@keyframes smm-loop-shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-6px)} 40%{transform:translateX(6px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }
@keyframes smm-loop-wiggle { 0%,100%{transform:rotate(0deg)} 25%{transform:rotate(-5deg)} 75%{transform:rotate(5deg)} }
@keyframes smm-loop-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
@keyframes smm-loop-neon-flicker { 0%,100%{opacity:1} 8%{opacity:.6} 10%{opacity:1} 20%{opacity:.4} 22%{opacity:1} 55%{opacity:1} 57%{opacity:.3} 59%{opacity:1} }
@keyframes smm-loop-color-cycle { 0%{filter:hue-rotate(0deg)} 100%{filter:hue-rotate(360deg)} }
@keyframes smm-loop-glitch { 0%,100%{transform:translate(0,0) skewX(0deg)} 10%{transform:translate(-3px,1px) skewX(2deg)} 20%{transform:translate(3px,-1px) skewX(-2deg)} 30%{transform:translate(0,0) skewX(0deg)} 70%{transform:translate(0,0) skewX(0deg)} 80%{transform:translate(2px,2px) skewX(-1deg)} 90%{transform:translate(-2px,-1px) skewX(1deg)} }
@keyframes smm-loop-breathe { 0%,100%{opacity:1} 50%{opacity:.45} }
@keyframes smm-loop-marquee { from{transform:translateX(120%)} to{transform:translateX(-120%)} }
@keyframes smm-loop-ken-burns { 0%{transform:scale(1) translate(0,0)} 50%{transform:scale(1.18) translate(-2%,-2%)} 100%{transform:scale(1) translate(0,0)} }
@keyframes smm-loop-pendulum { 0%,100%{transform:rotate(-18deg);transform-origin:top center} 50%{transform:rotate(18deg);transform-origin:top center} }
@keyframes smm-loop-glow-pulse { 0%,100%{filter:brightness(1) drop-shadow(0 0 4px currentColor)} 50%{filter:brightness(1.5) drop-shadow(0 0 18px currentColor) drop-shadow(0 0 36px currentColor)} }
@keyframes smm-loop-wave-sway { 0%,100%{transform:rotate(-5deg) translateY(0)} 25%{transform:rotate(0deg) translateY(-8px)} 50%{transform:rotate(5deg) translateY(0)} 75%{transform:rotate(0deg) translateY(8px)} }
@keyframes smm-loop-zoom-drift { 0%{transform:scale(1) translate(0,0)} 33%{transform:scale(1.1) translate(-3%,-2%)} 66%{transform:scale(1.15) translate(3%,2%)} 100%{transform:scale(1) translate(0,0)} }`

// ─── Anim key → CSS class map ─────────────────────────────────────────────────

const ANIM_IN_MAP = {
  fade: 'smm-fade-in', 'fly-left': 'smm-fly-left', 'fly-right': 'smm-fly-right',
  'fly-top': 'smm-fly-top', 'fly-bottom': 'smm-fly-bottom', 'zoom-in': 'smm-zoom-in',
  'zoom-big': 'smm-zoom-big', 'spiral-in': 'smm-spiral-in', bounce: 'smm-bounce-in',
  'flip-x': 'smm-flip-x', 'flip-y': 'smm-flip-y', 'rotate-in': 'smm-rotate-in',
  'drop-in': 'smm-drop-in', 'swipe-left': 'smm-swipe-left', 'swipe-right': 'smm-swipe-right',
  'roll-left': 'smm-roll-left', typewriter: 'smm-typewriter',
}
const ANIM_OUT_MAP = {
  fade: 'smm-fade-out', 'fly-left': 'smm-fly-left-out', 'fly-right': 'smm-fly-right-out',
  'fly-top': 'smm-fly-top-out', 'fly-bottom': 'smm-fly-bottom-out',
  'zoom-out': 'smm-zoom-out', 'zoom-big': 'smm-zoom-big-out',
  'spiral-out': 'smm-spiral-out', 'flip-x': 'smm-flip-x-out', 'flip-y': 'smm-flip-y-out',
  'rotate-out': 'smm-rotate-out', dissolve: 'smm-fade-out',
  'swipe-left': 'smm-swipe-left-out', 'swipe-right': 'smm-swipe-right-out',
}

// ─── Player JS runtime (embedded into HTML at build time) ────────────────────

function buildRuntimeJs(encrypted, kioskMode, showNavControls) {
  return `
(function(){
'use strict';

// ── Data bootstrap ──────────────────────────────────────────────────────────
const ENCRYPTED = ${encrypted};
const SW = __SW__, SH = __SH__;
let DATA = null;  // set after optional decryption
let vars = {};
let cur = 0;
let timerId = null;
let outTimers = [];
let waitSet = new Set();    // element IDs waiting for click/key
let hideSet = new Set();    // element IDs hidden by trigger
let showSet = new Set();    // element IDs shown by trigger
let _afterRender = null;    // callback fired at end of render() — used by nav bar
let narAudio = null;        // per-page narration audio

// ── Scale stage ─────────────────────────────────────────────────────────────
function scaleStage(){
  const sc = Math.min(window.innerWidth/SW, window.innerHeight/SH);
  const st = document.getElementById('smme-stage');
  if(!st) return;
  const scaledW = SW * sc;
  const scaledH = SH * sc;
  st.style.transform = 'scale('+sc+')';
  st.style.left = ((window.innerWidth - scaledW) / 2) + 'px';
  st.style.top = ((window.innerHeight - scaledH) / 2) + 'px';
}
window.addEventListener('resize', scaleStage);

// ── Condition + Variable eval ────────────────────────────────────────────────
function evalCond(vName, op, val){
  const v = vars[vName];
  const a = parseFloat(v)||0, b = parseFloat(val)||0;
  switch(op){
    case '==': return String(v)===String(val)||a===b;
    case '!=': return String(v)!==String(val);
    case '>': return a>b; case '<': return a<b;
    case '>=': return a>=b; case '<=': return a<=b;
    case 'contains': return String(v).includes(String(val));
  }
  return false;
}

// ── Action execution ─────────────────────────────────────────────────────────
function execAction(el){
  if(el.ifCondVar && !evalCond(el.ifCondVar, el.ifCondOp||'==', el.ifCondVal)){
    (el.ifCondElse||[]).forEach(a=>execSingle(a)); return;
  }
  if(el.actionChain&&el.actionChain.length){ el.actionChain.forEach(a=>execSingle(a)); return; }
  execSingle(el);
}
function execSingle(act){
  const type = act.action||act.type||'';
  switch(type){
    case 'next': goTo(Math.min(cur+1, DATA.pages.length-1)); break;
    case 'prev': goTo(Math.max(cur-1,0)); break;
    case 'first': goTo(0); break;
    case 'last': goTo(DATA.pages.length-1); break;
    case 'goto': case 'gotoPage': case 'pageLink':{
      const t=act.linkTarget||act.gotoPageName||act.target||'';
      const idx=DATA.pages.findIndex(p=>p.name===t);
      if(idx>=0) goTo(idx); else goTo(parseInt(t)||cur); break;
    }
    case 'quit': case 'exit': goTo(DATA.pages.length); break;
    case 'setVar': vars[act.varName]=act.varValue; break;
    case 'toggleVar': vars[act.varName]=vars[act.varName]?'':act.varValue||'1'; break;
    case 'url': case 'open-url':
      window.open(act.linkTarget||act.url||'','_blank'); break;
    case 'reload': location.reload(); break;
    case 'event':
      if((act.elLabel||act.eventLabel)==='narration-btn'&&narAudio){
        if(narAudio.paused) narAudio.play().catch(function(){});
        else narAudio.pause();
      }
      break;
  }
}

// ── Navigation ───────────────────────────────────────────────────────────────
function goTo(idx){
  clearTimeout(timerId);
  outTimers.forEach(t=>clearTimeout(t)); outTimers=[];
  waitSet.clear(); hideSet.clear(); showSet.clear();
  if(narAudio){narAudio.pause();narAudio=null;}
  if(idx<0||idx>=DATA.pages.length+1) return;
  cur=idx; render();
}

// ── Render page ──────────────────────────────────────────────────────────────
function render(){
  const stage=document.getElementById('smme-stage');
  stage.innerHTML='';
  stage.onclick=null;
  const pg=DATA.pages[cur];
  if(!pg){
    stage.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#888;font:16px sans-serif">Presentation ended</div>';
    return;
  }
  // Background (solid colour or gradient)
  if(pg.bgGradientEnabled){
    var _ga=pg.bgGradientFrom||'#0a1a2a',_gb=pg.bgGradientTo||'#000000',_gang=pg.bgGradientAngle||180;
    stage.style.background='linear-gradient('+_gang+'deg,'+_ga+','+_gb+')';
  }else{
    stage.style.background=pg.bgColor||'#0a1a2a';
  }
  stage.style.backgroundImage='';
  if(pg.bgMediaSrc){
    const bk=pg.bgMediaKind||(pg.bgMediaSrc.match(/video|webm|mp4/i)?'video':'image');
    if(bk==='video'){
      const v=document.createElement('video');
      v.src=pg.bgMediaSrc; v.autoplay=true; v.muted=true;
      v.loop=pg.bgMediaLoop!==false; v.playsInline=true;
      v.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0';
      stage.appendChild(v);
    } else {
      stage.style.backgroundImage='url('+pg.bgMediaSrc+')';
      stage.style.backgroundSize=pg.bgMediaFit||'cover';
      stage.style.backgroundPosition='center';
    }
  }
  // Page timing click-through
  const t=pg.timing;
  if(t&&t.mode==='click') stage.onclick=e=>{if(e.target===stage)goTo(cur+1);};

  // Elements (sorted by z)
  const els=(pg.elements||[]).filter(el=>el.visible!==false);
  els.sort((a,b)=>(a.z??0)-(b.z??0));
  els.forEach(el=>{ const n=makeEl(el,pg.wordTimestamps); if(n) stage.appendChild(n); });

  // Timed auto-advance (supports timed, fixed, and lyric page modes)
  if(t){
    if(t.mode==='timed'&&t.duration>0){
      timerId=setTimeout(()=>goTo(cur+1), t.duration*1000);
    } else if(t.mode==='fixed'&&t.durationMs>0){
      timerId=setTimeout(()=>goTo(cur+1), t.durationMs);
    } else if(t.mode==='lyric'&&pg.lyricEnd!=null&&pg.lyricStart!=null){
      const lyricDur=Math.max(500,(pg.lyricEnd-pg.lyricStart)*1000);
      timerId=setTimeout(()=>goTo(cur+1), lyricDur);
    }
  }
  // Schedule out-animations
  els.forEach(el=>{
    if(el.animOut&&el.animOut!=='none'){
      const outClass=ANIM_OUT_MAP[el.animOut];
      const trigger=el.animOutTrigger||'never';
      const delay=el.animOutDelay||0;
      const dur=el.animOutDuration||600;
      if(outClass&&trigger==='auto'&&t&&t.mode==='timed'&&t.duration>0){
        const fireAt=Math.max(0,(t.duration*1000)-(dur+delay+200));
        const tmr=setTimeout(()=>{
          const node=document.getElementById('smme-el-'+el.id);
          if(node) node.style.animation=outClass+' '+dur+'ms ease-in '+delay+'ms both';
        }, fireAt);
        outTimers.push(tmr);
      }
    }
  });
  scaleStage();
  if(_afterRender)_afterRender();
  // Auto-play page narration
  if(pg.narration&&pg.narration.file){
    narAudio=new Audio(pg.narration.file);
    if(pg.narration.autoPlay!==false) narAudio.play().catch(function(){});
  }
}
function makeEl(el,wts){
  const wrap=document.createElement('div');
  wrap.id='smme-el-'+el.id;
  wrap.style.cssText='position:absolute;left:'+el.x+'px;top:'+el.y+'px;width:'+el.w+'px;height:'+el.h+'px;z-index:'+(el.z??0)+';box-sizing:border-box;';

  // animIn
  if(el.animIn&&el.animIn!=='none'){
    const cls=ANIM_IN_MAP[el.animIn];
    if(cls){
      const dur=el.animInDuration??600, delay=el.animInDelay??0, ease=el.animInEasing||'ease-out';
      wrap.style.animation=cls+' '+dur+'ms '+ease+' '+delay+'ms both';
    }
  }

  // F4 loop animation — starts after entry anim, or immediately if no entry anim
  if(el.animLoop&&el.animLoop!=='none'){
    var loopCls='smm-loop-'+el.animLoop;
    var loopDur=Math.round(el.animLoopSpeed?1500/el.animLoopSpeed:1500)+'ms';
    if(wrap.style.animation){
      wrap.addEventListener('animationend',function loopStart(){
        wrap.style.animation=loopCls+' '+loopDur+' ease-in-out infinite';
      },{once:true});
    }else{
      wrap.style.animation=loopCls+' '+loopDur+' ease-in-out infinite';
    }
  }

  if(el.type==='text'){
    wrap.style.overflow='hidden';
    wrap.style.display='flex';
    const va={top:'flex-start',middle:'center',bottom:'flex-end'}[el.vAlign]||'center';
    wrap.style.alignItems=va;
    wrap.style.fontFamily=((el.font||el.fontFamily)||'system-ui')+',sans-serif';
    wrap.style.fontSize=((el.size||el.fontSize)||36)+'px';
    wrap.style.fontWeight=(el.weight||(el.bold?'700':'400'))||'400';
    wrap.style.fontStyle=el.italic?'italic':'normal';
    wrap.style.textDecoration=el.underline?'underline':'none';
    wrap.style.color=el.color||'#e8a020';
    wrap.style.textAlign=(el.align||el.textAlign)||'center';
    wrap.style.wordBreak='break-word';
    wrap.style.background=el.bgOn?(el.bgColor||'transparent'):'transparent';
    wrap.style.padding=el.padding?el.padding+'px':'0';
    if(el.shadow) wrap.style.textShadow='2px 2px 4px rgba(0,0,0,.7)';
    // F4 text visual effects
    if(el.textStyle&&el.textStyle!=='none'){
      var c1=el.textStyleColor1||'#e8a020',c2=el.textStyleColor2||'#62c2ff';
      switch(el.textStyle){
        case 'gradient-h': wrap.style.background='linear-gradient(90deg,'+c1+','+c2+')'; wrap.style.webkitBackgroundClip='text'; wrap.style.backgroundClip='text'; wrap.style.webkitTextFillColor='transparent'; wrap.style.color='transparent'; break;
        case 'gradient-v': wrap.style.background='linear-gradient(180deg,'+c1+','+c2+')'; wrap.style.webkitBackgroundClip='text'; wrap.style.backgroundClip='text'; wrap.style.webkitTextFillColor='transparent'; wrap.style.color='transparent'; break;
        case 'gradient-diag': wrap.style.background='linear-gradient(135deg,'+c1+','+c2+')'; wrap.style.webkitBackgroundClip='text'; wrap.style.backgroundClip='text'; wrap.style.webkitTextFillColor='transparent'; wrap.style.color='transparent'; break;
        case 'neon-glow': wrap.style.textShadow='0 0 6px '+c1+',0 0 14px '+c1+',0 0 30px '+c1+'99,0 0 54px '+c1+'55'; wrap.style.color=c1; break;
        case 'outline-stroke': wrap.style.webkitTextStroke='2px '+c1; wrap.style.webkitTextFillColor='transparent'; wrap.style.color='transparent'; break;
        case 'shadow-3d': wrap.style.textShadow='1px 1px 0 '+c2+',2px 2px 0 '+c2+'cc,4px 4px 0 '+c2+'88,6px 6px 10px rgba(0,0,0,.6)'; wrap.style.color=c1; break;
        case 'image-fill': if(el.textStyleImage){wrap.style.backgroundImage='url('+el.textStyleImage+')';wrap.style.backgroundSize='cover';wrap.style.backgroundPosition='center';wrap.style.webkitBackgroundClip='text';wrap.style.backgroundClip='text';wrap.style.webkitTextFillColor='transparent';wrap.style.color='transparent';} break;
      }
    }
    // Karaoke: build word spans when page has word timestamps and this is a lyric text element
    if(el.elLabel==='lyric'&&wts&&wts.length){
      wrap.style.flexWrap='wrap';
      wrap.style.alignContent=({top:'flex-start',middle:'center',bottom:'flex-end'}[el.vAlign]||'center');
      var _wf=document.createDocumentFragment();
      wts.forEach(function(w){
        var sp=document.createElement('span');
        sp.className='smme-wrd';
        sp.dataset.ws=w.start; sp.dataset.we=w.end;
        sp.textContent=(w.text||'')+'\u00a0';
        sp.style.transition='color .12s,font-weight .12s,text-shadow .12s,opacity .12s';
        _wf.appendChild(sp);
      });
      wrap.appendChild(_wf);
    }else{
      wrap.innerHTML=(el.content||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\n/g,'<br>');
    }
    if(el.afterPlay&&el.afterPlay!=='none'){ wrap.style.cursor='pointer'; wrap.onclick=e=>{e.stopPropagation();execAction(el);} }

  } else if(el.type==='clip'||el.type==='mpeg'){
    wrap.style.overflow='hidden';
    const kind=el.mediaKind||'image';
    if(el.file){
      if(kind==='video'||el.type==='mpeg'){
        const v=document.createElement('video');
        v.src=el.file; v.muted=!el.unmuted; v.playsInline=true;
        v.loop=el.playCount?false:!!el.loop;
        v.autoplay=el.onPlayMode!=='click';
        v.style.cssText='width:100%;height:100%;object-fit:'+(el.fit||'contain')+';opacity:'+((el.opacity||100)/100);
        v.onended=()=>execAction(el);
        v.onerror=()=>execAction(el);
        if(el.mediaStartTime) v.addEventListener('loadedmetadata',()=>{v.currentTime=el.mediaStartTime||0;});
        wrap.appendChild(v);
        if(el.onPlayMode==='click'){ wrap.style.cursor='pointer'; wrap.onclick=e=>{e.stopPropagation();v.play();} }
      } else if(kind==='audio'){
        const a=document.createElement('audio');
        a.src=el.file; a.loop=!!el.loop;
        a.autoplay=el.onPlayMode!=='click';
        a.onended=()=>execAction(el);
        if(!el.audioHidden){
          a.controls=true; a.style.cssText='width:100%;margin-top:4px';
          wrap.appendChild(a);
        } else {
          a.style.cssText='position:absolute;width:0;height:0;opacity:0';
          wrap.appendChild(a);
        }
      } else {
        const img=document.createElement('img');
        img.src=el.file; img.alt='';
        img.style.cssText='width:100%;height:100%;object-fit:'+(el.fit||'contain')+';opacity:'+((el.opacity||100)/100);
        if(el.afterPlay&&el.afterPlay!=='none'){ wrap.style.cursor='pointer'; wrap.onclick=e=>{e.stopPropagation();execAction(el);} }
        wrap.appendChild(img);
      }
    }

  } else if(el.type==='button'){
    wrap.style.cursor='pointer';
    wrap.style.display='flex';
    wrap.style.alignItems='center';
    wrap.style.justifyContent='center';
    wrap.style.userSelect='none';
    wrap.style.overflow='hidden';
    const bw=el.borderWidth??2, bc=el.borderColor||'#4a8fc0', br=el.radius??4;
    if(el.btnImage){
      wrap.style.background='url('+el.btnImage+') center/cover no-repeat';
    } else {
      wrap.style.background=el.btnGrad||el.bgColor||'#1a3a5c';
    }
    wrap.style.color=el.fgColor||'#e8a020';
    wrap.style.fontSize=(el.fontSize||14)+'px';
    wrap.style.fontFamily=(el.font||'system-ui')+',sans-serif';
    wrap.style.fontWeight=el.fontWeight||'600';
    wrap.style.border=bw+'px solid '+bc;
    wrap.style.borderRadius=br+'px';
    if(el.bevel) wrap.style.boxShadow='inset 2px 2px 4px rgba(255,255,255,.2),inset -2px -2px 4px rgba(0,0,0,.4)';
    if(el.textShadow) wrap.style.textShadow='1px 1px 3px rgba(0,0,0,.8)';
    wrap.textContent=el.label||'Button';
    wrap.onclick=e=>{e.stopPropagation();execAction(el);};
    // Hover effect
    wrap.onmouseenter=()=>{ wrap.style.filter='brightness(1.15)'; };
    wrap.onmouseleave=()=>{ wrap.style.filter=''; };
    wrap.onmousedown=()=>{ wrap.style.transform='scale('+(el.clickScale||0.96)+')'; };
    wrap.onmouseup=()=>{ wrap.style.transform=''; };

  } else if(el.type==='hotspot'){
    if((el.action&&el.action!=='none')||el.actionChain?.length){
      wrap.style.cursor='pointer';
      wrap.onclick=e=>{e.stopPropagation();execAction(el);};
    }
  } else if(el.type==='group'){
    // F3 layer groups — render children relative to group origin
    wrap.style.overflow='hidden';
    if(el.children&&el.children.length){
      el.children.forEach(function(child){ wrap.appendChild(makeEl(child,null)); });
    }
  }
  return wrap;
}

// ── Keyboard navigation ───────────────────────────────────────────────────────
const ANIM_IN_MAP={fade:'smm-fade-in','fly-left':'smm-fly-left','fly-right':'smm-fly-right','fly-top':'smm-fly-top','fly-bottom':'smm-fly-bottom','zoom-in':'smm-zoom-in','zoom-big':'smm-zoom-big','spiral-in':'smm-spiral-in',bounce:'smm-bounce-in','flip-x':'smm-flip-x','flip-y':'smm-flip-y','rotate-in':'smm-rotate-in','drop-in':'smm-drop-in','swipe-left':'smm-swipe-left','swipe-right':'smm-swipe-right','roll-left':'smm-roll-left',typewriter:'smm-typewriter'};
const ANIM_OUT_MAP={fade:'smm-fade-out','fly-left':'smm-fly-left-out','fly-right':'smm-fly-right-out','fly-top':'smm-fly-top-out','fly-bottom':'smm-fly-bottom-out','zoom-out':'smm-zoom-out','zoom-big':'smm-zoom-big-out','spiral-out':'smm-spiral-out','flip-x':'smm-flip-x-out','flip-y':'smm-flip-y-out','rotate-out':'smm-rotate-out',dissolve:'smm-fade-out','swipe-left':'smm-swipe-left-out','swipe-right':'smm-swipe-right-out'};

document.addEventListener('keydown', e=>{
  if(e.key==='ArrowRight'||e.key==='PageDown'||e.key==='Space'){ e.preventDefault(); goTo(Math.min(cur+1,DATA.pages.length-1)); }
  if(e.key==='ArrowLeft'||e.key==='PageUp'){ e.preventDefault(); goTo(Math.max(cur-1,0)); }
  if(e.key==='Home'){ e.preventDefault(); goTo(0); }
  if(e.key==='End'){ e.preventDefault(); goTo(DATA.pages.length-1); }
  if(e.key==='Escape'&&!${kioskMode}){ goTo(DATA.pages.length); }
});

// ── Nav controls ──────────────────────────────────────────────────────────────
${showNavControls ? `
function buildNavBar(){
  const nav=document.createElement('div');
  nav.id='smme-nav';
  nav.style.cssText='position:fixed;bottom:16px;left:50%;transform:translateX(-50%);display:flex;gap:8px;z-index:99999;opacity:0;transition:opacity .3s';
  const btn=(label,onclick)=>{
    const b=document.createElement('button');
    b.textContent=label;
    b.style.cssText='background:rgba(0,0,0,.7);color:#e8a020;border:1px solid #4a8fc0;border-radius:4px;padding:6px 12px;cursor:pointer;font:14px sans-serif';
    b.onclick=onclick; nav.appendChild(b); return b;
  };
  btn('◀',()=>goTo(Math.max(cur-1,0)));
  const pg=btn('1/1',null); pg.id='smme-pg'; pg.style.cursor='default';
  btn('▶',()=>goTo(Math.min(cur+1,DATA.pages.length-1)));
  document.body.appendChild(nav);
  document.addEventListener('mousemove',()=>{
    nav.style.opacity='1';
    clearTimeout(nav._t);
    nav._t=setTimeout(()=>nav.style.opacity='0', 2500);
  });
  function upd(){ const p=document.getElementById('smme-pg'); if(p) p.textContent=(cur+1)+'/'+(DATA.pages.length); }
  _afterRender=upd;
}
buildNavBar();
` : ''}

// ── Decrypt + start ───────────────────────────────────────────────────────────
async function start(rawData){
  DATA=rawData;
  vars=Object.assign({}, ...(DATA.projectVars||[]).map(v=>({[v.name]:v.defaultValue??''})));
  render();
  // Audio playback with lyric-mode sync
  if(DATA.presentationAudio&&DATA.presentationAudio.src){
    const pa=DATA.presentationAudio;
    const aud=document.createElement('audio');
    aud.src=pa.src;
    aud.volume=pa.volume??1;
    aud.loop=pa.loop??false;
    aud.style.display='none';
    document.body.appendChild(aud);
    aud.addEventListener('canplay',function tryPlay(){
      aud.play().catch(function(){
        if(document.getElementById('smme-play-ov'))return;
        var ov=document.createElement('div');
        ov.id='smme-play-ov';
        ov.style.cssText='position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.65);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;font-family:system-ui,sans-serif';
        ov.innerHTML='<div style="font-size:80px;line-height:1">&#9654;</div><div style="color:#e8a020;font-size:20px;font-weight:700;margin-top:16px">Click to Start Presentation</div>';
        ov.addEventListener('click',function(){ov.remove();aud.play().catch(function(){});},{once:true});
        document.body.appendChild(ov);
      });
    },{once:true});
    // Karaoke word highlighting helper (called 60fps while audio plays)
    function updateKaraoke(t){
      document.querySelectorAll('.smme-wrd').forEach(function(sp){
        var ws=+sp.dataset.ws,we=+sp.dataset.we;
        if(t>=ws&&t<we){ sp.style.color='#f59e0b';sp.style.fontWeight='900';sp.style.textShadow='0 0 8px rgba(245,158,11,.8)';sp.style.opacity='1'; }
        else if(t>=we){ sp.style.color='';sp.style.fontWeight='';sp.style.textShadow='';sp.style.opacity='0.45'; }
        else{ sp.style.color='';sp.style.fontWeight='';sp.style.textShadow='';sp.style.opacity='1'; }
      });
    }
    // Lyric-mode: sync page to audio time using requestAnimationFrame
    if(DATA.pages.some(p=>p.timing&&p.timing.mode==='lyric')){
      (function syncLoop(){
        if(!aud.paused&&!aud.ended){
          var t=aud.currentTime;
          var idx=DATA.pages.findIndex(function(p){
            var tm=p.timing;
            return tm&&tm.mode==='lyric'&&p.lyricStart!=null&&p.lyricEnd!=null&&t>=p.lyricStart&&t<p.lyricEnd;
          });
          if(idx>=0&&idx!==cur){ clearTimeout(timerId); goTo(idx); }
          updateKaraoke(t);
        }
        requestAnimationFrame(syncLoop);
      })();
    }
  }
}

${encrypted ? `
async function decryptAndStart(pw){
  const btn=document.getElementById('smme-unlock');
  const err=document.getElementById('smme-pw-err');
  if(btn) btn.disabled=true;
  if(err) err.textContent='Decrypting…';
  if(!crypto?.subtle){
    if(err) err.textContent='❌ Web Crypto unavailable. Open in Chrome or Edge (not from an archive preview).';
    if(btn){btn.disabled=false;btn.textContent='Unlock';}
    return;
  }
  try{
    const encEl=document.getElementById('smme-enc');
    if(!encEl) throw new Error('smme-enc element missing');
    const enc=new TextEncoder();
    const km=await crypto.subtle.importKey('raw',enc.encode(pw),'PBKDF2',false,['deriveKey']);
    const packed=Uint8Array.from(atob(encEl.textContent.trim()),c=>c.charCodeAt(0));
    const salt=packed.slice(0,16),iv=packed.slice(16,28),ct=packed.slice(28);
    const key=await crypto.subtle.deriveKey(
      {name:'PBKDF2',salt,iterations:100000,hash:'SHA-256'},
      km,{name:'AES-GCM',length:256},false,['decrypt']
    );
    const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv},key,ct);
    const data=JSON.parse(new TextDecoder().decode(plain));
    document.getElementById('smme-gate')?.remove();
    const _stg=document.getElementById('smme-stage');
    if(_stg) _stg.style.display='';
    await start(data);
  }catch(e){
    console.error('[FluxAura Studio decrypt]',e);
    if(err) err.textContent='❌ Incorrect password. Try again.';
    if(btn){ btn.disabled=false; btn.textContent='Unlock'; }
  }
}
window.addEventListener('load',()=>{
  const inp=document.getElementById('smme-pw-input');
  const btn=document.getElementById('smme-unlock');
  if(btn) btn.onclick=()=>{ if(inp&&inp.value) decryptAndStart(inp.value); };
  if(inp) inp.onkeydown=e=>{ if(e.key==='Enter'&&inp.value) decryptAndStart(inp.value); };
  document.getElementById('smme-stage').style.display='none';
  scaleStage();
});
` : `
window.addEventListener('load',()=>{
  try{
    const dataEl=document.getElementById('smme-data');
    start(dataEl?JSON.parse(dataEl.textContent):{pages:[]});
  }catch(e){ console.error('[FluxAura Studio start]',e); }
});
`}
})();
`
}

// ─── Password gate HTML ───────────────────────────────────────────────────────

function buildPasswordGateHtml(title) {
  return `
  <div id="smme-gate" style="position:fixed;inset:0;z-index:99999;background:linear-gradient(135deg,#0a1a2a 0%,#1a3a6c 100%);display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif">
    <div style="text-align:center;padding:40px;background:rgba(255,255,255,.07);border:1px solid #4a8fc0;border-radius:12px;max-width:380px;width:90%">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:22px;font-weight:700;color:#e8a020;margin-bottom:8px">${title || 'Protected Presentation'}</div>
      <div style="font-size:13px;color:#8ab0d0;margin-bottom:24px">This presentation is password protected.</div>
      <input id="smme-pw-input" type="password" placeholder="Enter password…" autocomplete="current-password"
        style="width:100%;padding:10px 14px;font-size:15px;border:1px solid #4a8fc0;border-radius:6px;background:rgba(255,255,255,.1);color:#fff;outline:none;box-sizing:border-box;margin-bottom:12px">
      <button id="smme-unlock" style="width:100%;padding:10px;font-size:15px;font-weight:700;background:linear-gradient(180deg,#2060c0 0%,#1040a0 100%);color:#fff;border:1px solid #60a0ff;border-radius:6px;cursor:pointer">
        Unlock ▶
      </button>
      <div id="smme-pw-err" style="font-size:12px;color:#ff8080;min-height:18px;margin-top:10px"></div>
      <div style="font-size:11px;color:#4a6880;margin-top:16px">FluxAura Studio</div>
    </div>
  </div>`
}

// ─── Main HTML assembler ──────────────────────────────────────────────────────

/**
 * Build a complete standalone HTML presentation player.
 * @param {object[]} pages
 * @param {{width:number,height:number}} stage
 * @param {object[]} projectVars
 * @param {{title?:string,author?:string,description?:string,password?:string,kiosk?:boolean,navControls?:boolean,logoDataUrl?:string}} opts
 * @returns {Promise<string>} HTML string
 */
export async function buildPlayerHtml(pages, stage, projectVars, opts = {}) {
  const SW = stage.width || 1920
  const SH = stage.height || 1080
  const title = opts.title || 'FluxAura Studio Presentation'
  const password = opts.password || ''
  const kiosk = !!opts.kiosk
  const navControls = opts.navControls !== false

  // Strip any local-only URLs that can't work in a standalone file (blob:, localhost, app-media:)
  // data: URLs (resolved by resolveMediaForExport) are kept as-is
  function isLocalOnlyUrl(u){ return u&&/^blob:|^https?:\/\/127\.|^https?:\/\/localhost|^app-media:/i.test(u); }
  const cleanPages = pages.map(pg => ({
    ...pg,
    bgMediaSrc: isLocalOnlyUrl(pg.bgMediaSrc) ? '' : pg.bgMediaSrc,
    narration: pg.narration ? { ...pg.narration, file: isLocalOnlyUrl(pg.narration.file) ? '' : pg.narration.file } : pg.narration,
    elements: (pg.elements || []).map(el => ({
      ...el,
      file: isLocalOnlyUrl(el.file) ? '' : el.file,
    })),
  }))

  const dataObj = {
    title, width: SW, height: SH, pages: cleanPages, projectVars: projectVars || [],
    presentationAudio: opts.presentationAudio?.src
      ? { src: opts.presentationAudio.src, volume: opts.presentationAudio.volume ?? 1, loop: opts.presentationAudio.loop ?? false }
      : null,
  }

  let dataElementHtml = ''
  if (password) {
    const enc = new TextEncoder()
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt'],
    )
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(dataObj)))
    const packed = new Uint8Array(16 + 12 + ciphertext.byteLength)
    packed.set(salt, 0); packed.set(iv, 16); packed.set(new Uint8Array(ciphertext), 28)
    // Chunked conversion — spreading a large Uint8Array overflows V8 call stack
    let _encBin = ''; const _ENC_SZ = 8192
    for (let _ei = 0; _ei < packed.length; _ei += _ENC_SZ)
      _encBin += String.fromCharCode.apply(null, packed.subarray(_ei, Math.min(_ei + _ENC_SZ, packed.length)))
    const encBase64 = btoa(_encBin)
    // Store in a text element — keeps the base64 out of a JS string literal (safer for large payloads)
    dataElementHtml = `<script type="text/plain" id="smme-enc">${encBase64}<` + `/script>`
  } else {
    // Store plain JSON in an application/json element — no V8 string literal size concerns
    const jsonStr = JSON.stringify(dataObj).replace(/<\//g, '<\\/')
    dataElementHtml = `<script type="application/json" id="smme-data">${jsonStr}<` + `/script>`
  }

  const runtimeJs = buildRuntimeJs(!!password, kiosk, navControls)
    .replace(/__SW__/g, SW)
    .replace(/__SH__/g, SH)

  const metaTags = [
    opts.author ? `<meta name="author" content="${opts.author.replace(/"/g, '&quot;')}">` : '',
    opts.description ? `<meta name="description" content="${opts.description.replace(/"/g, '&quot;')}">` : '',
    `<meta name="generator" content="FluxAura Studio - Multi Media Editor - Interactive Edition">`,
  ].filter(Boolean).join('\n  ')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<title>${title.replace(/</g, '&lt;')}</title>
${metaTags}
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#000;height:100vh;overflow:hidden;font-family:system-ui,sans-serif}
${kiosk ? 'body{cursor:none}' : ''}
#smme-stage{position:absolute;width:${SW}px;height:${SH}px;overflow:hidden;transform-origin:top left;background:#0a1a2a}
${ANIM_CSS}
</style>
</head>
<body>
${dataElementHtml}
${password ? buildPasswordGateHtml(title) : ''}
<div id="smme-stage"></div>
<script>
${runtimeJs}
</script>
</body>
</html>`
}

// ─── Asset bundling (extract data: URLs → file map) ──────────────────────────

function bundleAssets(pages) {
  const assets = {}

  function dataUrlToUint8(dataUrl) {
    const base64 = dataUrl.split(',')[1] || dataUrl
    const bin = atob(base64)
    const arr = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
    return arr
  }

  function getMime(dataUrl) {
    const m = dataUrl.match(/^data:([^;]+)/)
    return m ? m[1] : 'application/octet-stream'
  }

  function ext(mediaKind, dataUrl) {
    const mime = getMime(dataUrl)
    if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg'
    if (mime.includes('png')) return 'png'
    if (mime.includes('gif')) return 'gif'
    if (mime.includes('webp')) return 'webp'
    if (mime.includes('webm')) return 'webm'
    if (mime.includes('mp4')) return 'mp4'
    if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3'
    if (mime.includes('wav')) return 'wav'
    if (mime.includes('ogg')) return 'ogg'
    if (mime.includes('pdf')) return 'pdf'
    return mediaKind === 'video' ? 'mp4' : mediaKind === 'audio' ? 'mp3' : 'bin'
  }

  const strippedPages = pages.map((pg, pi) => {
    const pgOut = { ...pg }
    if (pg.bgMediaSrc?.startsWith('data:')) {
      const key = `assets/bg_p${pi}.${ext('image', pg.bgMediaSrc)}`
      assets[key] = { data: dataUrlToUint8(pg.bgMediaSrc), mime: getMime(pg.bgMediaSrc) }
      pgOut.bgMediaSrc = key
    }
    if (pg.narration?.file?.startsWith('data:')) {
      const key = `assets/narration_p${pi}.${ext('audio', pg.narration.file)}`
      assets[key] = { data: dataUrlToUint8(pg.narration.file), mime: getMime(pg.narration.file) }
      pgOut.narration = { ...pg.narration, file: key }
    }
    pgOut.elements = (pg.elements || []).map((el, ei) => {
      if (!el.file?.startsWith('data:')) return el
      const kind = el.mediaKind || 'image'
      const key = `assets/el_p${pi}_e${ei}.${ext(kind, el.file)}`
      assets[key] = { data: dataUrlToUint8(el.file), mime: getMime(el.file) }
      return { ...el, file: key }
    })
    return pgOut
  })

  return { pages: strippedPages, assets }
}

// ─── Media URL resolver ───────────────────────────────────────────────────────

/**
 * Replace all local media-server URLs (http://127.x.x.x/...) with inline
 * data: URLs so the exported file works independently of the app's server.
 * @param {object[]} pages
 * @param {(done:number, total:number)=>void} [onProgress]
 * @returns {Promise<object[]>}
 */
export async function resolveMediaForExport(pages, onProgress) {
  // Match any URL that needs to be converted to a data: URL for standalone export
  const localMediaRe = /^blob:|^https?:\/\/127\.|^https?:\/\/localhost|^app-media:/i
  const desktop = typeof window !== 'undefined' ? window.smmDesktop : null

  const jobs = []
  for (const pg of pages) {
    if (pg.bgMediaSrc && localMediaRe.test(pg.bgMediaSrc))
      jobs.push({ obj: pg, key: 'bgMediaSrc', url: pg.bgMediaSrc, sourcePath: pg.bgMediaSourcePath || null })
    for (const el of (pg.elements || [])) {
      if (el.file && localMediaRe.test(el.file))
        jobs.push({ obj: el, key: 'file', url: el.file, sourcePath: el.mediaSourcePath || null })
    }
    if (pg.narration?.file && localMediaRe.test(pg.narration.file))
      jobs.push({ obj: pg.narration, key: 'file', url: pg.narration.file, sourcePath: pg.narration.sourcePath || null })
  }
  if (!jobs.length) return pages

  const cache = new Map()
  let done = 0

  for (const job of jobs) {
    if (!cache.has(job.url)) {
      let dataUrl = null

      // 1. fetch() works for blob: and http://127.x URLs in Electron renderer
      if (/^blob:|^https?:/i.test(job.url)) {
        try {
          const res = await fetch(job.url)
          if (res.ok) {
            const blob = await res.blob()
            dataUrl = await new Promise((resolve, reject) => {
              const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(blob)
            })
          }
        } catch { /* fall through */ }
      }

      // 2. Use IPC readMediaDataUrl — needed for app-media:// and as fetch fallback
      if (!dataUrl && desktop?.readMediaDataUrl) {
        // Decode app-media:// → absolute disk path
        let filePath = job.sourcePath
        if (!filePath && /^app-media:/i.test(job.url)) {
          try {
            const pathname = new URL(job.url).pathname
            filePath = decodeURIComponent(pathname.replace(/^\/([A-Za-z]:)/, '$1'))
          } catch { /* invalid URL */ }
        }
        if (filePath) {
          try {
            const result = await desktop.readMediaDataUrl({ filePath })
            if (result?.ok && result.dataUrl) dataUrl = result.dataUrl
          } catch { /* IPC failed */ }
        }
      }

      // 3. Last resort: try sourcePath directly via IPC (covers any case where URL parse failed)
      if (!dataUrl && job.sourcePath && desktop?.readMediaDataUrl) {
        try {
          const result = await desktop.readMediaDataUrl({ filePath: job.sourcePath })
          if (result?.ok && result.dataUrl) dataUrl = result.dataUrl
        } catch { /* IPC failed */ }
      }

      if (dataUrl) cache.set(job.url, dataUrl)
    }
    done++
    if (onProgress) onProgress(done, jobs.length)
  }

  return pages.map(pg => ({
    ...pg,
    bgMediaSrc: cache.get(pg.bgMediaSrc) ?? pg.bgMediaSrc,
    narration: pg.narration ? { ...pg.narration, file: cache.get(pg.narration.file) ?? pg.narration.file } : pg.narration,
    elements: (pg.elements || []).map(el => ({
      ...el,
      file: cache.get(el.file) ?? el.file,
    })),
  }))
}

/**
 * Resolve the presentation audio to an inline data: URL.
 * Tries fetch() first (works for blob:/http: in Electron), then falls back
 * to the desktop readMediaDataUrl IPC using the original disk sourcePath.
 * Returns a new opts object with presentationAudio.src set on success.
 */
async function resolveAudioForExport(opts) {
  const pa = opts.presentationAudio
  if (!pa) return opts
  const desktop = typeof window !== 'undefined' ? window.smmDesktop : null
  let src = null

  // Method 1: fetch() for blob: and http://127.x URLs
  const paFile = pa.file
  if (paFile && /^blob:|^https?:/i.test(paFile)) {
    try {
      const res = await fetch(paFile)
      if (res.ok) {
        const blob = await res.blob()
        src = await new Promise((resolve, reject) => {
          const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(blob)
        })
      }
    } catch { /* fall through */ }
  }

  // Method 2: IPC readMediaDataUrl on the original disk path (most reliable)
  if (!src && pa.sourcePath && desktop?.readMediaDataUrl) {
    try {
      const result = await desktop.readMediaDataUrl({ filePath: pa.sourcePath })
      if (result?.ok && result.dataUrl) src = result.dataUrl
    } catch { /* IPC failed */ }
  }

  // Method 3: Decode app-media:// → disk path
  if (!src && paFile && /^app-media:/i.test(paFile) && desktop?.readMediaDataUrl) {
    try {
      const pathname = new URL(paFile).pathname
      const filePath = decodeURIComponent(pathname.replace(/^\/([A-Za-z]:)/, '$1'))
      if (filePath) {
        const result = await desktop.readMediaDataUrl({ filePath })
        if (result?.ok && result.dataUrl) src = result.dataUrl
      }
    } catch { /* invalid URL or IPC failed */ }
  }

  if (src) return { ...opts, presentationAudio: { ...pa, src } }
  return opts
}

// ─── HTML Export (embeds all assets inline as base64 data URLs) ───────────────

/**
 * Export as a single self-contained HTML file.
 * All media-server URLs are resolved to inline data: URLs.
 */
export async function exportAsHtml(pages, stage, projectVars, opts = {}) {
  const resolved = await resolveMediaForExport(pages, opts.onProgress)
  const resolvedOpts = await resolveAudioForExport(opts)

  const html = await buildPlayerHtml(resolved, stage, projectVars, resolvedOpts)
  const blob = new Blob([html], { type: 'text/html' })
  const name = (opts.title || 'presentation').replace(/[^a-zA-Z0-9_-]/g, '_') + '.html'
  const saved = await _save(blob, name, [{ name: 'HTML File', extensions: ['html'] }], opts.outputFolder)
  return saved || name
}

// ─── .mmp Export (self-contained player package) ──────────────────────────────

/**
 * Export as .mmp — ZIP package with:
 *   manifest.json  – title, author, creation date, metadata
 *   player.html    – fully self-contained player (ALL media embedded as data: URLs)
 *   README.txt     – instructions for recipients
 *
 * Phase 1: player.html opens in any modern browser — no installation needed.
 * Phase 2 (future): will bundle a minimal Electron player for native-window playback.
 *
 * Password protection (AES-256-GCM) is embedded inside player.html itself —
 * the recipient must enter the correct password before playback begins.
 */
export async function exportAsMmp(pages, stage, projectVars, opts = {}) {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  const title = opts.title || 'presentation'
  // NOTE: generateAsync 'type' = OUTPUT FORMAT; 'compression' = algorithm — these are separate keys.
  const comprType = JSZip.support.deflate ? 'DEFLATE' : 'STORE'
  const generateOpts = comprType === 'DEFLATE'
    ? { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: opts.compressionLevel ?? 6 } }
    : { type: 'blob', compression: 'STORE' }

  // Resolve all blob:/localhost media URLs → inline data: URLs so player.html is portable
  const resolved = await resolveMediaForExport(pages, opts.onProgress)
  const resolvedOpts = await resolveAudioForExport(opts)

  // Build a fully self-contained player.html — all media inlined, password gate included
  const playerHtml = await buildPlayerHtml(resolved, stage, projectVars, resolvedOpts)
  zip.file('player.html', playerHtml, comprType === 'DEFLATE'
    ? { compression: 'DEFLATE', compressionOptions: { level: 9 } }
    : { compression: 'STORE' })

  // Manifest (metadata for future player apps / FluxAura Studio importer)
  zip.file('manifest.json', JSON.stringify({
    format: 'FluxAura-Studio-Package',
    version: '1.0',
    title,
    author: opts.author || '',
    description: opts.description || '',
    created: new Date().toISOString(),
    encrypted: !!(opts.password),
    stageWidth: stage.width || 1920,
    stageHeight: stage.height || 1080,
    pageCount: pages.length,
    playerEngine: 'FluxAura-Studio',
    playerType: 'standalone-html',
  }, null, 2))

  // Instructions for recipients who don't know what .mmp is
  const dateStr = new Date().toISOString().split('T')[0]
  zip.file('README.txt', [
    `${title}`,
    `${'='.repeat(Math.min(title.length, 60))}`,
    `FluxAura Studio Presentation Package — exported ${dateStr}`,
    '',
    'HOW TO PLAY:',
    '  1. If this file has a .mmp extension, rename it to .zip',
    '  2. Extract the ZIP contents to a folder',
    '  3. Open "player.html" in any modern browser (Chrome, Edge, Firefox, Safari)',
    '',
    opts.password ? '  This presentation is PASSWORD PROTECTED.' : '  No password required.',
    '',
    'Created with FluxAura Studio',
  ].join('\r\n'))

  const blob = await zip.generateAsync(generateOpts)
  const safeName = title.replace(/[^a-zA-Z0-9_-]/g, '_')
  const saved = await _save(blob, `${safeName}.mmp`, [{ name: 'FluxAura Studio Package', extensions: ['mmp'] }], opts.outputFolder)
  return saved || `${safeName}.mmp`
}

// ─── ZIP Bundle Export ────────────────────────────────────────────────────────
// When a password is set and the Electron desktop API is available, we route
// through the main process (archiver + archiver-zip-encrypted) for AES-256
// ZIP-level encryption (WinRAR/7-Zip will prompt for the password on open).
// When no password is set, or we're in a plain browser, we use JSZip as before.

export async function exportAsZip(pages, stage, projectVars, opts = {}) {
  const title = opts.title || 'presentation'
  const safeName = title.replace(/[^a-zA-Z0-9_-]/g, '_')
  const password = opts.password || ''

  // Resolve media server URLs to data: URLs first
  const resolved = await resolveMediaForExport(pages, opts.onProgress)
  const resolvedOpts = await resolveAudioForExport(opts)

  // Extract data: URLs to separate asset files; strippedPages reference assets/ paths
  const { pages: strippedPages, assets } = bundleAssets(resolved)

  // Build audio asset entry if needed
  let zipOpts = { ...resolvedOpts, password }
  const audioSrc = resolvedOpts.presentationAudio?.src || ''
  let audioEntry = null // { key, base64 }
  if (audioSrc.startsWith('data:')) {
    const mime = audioSrc.match(/^data:([^;]+)/)?.[1] || 'audio/mpeg'
    const audioExt = mime.includes('wav') ? 'wav' : mime.includes('ogg') ? 'ogg' : 'mp3'
    const audioKey = `assets/audio.${audioExt}`
    audioEntry = { key: audioKey, base64: audioSrc.split(',')[1] || '' }
    zipOpts = { ...zipOpts, presentationAudio: { ...resolvedOpts.presentationAudio, src: audioKey } }
  }

  // Build HTML player with strippedPages (relative paths) + extracted audio path
  const passwordNote = password ? `\nPASSWORD PROTECTED: You will be prompted to enter the password when you open index.html.\n` : ''
  const readmeTxt = `FluxAura Fuse Web Bundle — "${title}"\n\nHow to play:\n1. Extract all files from this ZIP to a folder.\n2. Open index.html in any modern browser (Chrome, Firefox, Edge).\n3. The presentation will start automatically.\n${passwordNote}\nContents:\n  index.html   — the player (open this)\n  assets/      — all media files (images, video, audio)\n  manifest.json — project metadata\n`
  const manifestJson = JSON.stringify({
    format: 'FluxAura-Studio-Bundle', version: '1.0', title, author: opts.author || '', stageWidth: stage.width, stageHeight: stage.height, pageCount: pages.length, passwordProtected: !!password,
  }, null, 2)
  const playerHtml = await buildPlayerHtml(strippedPages, stage, projectVars, zipOpts)

  // ── Encrypted path: route through Electron main process (AES-256 ZIP) ─────
  const desktop = typeof window !== 'undefined' ? window.smmDesktop : null
  if (password && desktop?.saveZipEncrypted) {
    // Build file list as [{name, base64}] for the IPC handler
    const files = []

    // Asset files from bundleAssets (binary data as Uint8Array or string)
    for (const [key, { data }] of Object.entries(assets)) {
      let b64
      if (data instanceof Uint8Array || ArrayBuffer.isView(data)) {
        b64 = uint8ArrayToBase64(data)
      } else if (typeof data === 'string') {
        // Could already be base64 or raw text — treat as UTF-8 text
        b64 = btoa(unescape(encodeURIComponent(data)))
      } else {
        b64 = btoa(String(data))
      }
      files.push({ name: key, base64: b64 })
    }

    // Audio asset
    if (audioEntry) {
      files.push({ name: audioEntry.key, base64: audioEntry.base64 })
    }

    // Text/HTML files
    files.push({ name: 'index.html', base64: btoa(unescape(encodeURIComponent(playerHtml))) })
    files.push({ name: 'README.txt', base64: btoa(unescape(encodeURIComponent(readmeTxt))) })
    files.push({ name: 'manifest.json', base64: btoa(unescape(encodeURIComponent(manifestJson))) })

    const result = await desktop.saveZipEncrypted({
      files,
      password,
      defaultName: `${safeName}_bundle.zip`,
      outputFolder: opts.outputFolder || null,
      filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
    })

    if (result.canceled || !result.ok) {
      if (result.error) throw new Error(result.error)
      return null
    }
    return result.filePath || result.fileName || `${safeName}_bundle.zip`
  }

  // ── Unencrypted path: use JSZip in-renderer as before ─────────────────────
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  const comprType = JSZip.support.deflate ? 'DEFLATE' : 'STORE'
  const generateOpts = comprType === 'DEFLATE'
    ? { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } }
    : { type: 'blob', compression: 'STORE' }
  const fileCompression = comprType === 'DEFLATE'
    ? { compression: 'DEFLATE', compressionOptions: { level: 6 } }
    : { compression: 'STORE' }

  Object.entries(assets).forEach(([key, { data }]) => zip.file(key, data, fileCompression))
  if (audioEntry) {
    const bin = atob(audioEntry.base64)
    const arr = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
    zip.file(audioEntry.key, arr, fileCompression)
  }
  zip.file('index.html', playerHtml)
  zip.file('README.txt', readmeTxt)
  zip.file('manifest.json', manifestJson)

  const blob = await zip.generateAsync(generateOpts)
  const saved = await _save(blob, `${safeName}_bundle.zip`, [{ name: 'ZIP Archive', extensions: ['zip'] }], opts.outputFolder)
  return saved || `${safeName}_bundle.zip`
}

/** Convert Uint8Array to base64 string without call-stack overflow on large arrays */
function uint8ArrayToBase64(arr) {
  const CHUNK = 0x8000
  let result = ''
  for (let i = 0; i < arr.length; i += CHUNK) {
    result += String.fromCharCode(...arr.subarray(i, i + CHUNK))
  }
  return btoa(result)
}

// ─── Import pages from .mme / .sca file ─────────────────────────────────────

/**
 * Parse a .mme / .sca file and return its pages array.
 * @param {File|string} fileOrText  File object or raw text content
 * @returns {Promise<{pages: object[], stage: object, projectVars: object[]}>}
 */
export async function importProjectPages(fileOrText) {
  let text
  if (typeof fileOrText === 'string') {
    text = fileOrText
  } else {
    text = await fileOrText.text()
  }
  const { pages, stage, projectVars } = parseMME(text)
  return { pages: pages || [], stage: stage || {}, projectVars: projectVars || [] }
}

// ─── Internal save helper ─────────────────────────────────────────────────────

/**
 * Save a Blob on desktop (native save dialog) or browser (anchor download).
 * Returns the saved file path/name, or null if user canceled.
 * @param {Blob} blob
 * @param {string} name - default filename
 * @param {{ name: string, extensions: string[] }[]} [filters] - desktop file-type filters
 * @returns {Promise<string|null>}
 */
async function _save(blob, name, filters, outputFolder) {
  const desktop = typeof window !== 'undefined' ? window.smmDesktop : null
  if (desktop?.saveExportFile) {
    // Electron desktop: use native save dialog (or direct write if folder pre-selected)
    const base64 = await new Promise((res, rej) => {
      const reader = new FileReader()
      reader.onload = () => res(/** @type {string} */(reader.result).split(',')[1])
      reader.onerror = () => rej(reader.error)
      reader.readAsDataURL(blob)
    })
    const result = await desktop.saveExportFile({ base64, defaultName: name, filters: filters || [], outputFolder: outputFolder || null })
    if (result.canceled || !result.ok) {
      if (result.error) throw new Error(result.error)
      return null
    }
    return result.filePath || result.fileName || name
  }
  // Browser fallback: trigger anchor download
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url) }, 2000)
  return name
}
