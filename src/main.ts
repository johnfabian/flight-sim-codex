import './style.css';
import { World } from './world';
import { FlightAudio } from './audio';
import { createFlight, stepFlight, checkpoints, islands, terrainHeight, clamp, type Flight } from './simulation';

const icons = {
  plane: '<path d="m12 3 1.6 7 7.4 4v2l-7.6-2 .1 5 2.5 2v1l-4-1-4 1v-1l2.5-2 .1-5L3 16v-2l7.4-4L12 3Z"/>',
  sound:'<path d="m11 5-6 4H2v6h3l6 4V5Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  muted:'<path d="m11 5-6 4H2v6h3l6 4V5Z"/><path d="m16 9 6 6m0-6-6 6"/>',
  fullscreen:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3v.1"/>',
  pause:'<path d="M8 5v14M16 5v14"/>',
  camera:'<path d="M3 7h4l2-3h6l2 3h4v13H3V7Z"/><circle cx="12" cy="13" r="4"/>',
  arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  compass:'<circle cx="12" cy="12" r="9"/><path d="m16 8-2 6-6 2 2-6 6-2Z"/>',
};
function icon(name:keyof typeof icons) {return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;}
const app=document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML=`
  <canvas id="world" aria-label="3D flight view over the Pelagos archipelago"></canvas>
  <div class="vignette"></div>
  <header class="topbar">
    <a class="brand" href="/" aria-label="Aeronaut home"><span class="brand-mark">${icon('plane')}</span><span>AERONAUT<small>A LITTLE CLOSER TO THE SKY</small></span></a>
    <div class="location"><span class="live-dot"></span> PELAGOS ARCHIPELAGO <span class="location-divider">/</span> <span id="time-label">GOLDEN HOUR</span></div>
    <div class="toolbar">
      <button id="lighting" class="icon-button" title="Change time of day" aria-label="Change time of day">${icon('sun')}</button>
      <button id="sound" class="icon-button" title="Toggle sound (M)" aria-label="Mute sound" aria-pressed="false">${icon('sound')}</button>
      <button id="help" class="icon-button" title="Flight controls (H)" aria-label="Flight controls">${icon('help')}</button>
      <button id="fullscreen" class="icon-button fullscreen-button" title="Fullscreen (F)" aria-label="Toggle fullscreen">${icon('fullscreen')}</button>
      <button id="pause" class="icon-button flight-only" title="Pause (Esc)" aria-label="Pause flight">${icon('pause')}</button>
    </div>
  </header>
  <main>
    <section id="briefing" class="briefing" aria-label="Flight briefing">
      <div class="eyebrow"><span class="short-line"></span> THE WORLD CAN WAIT.</div>
      <h1>Take the<br> <em>scenic route.</em></h1>
      <p class="intro">A little aircraft. An open sky.<br>And a whole lot of somewhere to discover.</p>
      <div class="flight-selection" role="group" aria-label="Flight mode">
        <button class="mode-card selected" data-mode="expedition" aria-pressed="true"><span class="mode-icon">${icon('compass')}</span><span><strong>Island expedition</strong><small>8 checkpoints · ~3 minutes</small></span><span class="radio-dot"></span></button>
        <button class="mode-card" data-mode="free" aria-pressed="false"><span class="mode-icon">${icon('plane')}</span><span><strong>Free flight</strong><small>No route. Just your curiosity.</small></span><span class="radio-dot"></span></button>
      </div>
      <button id="launch" class="primary-button"><span>Let’s fly</span>${icon('arrow')}</button>
      <div class="launch-note"><span class="keyboard-note"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or arrow keys to fly</span><span class="touch-note">Drag the flight stick to steer</span><span>NO EXPERIENCE NEEDED</span></div>
      <div id="best" class="best"></div>
    </section>
    <aside class="scene-caption briefing-only"><span class="caption-number">01 — 06</span><h2>The Pelagos Islands</h2><p>Somewhere worth getting lost.</p><div class="coordinates">36° 42′ N &nbsp; 24° 18′ E <span>FICTIONAL AIRSPACE</span></div></aside>
    <div class="aircraft-label briefing-only"><span class="label-line"></span><span><strong>THE WANDERER</strong><small>A-01 · Single-engine explorer</small></span></div>
    <section id="mission" class="mission flight-only" aria-label="Mission progress"><div class="eyebrow">ISLAND EXPEDITION <span id="gate-count">01 / 08</span></div><h2 id="gate-name">Into the blue</h2><p id="gate-distance">Fly through the illuminated rings</p><div class="progress-track"><div id="progress"></div></div><div class="mission-bottom"><span id="timer">00:00</span><span id="score">0 PTS</span></div></section>
    <div class="compass flight-only"><div class="compass-ticks"><span id="compass-left">W · NW</span> &nbsp; <strong id="heading">000° N</strong> &nbsp; <span id="compass-right">NE · E</span></div><span class="heading-notch"></span></div>
    <div id="reticle" class="reticle flight-only"><span></span><i></i><span></span></div>
    <div id="waypoint" class="waypoint flight-only"><span>◇</span><small id="waypoint-distance"></small></div>
    <div id="warning" class="warning" role="status"></div>
    <div id="toast" class="toast" role="status"></div>
    <section class="instruments flight-only" aria-label="Flight instruments">
      <div class="instrument"><label>AIRSPEED</label><div><strong id="speed">130</strong><span>KTS</span></div><div class="instrument-rule"></div></div>
      <div class="attitude"><div id="attitude-ball" class="attitude-ball"><div></div></div><span class="attitude-wings">― · ―</span></div>
      <div class="instrument"><label>ALTITUDE</label><div><strong id="altitude">920</strong><span>FT</span></div><small id="climb">+0 FT / MIN</small></div>
      <div class="instrument throttle-instrument"><label for="throttle">THROTTLE <span id="throttle-value">68%</span></label><input id="throttle" type="range" min="0" max="100" value="68" aria-label="Engine throttle"/><small><span class="keyboard-note">SHIFT + &nbsp; CTRL −</span><span class="touch-note">SLIDE TO ADJUST</span></small></div>
    </section>
    <aside class="map-panel flight-only"><div class="map-header"><span>${icon('compass')} NAVIGATION</span><span id="map-scale">12 KM</span></div><canvas id="minimap" width="480" height="320" aria-label="Map showing aircraft and checkpoint route"></canvas><div class="map-footer"><span>PELAGOS</span><span id="map-coords">000 / 000</span></div></aside>
    <div id="touch-controls" class="touch-controls flight-only"><div id="joystick" class="joystick" aria-label="Touch flight joystick"><div class="joystick-cross"></div><div id="stick" class="stick"></div></div><span>FLIGHT STICK</span></div>
    <div id="cockpit-frame" class="cockpit-frame" hidden><div></div><span>AERONAUT · A-01</span><div></div></div>
  </main>
  <footer class="bottom-bar"><div class="briefing-only weather"><span class="weather-symbol">☀</span> 24°C <span class="footer-divider"></span> WIND 240° / 4 KTS <span class="footer-divider"></span> CLEAR SKIES</div><div class="flight-only control-hints"><span><kbd>W</kbd><kbd>S</kbd> pitch</span><span><kbd>A</kbd><kbd>D</kbd> bank</span><span><kbd>Q</kbd><kbd>E</kbd> rudder</span><span><kbd>R</kbd> restart</span></div><div class="footer-right"><span class="briefing-only edition">EXPLORER’S EDITION &nbsp; / &nbsp; VOL. 001</span><button id="camera" class="text-button flight-only">${icon('camera')} <span id="camera-label">Chase camera</span> <kbd>C</kbd></button><span class="fps" id="fps">60 FPS</span></div></footer>
  <dialog id="overlay"><div class="dialog-inner"><div class="eyebrow" id="dialog-eyebrow">A MOMENT OF STILLNESS</div><h2 id="dialog-title">Flight paused.</h2><div id="dialog-content"></div><div class="dialog-actions"><button id="resume" class="primary-button">Back to the sky ${icon('arrow')}</button><button id="restart" class="secondary-button">Restart flight</button><button id="home" class="text-button">Return to flight briefing</button></div></div></dialog>
  <div id="error" class="error-panel" hidden><h1>We couldn’t start the flight.</h1><p>This game needs a browser with WebGL 2 and hardware acceleration enabled. Try a recent Chrome, Edge, Firefox, or Safari.</p><button onclick="location.reload()" class="primary-button">Try again</button></div>
`;
const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
let state:Flight=createFlight(),world:World;
const audio=new FlightAudio();
const keys=new Set<string>();
let stickX=0,stickY=0,stickPointer:number|null=null,toastUntil=0,helpOpen=false,previousTime=performance.now(),hudAccumulator=0,fpsElapsed=0,fpsFrames=0;
const overlay=el<HTMLDialogElement>('overlay');
let bestScore=0;
try {bestScore=Number(localStorage.getItem('aeronaut-best'))||0;}catch{}
if(bestScore)el('best').textContent=`PERSONAL BEST  /  ${bestScore.toLocaleString()} PTS`;

function clearInput() {keys.clear();stickX=stickY=0;stickPointer=null;el('stick').style.transform='translate(-50%, -50%)';}
function syncLayout() {
  document.body.dataset.state=state.status;
  el('cockpit-frame').hidden=world?.cameraMode!==1||state.status==='briefing';
}
function launch() {
  state=createFlight(state.mode);state.status='flying';clearInput();overlay.close();helpOpen=false;audio.start();syncLayout();
  toast(state.mode==='expedition'?'Follow the amber rings. Your adventure starts here.':'Your sky, your route. Explore the islands.');
}
function toast(message:string) {el('toast').textContent=message;el('toast').classList.add('visible');toastUntil=performance.now()+4500;}
function controlsMarkup() {
  return `<p class="dialog-copy">Small movements make smooth flights. Bank to turn; release the controls to level out.</p><div class="controls-grid"><span>Pitch up / down</span><span><kbd>S</kbd> / <kbd>W</kbd> or <kbd>↓</kbd> / <kbd>↑</kbd></span><span>Bank left / right</span><span><kbd>A</kbd> / <kbd>D</kbd> or <kbd>←</kbd> / <kbd>→</kbd></span><span>Rudder left / right</span><span><kbd>Q</kbd> / <kbd>E</kbd></span><span>Throttle up / down</span><span><kbd>Shift</kbd> / <kbd>Ctrl</kbd></span><span>Camera / sound</span><span><kbd>C</kbd> / <kbd>M</kbd></span><span>Pause / restart</span><span><kbd>Esc</kbd> / <kbd>R</kbd></span></div><p class="dialog-copy touch-tip">Touch: drag the flight stick down to climb, up to descend, and sideways to bank. Use the throttle slider to change speed.</p>`;
}
function showDialog(help=false) {
  helpOpen=help;clearInput();
  if(state.status==='flying')state.status='paused';
  const crashed=state.status==='crashed',complete=state.status==='complete';
  el('dialog-eyebrow').textContent=help?'YOUR QUICK FLIGHT SCHOOL':crashed?'EVERY PILOT STARTS SOMEWHERE':complete?'EXPEDITION COMPLETE':'A MOMENT OF STILLNESS';
  el('dialog-title').textContent=help?'You have the controls.':crashed?'Let’s give it another go.':complete?'The sky looks good on you.':'Flight paused.';
  el('dialog-content').innerHTML=help?controlsMarkup():crashed?`<p class="dialog-copy">${state.position.y>3500||Math.abs(state.position.x)>14000||Math.abs(state.position.z)>17500?'You reached the edge of this airspace. Turn back toward the islands on your next flight.':'Your flight ended near the surface. Keep an eye on altitude, and pull back gently to climb.'}</p><div class="results"><div><strong>${formatTime(state.elapsed)}</strong><span>FLIGHT TIME</span></div><div><strong>${(state.distance/1000).toFixed(1)}</strong><span>KM EXPLORED</span></div></div>`:complete?`<p class="dialog-copy">Eight gates. Six islands. One beautiful flight.</p><div class="results"><div><strong>${state.score.toLocaleString()}</strong><span>POINTS</span></div><div><strong>${formatTime(state.elapsed)}</strong><span>FLIGHT TIME</span></div></div><p class="dialog-copy">Fly closer to the center of each ring to improve your score.</p>`:`<p class="dialog-copy">The islands will be right here when you’re ready.</p><div class="results"><div><strong>${formatTime(state.elapsed)}</strong><span>FLIGHT TIME</span></div><div><strong>${Math.round(state.speed*1.94384)}</strong><span>AIRSPEED · KTS</span></div></div>`;
  el('resume').hidden=crashed||complete;
  el('resume').innerHTML=state.status==='briefing'?`Ready to fly ${icon('arrow')}`:`Back to the sky ${icon('arrow')}`;
  el('restart').hidden=state.status==='briefing';
  if(!overlay.open)overlay.showModal();syncLayout();
}
function resume() {overlay.close();helpOpen=false;if(state.status==='paused')state.status='flying';clearInput();audio.start();syncLayout();}
function togglePause() {if(state.status==='flying')showDialog();else if(state.status==='paused'||helpOpen)resume();}
function toggleSound() {audio.muted=!audio.muted;el('sound').innerHTML=icon(audio.muted?'muted':'sound');el('sound').setAttribute('aria-label',audio.muted?'Unmute sound':'Mute sound');el('sound').setAttribute('aria-pressed',String(audio.muted));}
function cycleCamera() {world.cameraMode=(world.cameraMode+1)%3;el('camera-label').textContent=['Chase camera','Cockpit view','Wing camera'][world.cameraMode];syncLayout();}
async function fullscreen() {try {if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('Fullscreen is unavailable in this browser.');}}
el('launch').onclick=launch;
el('resume').onclick=resume;
el('restart').onclick=launch;
el('home').onclick=()=>{overlay.close();state=createFlight(state.mode);clearInput();helpOpen=false;syncLayout();};
el('pause').onclick=togglePause;
el('help').onclick=()=>showDialog(true);
el('sound').onclick=toggleSound;
el('camera').onclick=cycleCamera;
el('fullscreen').onclick=fullscreen;
el('lighting').onclick=()=>{world.setLighting(!world.golden);el('time-label').textContent=world.golden?'GOLDEN HOUR':'HIGH NOON';};
el<HTMLInputElement>('throttle').oninput=event=>{state.throttle=Number((event.target as HTMLInputElement).value)/100;};
document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(button=>button.onclick=()=>{
  state.mode=button.dataset.mode as Flight['mode'];
  document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button));});
});
overlay.addEventListener('cancel',event=>{event.preventDefault();if(state.status==='paused'||helpOpen)resume();});
window.addEventListener('keydown',event=>{
  const focused=event.target as HTMLElement;
  if(focused.tagName==='INPUT'||focused.tagName==='SELECT'||focused.tagName==='TEXTAREA')return;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(event.code))event.preventDefault();
  if(event.repeat)return;
  if(event.code==='Escape'||event.code==='KeyP'){event.preventDefault();togglePause();return;}
  if(event.code==='KeyH'){if(helpOpen)resume();else showDialog(true);return;}
  if(overlay.open)return;
  if(event.code==='KeyM')toggleSound();
  if(event.code==='KeyF')void fullscreen();
  if(event.code==='KeyC'&&state.status==='flying')cycleCamera();
  if(event.code==='KeyR'&&state.status==='flying')launch();
  keys.add(event.code);
});
window.addEventListener('keyup',event=>keys.delete(event.code));
window.addEventListener('blur',()=>{clearInput();if(state.status==='flying')showDialog();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(state.status==='flying')showDialog();}previousTime=performance.now();});
const joystick=el('joystick');
function moveStick(event:PointerEvent) {
  const rect=joystick.getBoundingClientRect(),radius=rect.width*.33;
  let x=(event.clientX-rect.left-rect.width/2)/radius,y=(event.clientY-rect.top-rect.height/2)/radius;
  const length=Math.hypot(x,y);if(length>1){x/=length;y/=length;}
  stickX=x;stickY=y;el('stick').style.transform=`translate(calc(-50% + ${x*radius}px), calc(-50% + ${y*radius}px))`;
}
joystick.addEventListener('pointerdown',e=>{if(stickPointer!==null)return;stickPointer=e.pointerId;joystick.setPointerCapture(e.pointerId);moveStick(e);});
joystick.addEventListener('pointermove',e=>{if(e.pointerId===stickPointer)moveStick(e);});
for(const type of ['pointerup','pointercancel','lostpointercapture'])joystick.addEventListener(type,()=>{stickPointer=null;stickX=stickY=0;el('stick').style.transform='translate(-50%, -50%)';});
window.addEventListener('resize',()=>world?.resize());
el<HTMLCanvasElement>('world').addEventListener('webglcontextlost',e=>{e.preventDefault();if(state.status==='flying')showDialog();el('error').hidden=false;});

function formatTime(seconds:number) {return `${Math.floor(seconds/60).toString().padStart(2,'0')}:${Math.floor(seconds%60).toString().padStart(2,'0')}`;}
const map=el<HTMLCanvasElement>('minimap'),ctx=map.getContext('2d')!;
function drawMap() {
  const w=map.width,h=map.height,cx=w/2,cy=h/2,scale=.031;
  const mx=(x:number)=>cx+(x-state.position.x)*scale,mz=(z:number)=>cy+(z-state.position.z)*scale;
  ctx.clearRect(0,0,w,h);ctx.strokeStyle='rgba(220,239,218,.06)';ctx.lineWidth=1;
  for(let x=0;x<w;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}for(let y=0;y<h;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
  for(const island of islands) {
    ctx.fillStyle='#456d68';ctx.strokeStyle='#73928a';ctx.lineWidth=1.2;ctx.beginPath();
    for(let i=0;i<=64;i++){const a=i/64*Math.PI*2,r=1/(1+.09*Math.sin(a*5)+.05*Math.cos(a*9)),x=mx(island.x+Math.cos(a)*island.rx*r),y=mz(island.z+Math.sin(a)*island.rz*r);i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);}ctx.closePath();ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.ellipse(mx(island.x),mz(island.z),island.rx*scale*.55,island.rz*scale*.55,0,0,Math.PI*2);ctx.strokeStyle='#628179';ctx.stroke();
  }
  if(state.mode==='expedition') {
    ctx.beginPath();ctx.setLineDash([5,7]);ctx.strokeStyle='#e4b47e';ctx.lineWidth=1.7;
    checkpoints.forEach((p,i)=>i===0?ctx.moveTo(mx(p.x),mz(p.z)):ctx.lineTo(mx(p.x),mz(p.z)));ctx.stroke();ctx.setLineDash([]);
    checkpoints.forEach((p,i)=>{ctx.beginPath();ctx.arc(mx(p.x),mz(p.z),i===state.checkpoint?7:4,0,Math.PI*2);ctx.fillStyle=i<state.checkpoint?'#76c9b1':i===state.checkpoint?'#ffaf68':'#b6b2a0';ctx.fill();});
  }
  ctx.save();ctx.translate(cx,cy);ctx.rotate(-state.heading);ctx.shadowColor='#f1edcf';ctx.shadowBlur=12;ctx.fillStyle='#fff7d7';ctx.beginPath();ctx.moveTo(0,-12);ctx.lineTo(8,9);ctx.lineTo(0,5);ctx.lineTo(-8,9);ctx.closePath();ctx.fill();ctx.restore();
  ctx.fillStyle='#bed3c8';ctx.font='20px monospace';ctx.fillText('N',w-25,27);
}
function updateHud(now:number) {
  el('speed').textContent=String(Math.round(state.speed*1.94384));
  el('altitude').textContent=Math.round(state.position.y*3.28084).toLocaleString();
  el('climb').textContent=`${state.verticalSpeed>=0?'+':''}${Math.round(state.verticalSpeed*196.85)} FT / MIN`;
  el('throttle-value').textContent=`${Math.round(state.throttle*100)}%`;
  if(document.activeElement!==el('throttle'))el<HTMLInputElement>('throttle').value=String(Math.round(state.throttle*100));
  const heading=(((-state.heading*180/Math.PI)%360)+360)%360;
  el('heading').textContent=`${Math.round(heading).toString().padStart(3,'0')}° ${['N','NE','E','SE','S','SW','W','NW'][Math.round(heading/45)%8]}`;
  const cardinal=(offset:number)=>['N','NE','E','SE','S','SW','W','NW'][(Math.round(heading/45)+offset+8)%8];
  el('compass-left').textContent=`${cardinal(-2)}  ·  ·  ${cardinal(-1)}  ·  ·`;
  el('compass-right').textContent=`·  ·  ${cardinal(1)}  ·  ·  ${cardinal(2)}`;
  el('attitude-ball').style.transform=`rotate(${-state.roll*180/Math.PI}deg) translateY(${state.pitch*45}px)`;
  el('timer').textContent=formatTime(state.elapsed);el('score').textContent=`${state.score.toLocaleString()} PTS`;
  el('progress').style.width=`${state.checkpoint/checkpoints.length*100}%`;
  el('gate-count').textContent=state.mode==='free'?'FREE':`${String(Math.min(8,state.checkpoint+1)).padStart(2,'0')} / 08`;
  const gate=checkpoints[Math.min(state.checkpoint,checkpoints.length-1)];
  const distance=Math.hypot(gate.x-state.position.x,gate.y-state.position.y,gate.z-state.position.z);
  el('gate-name').textContent=state.mode==='free'?'A sky of your own':gate.name;
  el('gate-distance').textContent=state.mode==='free'?`${(state.distance/1000).toFixed(1)} km explored · Enjoy the view`:`${distance>=1000?(distance/1000).toFixed(1)+' km':Math.round(distance)+' m'} to checkpoint · ${Math.round(gate.y*3.28084).toLocaleString()} ft`;
  el('map-coords').textContent=`${Math.round(state.position.x)} / ${Math.round(-state.position.z)}`;
  el('map-scale').textContent='15 KM';
  const waypoint=el('waypoint');
  if(state.mode==='expedition'&&state.status==='flying') {
    const target=world.aircraft.position.clone().set(gate.x,gate.y,gate.z),projected=target.clone().project(world.camera);
    const inFront=target.sub(world.camera.position).dot(world.camera.getWorldDirection(world.aircraft.position.clone()))>0;
    const onscreen=inFront&&Math.abs(projected.x)<.86&&Math.abs(projected.y)<.68;
    waypoint.style.left=onscreen?`${(projected.x*.5+.5)*100}%`:'50%';
    waypoint.style.top=onscreen?`${(-projected.y*.5+.5)*100}%`:'24%';
    waypoint.classList.toggle('offscreen',!onscreen);
    el('waypoint-distance').textContent=onscreen?`${(distance/1000).toFixed(1)} KM`:'TURN TOWARD THE NEXT GATE';
    waypoint.style.visibility='visible';
  } else waypoint.style.visibility='hidden';
  const agl=state.position.y-Math.max(0,terrainHeight(state.position.x,state.position.z));
  el('warning').textContent=state.status!=='flying'?'':state.stall?'STALL · INCREASE THROTTLE':agl<65?'LOW ALTITUDE · PULL UP':state.position.y>3000||Math.abs(state.position.x)>12500||Math.abs(state.position.z)>16000?'AIRSPACE BOUNDARY · TURN BACK':'';
  el('warning').classList.toggle('visible',!!el('warning').textContent);
  if(now>toastUntil)el('toast').classList.remove('visible');
  drawMap();
}
function frame(now:number) {
  const rawDelta=(now-previousTime)/1000,dt=Math.min(rawDelta,.05);previousTime=now;
  const oldCheckpoint=state.checkpoint,oldStatus=state.status;
  const down=(...codes:string[])=>codes.some(code=>keys.has(code))?1:0;
  stepFlight(state,{pitch:clamp(down('KeyS','ArrowDown')-down('KeyW','ArrowUp')+stickY,-1,1),roll:clamp(down('KeyD','ArrowRight')-down('KeyA','ArrowLeft')+stickX,-1,1),yaw:down('KeyQ')-down('KeyE'),throttle:down('ShiftLeft','ShiftRight')-down('ControlLeft','ControlRight')},dt);
  if(state.checkpoint>oldCheckpoint){audio.chime();toast(`CHECKPOINT ${String(state.checkpoint).padStart(2,'0')} CLEARED  /  ${state.score.toLocaleString()} PTS`);}
  if(oldStatus==='flying'&&(state.status==='crashed'||state.status==='complete')) {
    if(state.status==='complete'&&state.score>bestScore){bestScore=state.score;try{localStorage.setItem('aeronaut-best',String(bestScore));}catch{}el('best').textContent=`PERSONAL BEST  /  ${bestScore.toLocaleString()} PTS`;}
    showDialog();
  }
  world.render(state,dt);audio.update(state.throttle,state.status==='flying');
  hudAccumulator+=dt;fpsElapsed+=rawDelta;fpsFrames++;
  if(hudAccumulator>.08){updateHud(now);hudAccumulator=0;}
  if(fpsElapsed>1){el('fps').textContent=`${Math.round(fpsFrames/fpsElapsed)} FPS`;fpsFrames=0;fpsElapsed=0;}
  requestAnimationFrame(frame);
}
try {
  world=new World(el<HTMLCanvasElement>('world'));syncLayout();updateHud(performance.now());requestAnimationFrame(frame);
}catch(error){console.error('Flight initialization failed:',error);el('error').hidden=false;}
