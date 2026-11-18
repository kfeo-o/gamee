'use strict';
/* NEON SIEGE 5.0: original hand-built 3D polygon streets, kinetic controls,
   fictional energy projectiles and optional peer-to-peer friend arena. */
const V5 = {projectiles:[], faces:[], ladders:[], particles:[], time:0,
  duel:null, remote:null, localScore:0, remoteScore:0, playerDeadUntil:0,
  audioReady:false, climb:null, chatReady:false, duelFinished:false};
const EPS=0.0001;
const v5min=(x,a,b)=>Math.max(a,Math.min(b,x));
const v5distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const v5Eyes=()=>({x:player.x,y:(player.y||0)+1.55+(player.slideTime>0?-.48:0),z:player.z});
function faceColor(tile,side){const m=MAPS[mapId];return m.wall[(tile-1)%m.wall.length]||m.wall[0]}
function roofHeight(x,z){const i=Math.floor(x),j=Math.floor(z);const tile=grid[j]?.[i]||0;return tile?(tile===3?5.4:tile===2?3.4:4.25):0}
function v5Face(verts,color,kind='wall',extra={}){V5.faces.push({verts,color,kind,...extra})}
function build3D(){
 V5.faces=[];V5.ladders=[];
 const col=MAPS[mapId].floor;
 // The sidewalk tiles, streets and squares are actual world-space ground polygons.
 for(let x=0;x<40;x+=2)for(let z=0;z<40;z+=2){
   const clr=(x%8===0||z%8===0)?MAPS[mapId].floor:col;
   v5Face([[x,.005,z],[x+2,.005,z],[x+2,.005,z+2],[x,.005,z+2]],clr,'floor');
 }
 for(const d of decals){v5Face([[d.x,.018,d.z],[d.x+d.w,.018,d.z],[d.x+d.w,.018,d.z+d.h],[d.x,.018,d.z+d.h]],d.color,'decal',{alpha:v5min(d.a+.20,.2,.88)});}
 for(let z=0;z<ARENA_SIZE;z++)for(let x=0;x<ARENA_SIZE;x++){
   const tile=grid[z][x];if(!tile)continue;
   const h=roofHeight(x+.5,z+.5),color=faceColor(tile);
   v5Face([[x,h,z],[x+1,h,z],[x+1,h,z+1],[x,h,z+1]],color,'roof');
   for(const [dx,dz] of [[0,-1],[1,0],[0,1],[-1,0]]){
     const nh=roofHeight(x+.5+dx,z+.5+dz);if(nh>=h-.01)continue;
     let quad;
     if(dx===1)quad=[[x+1,nh,z],[x+1,h,z],[x+1,h,z+1],[x+1,nh,z+1]];
     if(dx===-1)quad=[[x,nh,z+1],[x,h,z+1],[x,h,z],[x,nh,z]];
     if(dz===1)quad=[[x+1,nh,z+1],[x+1,h,z+1],[x,h,z+1],[x,nh,z+1]];
     if(dz===-1)quad=[[x,nh,z],[x,h,z],[x+1,h,z],[x+1,nh,z]];
     const facing = dx===1?'east':dx===-1?'west':dz===1?'south':'north';
     v5Face(quad,color,'wall',{facing,tile,x,z,h,low:nh});
   }
 }
 // Select climbable exterior walls close to the central street network.
 const options=[];
 for(let z=2;z<39;z++)for(let x=2;x<39;x++)if(grid[z][x]){
   const h=roofHeight(x+.5,z+.5);if(h>4.5)continue;
   for(const [dx,dz] of [[-1,0],[1,0],[0,-1],[0,1]]){
     if(grid[z+dz]?.[x+dx])continue;
     if(Math.hypot(x+.5-CENTER,z+.5-CENTER)<4.0)continue;
     const a={x:x+.5+dx*.62,z:z+.5+dz*.62,roofX:x+.5,roofZ:z+.5,h,dx,dz};
     options.push(a);
   }
 }
 options.sort((a,b)=>Math.abs(a.x-CENTER)+Math.abs(a.z-CENTER)-Math.abs(b.x-CENTER)-Math.abs(b.z-CENTER));
 for(const a of options){if(V5.ladders.every(b=>Math.hypot(a.x-b.x,a.z-b.z)>7))V5.ladders.push(a);if(V5.ladders.length>=9)break;}
 // Ladder rungs form real vertical 3D geometry, not screen-space stickers.
 for(const L of V5.ladders){
   const alongX=Math.abs(L.dx)===1;
   const offx=alongX?0:.24,offz=alongX?.24:0;
   for(let y=.22;y<L.h-.1;y+=.37){
      v5Face([[L.x-offx,y,L.z-offz],[L.x+offx,y,L.z+offz],[L.x+offx,y+.07,L.z+offz],[L.x-offx,y+.07,L.z-offz]],'#d6f3a1','ladder');
   }
   for(let off of [-.25,.25]){
      const px=L.x+(alongX?0:off),pz=L.z+(alongX?off:0);
      v5Face([[px,0,pz],[px,L.h,pz],[px+.055,L.h,pz+.055],[px+.055,0,pz+.055]],'#66d8ff','ladder');
   }
 }
}
const v4buildArena=buildArena;
buildArena=function(id){v4buildArena(id);build3D();V5.projectiles.length=0;V5.climb=null;};
// All movement is camera-relative, accelerated, momentum-based and supports multi-directional input.
function v5CanMove(x,z,y){
 const r=.24;for(const dx of [-r,r])for(const dz of [-r,r]){
  const X=x+dx,Z=z+dz;
  if(X<.3||Z<.3||X>ARENA_SIZE-.3||Z>ARENA_SIZE-.3)return false;
  const h=roofHeight(X,Z);if(h>.1&&y<h-.12)return false;
 }
 return true;
}
function v5Ground(x,z,y){const r=.18;let h=0;
 for(const dx of [-r,r])for(const dz of [-r,r]){const th=roofHeight(x+dx,z+dz);if(th<=y+.2)h=Math.max(h,th)}
 return h;
}
function v5Jump(){if((state==='PLAYING'||state==='DUEL')&&player.onGround&&!V5.climb){player.vY=5.9;player.onGround=false;player.jumpY=0;snd('wave')}}
jump=v5Jump;
function v5Ladder(){return V5.ladders.find(L=>Math.hypot(player.x-L.x,player.z-L.z)<1.45&&player.y<L.h-.1)}
function v5Interact(){
 if(state!=='PLAYING'&&state!=='DUEL')return;
 const L=v5Ladder();
 if(L){V5.climb={L,startY:player.y,elapsed:0,duration:Math.max(.55,(L.h-player.y)/3.15)};player.vx=0;player.vz=0;player.vY=0;toast('CLIMBING TO THE ROOFTOP',1.15);return;}
 if(state==='PLAYING')activateStation();
}
const v4updateStations=updateStations;
updateStations=function(){v4updateStations();if(state!=='PLAYING')return;const L=v5Ladder();if(L){$('interact-prompt').classList.remove('hidden');$('interact-prompt').innerHTML='PRESS <b>F</b> TO CLIMB LADDER';}else if(stationNear){$('interact-prompt').innerHTML='PRESS <b>F</b> TO ACTIVATE FIELD BEACON';}}
function v5MovePlayer(dt){
 player.vx??=0;player.vz??=0;player.y??=0;player.vY??=0;player.onGround??=true;player.slideTime??=0;
 player.invuln=Math.max(0,(player.invuln||0)-dt);
 player.dashCooldown=Math.max(0,(player.dashCooldown||0)-dt);
 player.dashTime=Math.max(0,(player.dashTime||0)-dt);
 player.slideTime=Math.max(0,(player.slideTime||0)-dt);
 if(V5.climb){
  const c=V5.climb;c.elapsed+=dt;const p=Math.min(1,c.elapsed/c.duration);
  const ease=p*p*(3-2*p);player.y=c.startY+(c.L.h-c.startY)*ease;
  player.x=lerp(player.x,c.L.roofX,ease*.17);player.z=lerp(player.z,c.L.roofZ,ease*.17);
  if(p>=1){player.x=c.L.roofX;player.z=c.L.roofZ;player.y=c.L.h;player.onGround=true;player.vY=0;V5.climb=null;toast('ROOFTOP REACHED · SPACE TO JUMP',1.4)}
 }else{
  const f=(keys.KeyW||keys.ArrowUp||touchHeld.has('w')?1:0)-(keys.KeyS||keys.ArrowDown||touchHeld.has('s')?1:0);
  const s=(keys.KeyD||touchHeld.has('d')?1:0)-(keys.KeyA||touchHeld.has('a')?1:0);
  const mag=Math.hypot(f,s)||1;
  const ca=Math.cos(player.a),sa=Math.sin(player.a);
  const ix=(ca*f-sa*s)/mag,iz=(sa*f+ca*s)/mag;
  const sprint=keys.ShiftLeft||keys.ShiftRight||touchHeld.has('sprint');
  const speed=player.speed*(1+upg.speed*.1)*(sprint?1.53:1)*(player.slideTime>0?1.65:1);
  const targetX=ix*speed,targetZ=iz*speed;
  const accel=player.onGround?12.5:4.4,drag=player.onGround?8:1.6;
  const factor=1-Math.exp(-(f||s?accel:drag)*dt);
  player.vx=lerp(player.vx,targetX,factor);player.vz=lerp(player.vz,targetZ,factor);
  if(player.dashTime>0){player.vx+=ix*7*dt*3;player.vz+=iz*7*dt*3;}
  const nx=player.x+player.vx*dt,nz=player.z+player.vz*dt;
  if(v5CanMove(nx,player.z,player.y))player.x=nx;else player.vx=0;
  if(v5CanMove(player.x,nz,player.y))player.z=nz;else player.vz=0;
  player.vY-=14.7*dt;
  const priorY=player.y;player.y=Math.max(0,player.y+player.vY*dt);
  const ground=v5Ground(player.x,player.z,priorY);
  if(player.vY<=0&&player.y<=ground){player.y=ground;player.vY=0;player.onGround=true}
  else player.onGround=false;
  if(player.y>0&&roofHeight(player.x,player.z)>player.y+.05){player.y=roofHeight(player.x,player.z);player.vY=0;player.onGround=true;}
  if(f||s)bob+=dt*(sprint?17:11);else bob=lerp(bob,0,dt*2);
 }
 if(keys.ArrowLeft||keys.KeyQ||touchHeld.has('lookL'))player.a-=dt*2.1;
 if(keys.ArrowRight||keys.KeyE||touchHeld.has('lookR'))player.a+=dt*2.1;
 if(shootDown||touchHeld.has('fire'))shoot();
 fireCooldown=Math.max(0,fireCooldown-dt);
 if(reloadTimer>0){reloadTimer-=dt;if(reloadTimer<=0){reloadTimer=0;const w=getWeapon(),slot=weapons[activeWeapon],n=Math.min(w.magSize-slot.mag,slot.reserve);slot.mag+=n;slot.reserve-=n;refreshHUD()}}
 if(state==='PLAYING')for(let i=pickups.length-1;i>=0;i--){const p=pickups[i];p.life-=dt;if(p.life<=0){pickups.splice(i,1);continue}if(Math.hypot(player.x-p.x,player.z-p.z)<.78&&player.y<1.7){if(p.type==='health')player.hp=Math.min(player.maxHp,player.hp+25);else if(p.type==='shield')player.shield=Math.min(100,player.shield+22);else weapons.forEach((slot,j)=>{if(slot.unlocked)slot.reserve+=WEAPONS[j].magSize});toast('SUPPLY COLLECTED',1.1);snd('buy');pickups.splice(i,1);refreshHUD()}}
 v5Projectiles(dt);
}
updatePlayer=v5MovePlayer;
const v4dash=dash;
dash=function(){if(state==='DUEL' || state==='PLAYING'){if(player.dashCooldown<=0){player.dashTime=.26;player.dashCooldown=2;toast('DASH!',.55);snd('pulse')}}};
// Additional original cartoon energy launchers unlock through the wave shop.
const extraBlasters=[
 {id:'ion',name:'ION SPARK',magSize:36,reserveStart:216,damage:21,rate:.115,reload:1.3,pellets:1,spread:.012,speed:31,color:'#99ff67',cost:440},
 {id:'comet',name:'COMET DRIVER',magSize:7,reserveStart:56,damage:87,rate:.82,reload:2.1,pellets:1,spread:.008,speed:20,color:'#ffae5d',cost:550},
 {id:'echo',name:'ECHO TRI-BURST',magSize:30,reserveStart:180,damage:19,rate:.34,reload:1.7,pellets:3,spread:.038,speed:33,color:'#bb8bff',cost:620},
 {id:'zenith',name:'ZENITH PRISM',magSize:18,reserveStart:90,damage:74,rate:.56,reload:2.0,pellets:1,spread:.002,speed:44,color:'#faf5ac',cost:780}
];
WEAPONS.push(...extraBlasters);
for(const b of extraBlasters)shopDefs.push({id:b.id,name:'✧ '+b.name,desc:'Unlock this unique fictional energy blaster permanently.',base:b.cost});
function v5ReadUnlocks(){try{const a=JSON.parse(localStorage.getItem('neonsiege-v5-armory')||'[]');return Array.isArray(a)?a:[]}catch(e){return []}}
function v5PersistUnlocks(){try{const unlocked=WEAPONS.filter((w,i)=>weapons[i]?.unlocked).map(w=>w.id);localStorage.setItem('neonsiege-v5-armory',JSON.stringify(unlocked))}catch(e){}}
function v5EnsureWeapons(){
 const saved=v5ReadUnlocks();
 weapons=WEAPONS.map((w,i)=>({unlocked:i===0||saved.includes(w.id),mag:w.magSize,reserve:w.reserveStart}));
 activeWeapon=0;
}
let armoryDrawnOnce=false;
const originalBuildWeaponArt=buildWeaponArt;
function v5EnergyArt(i){
 const b=WEAPONS[i],c=document.createElement('canvas');c.width=520;c.height=440;const g=c.getContext('2d');
 const color=b.color;const poly=(p,fill,stroke='#a2bfcc')=>{g.beginPath();g.moveTo(...p[0]);for(const q of p.slice(1))g.lineTo(...q);g.closePath();g.fillStyle=fill;g.fill();g.strokeStyle=stroke;g.lineWidth=5;g.stroke()};
 const glow=(x,y,r)=>{const rad=g.createRadialGradient(x,y,0,x,y,r);rad.addColorStop(0,'#fff');rad.addColorStop(.2,color);rad.addColorStop(1,'transparent');g.fillStyle=rad;g.beginPath();g.arc(x,y,r,0,7);g.fill()};
 const ring=(x,y,r)=>{g.strokeStyle=color;g.lineWidth=11;g.beginPath();g.arc(x,y,r,0,7);g.stroke();g.strokeStyle='#a9d5d8';g.lineWidth=3;g.beginPath();g.arc(x,y,r+5,0,7);g.stroke()};
 // Distinct body architecture for every added blaster, not color swaps.
 if(i===4){poly([[155,250],[188,198],[368,186],[408,228],[374,269],[175,278]],'#173f3f');poly([[222,184],[250,115],[320,114],[335,191]],'#32564a');ring(269,209,32);poly([[390,198],[460,203],[464,239],[387,251]],'#26434d');for(let k=0;k<5;k++)g.fillRect(186+k*37,269,19,8);}
 if(i===5){poly([[120,289],[153,203],[346,186],[428,226],[450,289],[391,316],[169,319]],'#4a2f30');poly([[193,183],[241,121],[355,144],[389,214]],'#664d47');ring(321,225,42);poly([[370,190],[438,165],[480,208],[476,263],[413,272]],'#523838');glow(445,219,33);}
 if(i===6){poly([[110,252],[158,207],[396,197],[435,252],[382,295],[142,286]],'#342f54');for(const k of [0,1,2]){const x=192+k*85;poly([[x-30,200],[x-18,127],[x+30,124],[x+42,200]],'#403e66');ring(x+3,206,21)}poly([[400,211],[471,213],[487,241],[477,271],[411,266]],'#242b54');}
 if(i===7){poly([[140,269],[170,203],[390,194],[414,265],[375,319],[189,315]],'#42535b');poly([[221,199],[255,88],[291,61],[328,190]],'#4d666d');poly([[287,195],[330,110],[352,98],[389,195]],'#263d5c');ring(304,199,49);poly([[360,195],[432,177],[477,191],[485,250],[403,277]],'#395063');glow(439,219,35);}
 poly([[218,284],[272,281],[286,402],[244,420],[203,395]],'#182638','#59859b');
 poly([[178,381],[212,334],[256,330],[275,385],[245,434],[183,430]],'#273f51','#7192ad');
 g.fillStyle='#c9edff';g.font='bold 17px monospace';g.fillText(b.name,200,286);
 for(let n=0;n<5;n++){g.fillStyle=color;g.fillRect(216+n*26,303,15,6)}
 return c;
}
buildWeaponArt=function(){originalBuildWeaponArt();for(let i=4;i<WEAPONS.length;i++)weaponArt[i]=v5EnergyArt(i);armoryDrawnOnce=true;};
const v4switchWeapon=switchWeapon;
switchWeapon=function(i){
 if(state==='PLAYING')return v4switchWeapon(i);
 if(state!=='DUEL'||!weapons[i]?.unlocked||i===activeWeapon)return;
 activeWeapon=i;reloadTimer=0;fireCooldown=.16;toast(WEAPONS[i].name,.8);refreshHUD();snd('reload');
};
const v4cycle=cycleWeapon;
cycleWeapon=function(dir){for(let j=0;j<WEAPONS.length;j++){const next=(activeWeapon+dir*(j+1)+WEAPONS.length*12)%WEAPONS.length;if(weapons[next]?.unlocked){switchWeapon(next);return;}}};
const v4buyCost=buyCost;
buyCost=function(item){return v4buyCost(item)};
buyState=function(item){
 const desc=shopDefs.find(s=>s.id===item);if(!desc)return {cost:Infinity,reason:'UNKNOWN'};
 const widx=WEAPONS.findIndex(w=>w.id===item),cost=buyCost(item);
 let reason='';
 if(['damage','rate','speed','maxhp'].includes(item)&&upg[item]>=(item==='damage'?6:5))reason='MAXED OUT';
 if(item==='heal'&&player.hp>=player.maxHp)reason='ALREADY FULL';
 if(item==='shield'&&player.shield>=100)reason='ALREADY FULL';
 if(widx>0&&weapons[widx]?.unlocked)reason='OWNED';
 if(item==='ammo'&&weapons.every((slot,i)=>!slot.unlocked||slot.reserve>=WEAPONS[i].reserveStart*1.5))reason='AMMO STOCKED';
 if(!reason&&coins<cost)reason='NOT ENOUGH';
 return {cost,reason};
};
buy=function(item){if(state!=='SHOP')return;const {cost,reason}=buyState(item);if(reason)return;
 coins-=cost;
 if(item==='heal')player.hp=Math.min(player.maxHp,player.hp+45);
 if(item==='shield')player.shield=Math.min(100,player.shield+60);
 if(item==='ammo')weapons.forEach((slot,i)=>{if(slot.unlocked)slot.reserve+=WEAPONS[i].reserveStart});
 if(['damage','rate','speed','maxhp'].includes(item))upg[item]++;
 if(item==='maxhp'){player.maxHp+=20;player.hp=Math.min(player.maxHp,player.hp+20)}
 if(item==='pulse')player.pulses+=2;
 const idx=WEAPONS.findIndex(w=>w.id===item);
 if(idx>0){weapons[idx].unlocked=true;activeWeapon=idx;v5PersistUnlocks();toast('PERMANENT UNLOCK: '+WEAPONS[idx].name,1.8)}
 snd('buy');renderShop();refreshHUD();
};
// Decorative muzzle flash, glowing projectile streak and *actual collision* are separate systems.
function v5Fire(){
 if((state!=='PLAYING'&&state!=='DUEL')||fireCooldown>0||reloadTimer>0||V5.climb||(state==='DUEL'&&V5.duelFinished))return;
 const w=getWeapon(),slot=weapons[activeWeapon];if(!slot||slot.mag<=0){reload();return;}
 slot.mag--;fireCooldown=w.rate/(1+upg.rate*.12);shotFlash=.115;weaponKick=1;shake=.06;
 snd('shoot');
 const sprint=keys.ShiftLeft||keys.ShiftRight;
 const spread=w.spread*(sprint?1.6:1);
 const eye=v5Eyes();
 for(let p=0;p<w.pellets;p++){
   const ang=player.a+(Math.random()*2-1)*spread,pi=player.pitch+(Math.random()*2-1)*spread*.6;
   const d={x:Math.cos(ang)*Math.cos(pi),y:-Math.sin(pi),z:Math.sin(ang)*Math.cos(pi)};
   const origin={x:eye.x+d.x*.5,y:eye.y+d.y*.5,z:eye.z+d.z*.5};
   const proj={p:{...origin},last:{...origin},d,life:1.45,speed:w.speed||38,damage:w.damage*(1+upg.damage*.2),color:w.color,owner:'local',radius:.09,kind:w.id};
   V5.projectiles.push(proj);
   if(state==='DUEL')v5Send({t:'fire',p:origin,d,w:activeWeapon});
 }
 if(slot.mag===0&&slot.reserve>0)toast('RELOAD · PRESS R',.9);
 refreshHUD();
}
shoot=v5Fire;
const v4reload=reload;
reload=function(){if(state==='DUEL'){if(reloadTimer>0)return;const w=getWeapon(),s=weapons[activeWeapon];if(s.mag>=w.magSize)return;reloadTimer=w.reload;shootDown=false;snd('reload')}else v4reload()};
function v5WorldCollision(p){
 if(p.x<.3||p.z<.3||p.x>=40.7||p.z>=40.7)return true;
 if(p.y<.05)return true;
 const roof=roofHeight(p.x,p.z);return roof>0&&p.y<roof;
}
function v5TargetHit(a,b,t){
 const dx=b.x-a.x,dz=b.z-a.z,lensq=dx*dx+dz*dz||1;
 const tx=v5min(((t.x-a.x)*dx+(t.z-a.z)*dz)/lensq,0,1);
 const xx=a.x+dx*tx,zz=a.z+dz*tx,yy=a.y+(b.y-a.y)*tx;
 return Math.hypot(xx-t.x,zz-t.z)<t.radius&&yy>=t.y+.08&&yy<=t.y+t.height;
}
function v5OnContact(proj,point,target){
 if(target==='bot'){
   const e=proj.victim;
   if(e&&!e.dead){e.hp-=Math.max(1,Math.round(proj.damage));e.hitTimer=.18;hitTimer=.12;
     score+=5;snd('hit');if(e.hp<=0)killEnemy(e);}
 }
 if(target==='self'&&state==='DUEL'&&now>V5.playerDeadUntil){
   const d=Math.max(1,Math.round(proj.damage));player.shield=Math.max(0,player.shield-d*.3);player.hp=Math.max(0,player.hp-d*.7);
   damageFlash=.32;hitTimer=.1;snd('hurt');refreshHUD();
   if(player.hp<=0)v5DuelDown();
 }
 for(let k=0;k<5;k++){V5.particles.push({p:{x:point.x,y:point.y,z:point.z},d:{x:(Math.random()-.5)*2.8,y:Math.random()*3,z:(Math.random()-.5)*2.8},life:.25+.3*Math.random(),max:.55,color:proj.color})}
}
function v5Projectiles(dt){
 for(let i=V5.projectiles.length-1;i>=0;i--){
  const pr=V5.projectiles[i];pr.life-=dt;if(pr.life<=0){V5.projectiles.splice(i,1);continue;}
  pr.last={...pr.p};const stepLength=pr.speed*dt,n=Math.max(1,Math.ceil(stepLength/.095));let target=null;
  for(let j=0;j<n;j++){
   const before={...pr.p};pr.p.x+=pr.d.x*stepLength/n;pr.p.y+=pr.d.y*stepLength/n;pr.p.z+=pr.d.z*stepLength/n;
   // Walls, ground, and rooftops stop projectiles. No aim attraction is applied.
   if(v5WorldCollision(pr.p)){target='world';break}
   if(pr.owner==='local'&&state==='PLAYING'){
     const candidates=enemies;
     for(const e of candidates){if(e.hp<=0)continue;
       if(v5TargetHit(before,pr.p,{x:e.x,y:0,z:e.z,radius:e.radius,height:e.type==='boss'?2.7:1.85})){pr.victim=e;target='bot';break;}
     }
   }else if(pr.owner==='remote'&&state==='DUEL'&&now>V5.playerDeadUntil){
     if(v5TargetHit(before,pr.p,{x:player.x,y:player.y,z:player.z,radius:.28,height:1.8}))target='self';
   }else if(pr.owner==='local'&&state==='DUEL'&&V5.remote){
     if(v5TargetHit(before,pr.p,{x:V5.remote.x,y:V5.remote.y,z:V5.remote.z,radius:.28,height:1.8}))target='visual';
   }
   if(target)break;
  }
  if(target){v5OnContact(pr,pr.p,target);V5.projectiles.splice(i,1)}
 }
 for(let i=V5.particles.length-1;i>=0;i--){const p=V5.particles[i];p.life-=dt;
  p.p.x+=p.d.x*dt;p.p.y+=p.d.y*dt;p.p.z+=p.d.z*dt;p.d.y-=6*dt;
  if(p.life<=0)V5.particles.splice(i,1);
 }
}
// Perspective-projected, three-dimensional solid buildings. No external graphics runtime.
function v5Camera(p){
 const eye=v5Eyes(),dx=p[0]-eye.x,dy=p[1]-eye.y,dz=p[2]-eye.z;
 const ca=Math.cos(player.a),sa=Math.sin(player.a),cp=Math.cos(player.pitch||0),sp=Math.sin(player.pitch||0);
 const f=dx*ca+dz*sa;
 return {x:-dx*sa+dz*ca,y:dy*cp+f*sp,z:f*cp-dy*sp};
}
function v5ProjectCam(p){const focal=viewW/(2*Math.tan(FOV/2));return {x:viewW/2+p.x*focal/p.z,y:viewH/2-p.y*focal/p.z,z:p.z};}
function v5Project(p){const c=v5Camera([p.x,p.y,p.z]);return c.z>.1?v5ProjectCam(c):null;}
function v5ClipNear(vertices){
 const out=[];for(let i=0;i<vertices.length;i++){
  const a=vertices[i],b=vertices[(i+1)%vertices.length],ok=a.z>.09,other=b.z>.09;
  if(ok)out.push(a);
  if(ok!==other){const q=(.09-a.z)/(b.z-a.z);out.push({x:lerp(a.x,b.x,q),y:lerp(a.y,b.y,q),z:.09});}
 }return out;
}
function v5DrawPolygon(points,fill,alpha=1){
 const clipped=v5ClipNear(points.map(v5Camera));if(clipped.length<3)return;
 const ss=clipped.map(v5ProjectCam);if(ss.every(p=>p.x<-viewW)||ss.every(p=>p.x>viewW*2)||ss.every(p=>p.y<-viewH)||ss.every(p=>p.y>viewH*2))return;
 ctx.globalAlpha=alpha;ctx.beginPath();ctx.moveTo(ss[0].x,ss[0].y);
 for(let k=1;k<ss.length;k++)ctx.lineTo(ss[k].x,ss[k].y);
 ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.globalAlpha=1;
}
function v5IsVisibleFace(F,eye){
 if(F.kind==='floor'||F.kind==='decal'||F.kind==='ladder')return true;
 if(F.kind==='roof')return eye.y>F.verts[0][1];
 if(F.facing==='north')return eye.z<F.z+.001;
 if(F.facing==='south')return eye.z>F.z+1-.001;
 if(F.facing==='west')return eye.x<F.x+.001;
 if(F.facing==='east')return eye.x>F.x+1-.001;
 return true;
}
function v5DrawWallDetails(F){
 if(F.kind!=='wall')return;
 const h=F.h-F.low;if(h<1.8)return;
 const a=F.verts[0],b=F.verts[3],c=F.verts[2],d=F.verts[1]; // wall corners bottom->top mirrored by build order
 const leftBottom=[F.verts[0][0],F.low,F.verts[0][2]];
 const rightBottom=[F.verts[3][0],F.low,F.verts[3][2]];
 const leftTop=[F.verts[1][0],F.h,F.verts[1][2]];
 const rightTop=[F.verts[2][0],F.h,F.verts[2][2]];
 const bilerp=(u,v)=>[
  lerp(lerp(leftBottom[0],rightBottom[0],u),lerp(leftTop[0],rightTop[0],u),v),
  lerp(F.low,F.h,v),
  lerp(lerp(leftBottom[2],rightBottom[2],u),lerp(leftTop[2],rightTop[2],u),v)
 ];
 let floors=Math.floor(h/1.6);floors=Math.max(1,Math.min(3,floors));
 for(let row=0;row<floors;row++){
  const y0=.12+row*.78/floors,y1=y0+.44/floors;
  for(let col=0;col<2;col++){
    const x0=.13+col*.40,x1=x0+.26;
    const corners=[bilerp(x0,y0),bilerp(x1,y0),bilerp(x1,y1),bilerp(x0,y1)];
    v5DrawPolygon(corners,mapId==='cyber'?'#557ca4':mapId==='arctic'?'#729da4':'#425b69',.74);
    const p1=v5Project({x:lerp(corners[0][0],corners[1][0],.5),y:lerp(corners[0][1],corners[3][1],.5),z:lerp(corners[0][2],corners[1][2],.5)});
    if(p1&&p1.z<13){ctx.fillStyle='rgba(202,244,249,.8)';ctx.fillRect(p1.x-1,p1.y-4,2,8)}
  }
 }
}
function v5Billboard(canvasArt,pos,height,fade=1){
 const base=v5Project({x:pos.x,y:pos.y||0,z:pos.z});const top=v5Project({x:pos.x,y:(pos.y||0)+height,z:pos.z});
 if(!base||!top)return;
 const hh=Math.abs(base.y-top.y),ww=hh*canvasArt.width/canvasArt.height;
 if(ww>4000||hh>4000||base.x+ww<0||base.x-ww>viewW)return;
 ctx.globalAlpha=fade;ctx.drawImage(canvasArt,base.x-ww/2,top.y,ww,hh);ctx.globalAlpha=1;
}
function v5Background(){
 const m=MAPS[mapId];const grad=ctx.createLinearGradient(0,0,0,viewH);
 grad.addColorStop(0,m.sky);grad.addColorStop(.61,m.sky2);grad.addColorStop(1,m.floor);
 ctx.fillStyle=grad;ctx.fillRect(0,0,viewW,viewH);
 const sx=viewW*.74-Math.sin(player.a)*viewW*.13,sy=viewH*(.22+player.pitch*.6);
 const r=viewH*.067;ctx.globalAlpha=.64;const g=ctx.createRadialGradient(sx,sy,2,sx,sy,r*2.5);
 g.addColorStop(0,'#fff8df');g.addColorStop(.25,'#ffffd090');g.addColorStop(1,'#ffffff00');ctx.fillStyle=g;ctx.fillRect(sx-r*2.5,sy-r*2.5,5*r,5*r);ctx.globalAlpha=1;
}
const v4drawMinimap=drawMinimap;
drawMinimap=function(){
 if(state!=='DUEL')return v4drawMinimap();
 // Keeping the old minimap's original streets, with the friend as a violet marker.
 const old=state;state='PLAYING';v4drawMinimap();state=old;
 if(!V5.remote)return;
 mctx.save();mctx.translate(74,74);mctx.rotate(-player.a+Math.PI/2);
 mctx.fillStyle='#ff70fa';mctx.shadowColor='#ff70fa';mctx.shadowBlur=8;
 mctx.beginPath();mctx.arc((V5.remote.x-player.x)*4.1,(V5.remote.z-player.z)*4.1,3.8,0,7);mctx.fill();mctx.restore();
}
render=function(){
 v5Background();const eye=v5Eyes(),ca=Math.cos(player.a),sa=Math.sin(player.a),visible=[];
 for(const F of V5.faces){
  const center=F.verts.reduce((r,v)=>[r[0]+v[0],r[1]+v[1],r[2]+v[2]],[0,0,0]).map(v=>v/F.verts.length);
  const dx=center[0]-eye.x,dz=center[2]-eye.z;
  const far=Math.hypot(dx,dz);if(far>35.5)continue;
  if(!v5IsVisibleFace(F,eye))continue;
  const depth=dx*ca+dz*sa;
  if(depth<-4.5)continue;
  visible.push({type:'face',item:F,sort:Math.hypot(dx,center[1]-eye.y,dz)});
 }
 for(const p of props){const dist=Math.hypot(p.x-player.x,p.z-player.z);if(dist<36)visible.push({type:'prop',item:p,sort:dist});}
 for(const s of stations){const dist=Math.hypot(s.x-player.x,s.z-player.z);if(dist<36)visible.push({type:'station',item:s,sort:dist});}
 if(state==='PLAYING'||state==='PAUSED'){
  for(const e of enemies){const dist=Math.hypot(e.x-player.x,e.z-player.z);if(dist<36)visible.push({type:'enemy',item:e,sort:dist});}
  for(const p of pickups)visible.push({type:'pickup',item:p,sort:Math.hypot(p.x-player.x,p.z-player.z)});
 }
 if(state==='DUEL'&&V5.remote)visible.push({type:'friend',item:V5.remote,sort:Math.hypot(V5.remote.x-player.x,V5.remote.z-player.z)});
 visible.sort((a,b)=>b.sort-a.sort);
 for(const o of visible){
  if(o.type==='face'){
   v5DrawPolygon(o.item.verts,o.item.color,o.item.alpha??1);
   if(o.item.kind==='wall'&&o.sort<21)v5DrawWallDetails(o.item);
   if(o.item.kind==='roof'&&o.sort<15){const F=o.item;const p=v5Project({x:F.verts[0][0]+.2,y:F.verts[0][1]+.02,z:F.verts[0][2]+.2});if(p&&p.z>0){ctx.strokeStyle='#ffffff42';ctx.lineWidth=1;}}
  }else if(o.type==='prop'){
   const p=o.item;v5Billboard(scenerySprite(p.type,MAPS[mapId].accent),{x:p.x,y:0,z:p.z},2.0*p.size);
  }else if(o.type==='station'){
   const p=o.item;v5Billboard(scenerySprite('station',MAPS[mapId].accent,p.active),{x:p.x,y:0,z:p.z},2.0);
  }else if(o.type==='pickup'){
   const p=o.item;v5Billboard(pickupSprite(p.type),{x:p.x,y:.25+Math.sin(now*4)*.10,z:p.z},.72);
  }else if(o.type==='enemy'){
   const e=o.item,art=enemySprite(e.type,e.hitTimer>0?'#ffffff':e.type==='boss'?'#ff638c':MAPS[mapId].enemy,Math.floor(e.walkPhase/TWOPI*10)%10,e.attackAnim>0,e.moving>.15);
   v5Billboard(art,{x:e.x,y:0,z:e.z},e.type==='boss'?3.1:1.9);
  }else if(o.type==='friend'){
    const e=o.item;v5Billboard(enemySprite('runner','#e196ff',Math.floor((now*3)%10),false,e.moving),{x:e.x,y:e.y,z:e.z},1.9);
    const label=v5Project({x:e.x,y:e.y+2.18,z:e.z});if(label){ctx.font='bold 14px system-ui';ctx.textAlign='center';ctx.fillStyle='#ffe0ff';ctx.fillText('FRIEND  '+Math.ceil(e.hp||0)+' HP',label.x,label.y)}
  }
 }
 // Visually follow glowing fantasy projectiles to their world impact points.
 ctx.save();ctx.globalCompositeOperation='screen';
 for(const pr of V5.projectiles){const a=v5Project(pr.last),b=v5Project(pr.p);if(!b)continue;
   ctx.shadowColor=pr.color;ctx.shadowBlur=18;ctx.strokeStyle=pr.color;ctx.lineWidth=Math.max(2,9/b.z);
   ctx.beginPath();if(a)ctx.moveTo(a.x,a.y);else ctx.moveTo(b.x,b.y);ctx.lineTo(b.x,b.y);ctx.stroke();
   ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(b.x,b.y,v5min(2+18/b.z,2,7),0,7);ctx.fill();
 }
 for(const p of V5.particles){const pt=v5Project(p.p);if(!pt)continue;ctx.shadowColor=p.color;ctx.shadowBlur=8;ctx.fillStyle=p.color;ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillRect(pt.x,pt.y,v5min(10/pt.z,1,4),v5min(10/pt.z,1,4));}
 ctx.restore();
 if(state==='PLAYING'||state==='PAUSED'||state==='DUEL')drawWeapon();
 if(state==='MENU'||state==='DUEL_MENU'){ctx.fillStyle='rgba(1,5,14,.66)';ctx.fillRect(0,0,viewW,viewH);}
};
function v5Send(packet){const ch=V5.duel?.channel;if(ch?.readyState==='open')try{ch.send(JSON.stringify(packet))}catch(e){}}
function v5Status(str){const el=$('duel-status');if(el)el.textContent=str;}
function v5Encode(desc){return btoa(JSON.stringify({type:desc.type,sdp:desc.sdp}));}
function v5Decode(text){const value=JSON.parse(atob(text.trim()));if(!value||!['offer','answer'].includes(value.type)||typeof value.sdp!=='string'||value.sdp.length>16000)throw Error('Invalid connection code');return value;}
async function v5WaitIce(pc){
 if(pc.iceGatheringState==='complete')return;
 await new Promise(resolve=>{let ended=false;
   const finish=()=>{if(ended)return;ended=true;pc.removeEventListener('icegatheringstatechange',check);clearTimeout(timeout);resolve()};
   const check=()=>{if(pc.iceGatheringState==='complete')finish()};
   const timeout=setTimeout(finish,11000);pc.addEventListener('icegatheringstatechange',check);
 });
}
function v5CloseDuel(){
 $('duel-rematch')?.classList.add('hidden');
 if(V5.duel){try{V5.duel.channel?.close()}catch(e){}try{V5.duel.pc?.close()}catch(e){}}
 V5.duel=null;V5.remote=null;V5.projectiles.length=0;
}
function v5MakePeer(host){
 v5CloseDuel();const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
 V5.duel={pc,channel:null,host,open:false,nextSend:0,opponentReady:false};
 pc.addEventListener('connectionstatechange',()=>{
   if(V5.duel?.pc!==pc)return;
   if(pc.connectionState==='failed'){v5Status('Connection failed. Some networks need a TURN relay; try a different network.');}
   if(pc.connectionState==='disconnected')v5Status('Friend disconnected. Waiting for reconnection…');
   if(pc.connectionState==='connected')v5Status('Peer connection established!');
 });
 if(host){const ch=pc.createDataChannel('neon-friend-arena',{ordered:true});v5AttachChannel(ch)}
 else pc.addEventListener('datachannel',e=>v5AttachChannel(e.channel));
 return pc;
}
function v5AttachChannel(channel){
 if(!V5.duel)return;V5.duel.channel=channel;
 channel.onopen=()=>{
   if(!V5.duel)return;V5.duel.open=true;
   if(V5.duel.host){v5StartDuel(true);v5Send({t:'hello',map:mapId})}
   else v5Status('Connected — loading the host map…');
 };
 channel.onmessage=e=>{let o;try{o=JSON.parse(e.data)}catch(err){return}v5Receive(o)};
 channel.onclose=()=>{
   if(state==='DUEL'){
    shootDown=false;toast('FRIEND DISCONNECTED',2.3);
    setTimeout(()=>{if(V5.duel?.channel===channel)showMenu()},1200);
   }
 };
}
function v5Receive(msg){
 if(!msg||typeof msg!=='object'||!V5.duel)return;
 if(msg.t==='hello'){
   if(!V5.duel.host&&MAPS[msg.map]){mapId=msg.map;v5StartDuel(false)}
   return;
 }
 if(state!=='DUEL')return;
 if(msg.t==='state'){
   const safe=n=>Number.isFinite(n)?n:0;
   const r=V5.remote||{x:20.5,y:0,z:24.5,a:0,pitch:0,hp:100,moving:false};
   const nx=v5min(safe(msg.x),.3,40.7),nz=v5min(safe(msg.z),.3,40.7),ny=v5min(safe(msg.y),0,15);
   r.moving=Math.hypot(nx-r.x,nz-r.z)>.07;r.x=nx;r.z=nz;r.y=ny;
   r.a=safe(msg.a);r.pitch=safe(msg.pitch);r.hp=v5min(safe(msg.hp),0,100);
   V5.remote=r;
 }else if(msg.t==='fire'){
   const orig=msg.p,d=msg.d,w=WEAPONS[msg.w];if(!orig||!d||!w)return;
   if(![orig.x,orig.y,orig.z,d.x,d.y,d.z].every(Number.isFinite))return;
   if(Math.hypot(d.x,d.y,d.z)<.8||Math.hypot(d.x,d.y,d.z)>1.2)return;
   if(Math.abs(orig.x)>43||Math.abs(orig.z)>43||orig.y<-1||orig.y>17)return;
   V5.projectiles.push({p:{...orig},last:{...orig},d:{...d},life:1.45,speed:w.speed||38,damage:w.damage,color:w.color,owner:'remote',kind:w.id});
 }else if(msg.t==='rematch'){
   v5StartDuel(!!V5.duel?.host);return;
 }else if(msg.t==='down'){
   V5.localScore++;banner('ROUND WON',`YOU ${V5.localScore}  —  FRIEND ${V5.remoteScore}`,2);snd('wave');
   if(V5.localScore>=5){V5.duelFinished=true;banner('DUEL WON!', 'CLICK REMATCH OR LEAVE ARENA',6);$('duel-rematch').classList.remove('hidden');}
   v5DuelHud();
 }
}
function v5StartDuel(host){
 hideScreens();state='DUEL';buildArena(mapId);V5.projectiles.length=0;enemies=[];pickups=[];
 v5EnsureWeapons();weapons.forEach(w=>w.unlocked=true);V5.duelFinished=false;$('duel-rematch')?.classList.add('hidden'); // Even equipment for private friendly matches.
 player={x:20.5,z:host?16.2:24.8,y:0,vY:0,vx:0,vz:0,onGround:true,
   a:host?Math.PI/2:-Math.PI/2,pitch:0,hp:100,maxHp:100,shield:0,speed:3.8,
   pulses:0,invuln:0,jumpY:0,jumpV:0,dashTime:0,dashCooldown:0};
 upg={damage:0,rate:0,speed:0,maxhp:0};activeWeapon=0;
 fireCooldown=0;reloadTimer=0;shotFlash=0;V5.localScore=0;V5.remoteScore=0;V5.playerDeadUntil=0;
 V5.remote={x:20.5,y:0,z:host?24.8:16.2,a:0,hp:100,moving:false};
 keys={};shootDown=false;gameVisible(true);$('mouse-hint').classList.remove('hidden');
 $('duel-leave').classList.remove('hidden');banner('FRIEND 1V1','FIRST TO FIVE · NO AIM ASSIST',3);v5DuelHud();
}
function v5DuelDown(){
 if(now<V5.playerDeadUntil)return;
 V5.remoteScore++;if(V5.remoteScore>=5){V5.duelFinished=true;$('duel-rematch').classList.remove('hidden');}V5.playerDeadUntil=now+2.4;
 player.hp=0;player.shield=0;shootDown=false;
 v5Send({t:'down'});banner('TAGGED!','RESPAWNING IN TWO SECONDS',2);
 v5DuelHud();
}
function v5DuelHud(){
 if(state!=='DUEL')return;
 $('hud-wave').textContent=`1V1 FRIEND ARENA  ·  YOU ${V5.localScore} — ${V5.remoteScore} FRIEND`;
 $('hud-coins').textContent=V5.localScore;
 $('hud-kills').textContent=V5.remoteScore;
 $('health-text').textContent=`${Math.ceil(player.hp)} / 100`;
 $('armor-text').textContent='DUEL MODE';
 $('health-fill').style.width=Math.max(0,player.hp)+'%';$('armor-fill').style.width='0%';
 $('weapon-name').textContent=WEAPONS[activeWeapon].name;
 $('ammo-mag').textContent=weapons[activeWeapon].mag;
 $('ammo-reserve').textContent=weapons[activeWeapon].reserve;
 $('misc-status').textContent='FRIEND DUEL · ALL BLASTERS AVAILABLE';
 $('view-weapon-status').textContent='◈ '+WEAPONS[activeWeapon].name+'  //  1V1';
 $('relay-info').textContent='FRIEND ARENA · FIRST TO 5 ROUNDS';
 $('zone-info').textContent='SECTOR: '+zoneAt(player.x,player.z);
 $('interact-prompt').classList.toggle('hidden',!v5Ladder());
 if(v5Ladder())$('interact-prompt').innerHTML='PRESS <b>F</b> TO CLIMB LADDER';
}
const v4refreshHUD=refreshHUD;
refreshHUD=function(){if(state==='DUEL')v5DuelHud();else v4refreshHUD()};
const v4hideScreens=hideScreens;
hideScreens=function(){v4hideScreens();$('duel-screen')?.classList.add('hidden');};
const v4showMenu=showMenu;
showMenu=function(){v5CloseDuel();$('duel-leave')?.classList.add('hidden');v4showMenu();};
function v5DuelLoop(dt){
 if(player.hp<=0&&now>=V5.playerDeadUntil&&!V5.duelFinished){
   const host=!!V5.duel?.host;
   player.x=20.5;player.z=host?16.2:24.8;player.y=0;player.hp=100;player.vx=0;player.vz=0;player.vY=0;
   player.onGround=true;player.invuln=1.2;V5.projectiles=[];V5.climb=null;
   v5DuelHud();
 }
 if(player.hp>0)v5MovePlayer(dt);
 else v5Projectiles(dt);
 if(V5.duel&&now>V5.duel.nextSend){
   V5.duel.nextSend=now+.05;
   v5Send({t:'state',x:player.x,y:player.y,z:player.z,a:player.a,pitch:player.pitch,hp:player.hp});
 }
 if(toastUntil<now)$('toast').classList.add('hidden');
 if(bannerUntil<now)$('banner').classList.add('hidden');
 shotFlash=Math.max(0,shotFlash-dt);weaponKick=Math.max(0,weaponKick-dt*5);
 damageFlash=Math.max(0,damageFlash-dt*1.7);shake=Math.max(0,shake-dt*2);
 $('hit-flash').style.opacity=damageFlash.toFixed(2);
 if(miniClock<=0){drawMinimap();miniClock=.1}else miniClock-=dt;
}
const v4loop=loop;
loop=function(t){
 if(state==='DUEL'){
   requestAnimationFrame(loop);if(!last)last=t;const dt=Math.min(.04,(t-last)/1000);last=t;now=t/1000;
   v5DuelLoop(dt);render();return;
 }
 v4loop(t);
};
// Connection exchange uses WebRTC's native data channel; no GitHub Pages backend is required.
function v5OnlineInterface(){
 const style=document.createElement('style');style.textContent=`
 #duel-screen{z-index:45;overflow:auto;background:#06101fe8}
 .duel-panel{width:min(780px,96%);padding:25px;margin:auto;background:#071727;border:1px solid #5ce2f7aa;border-radius:24px;box-shadow:0 14px 70px #020710}
 .duel-panel h2{font-size:clamp(27px,5vw,52px);margin:5px 0;color:#a7fff4;letter-spacing:-2px}
 .duel-panel p,.duel-panel li{font-size:13px;color:#b6c9d7;line-height:1.6}
 .duel-panel textarea{width:100%;height:112px;background:#0d263e;color:#dffcff;font:11px monospace;border:1px solid #628da4;border-radius:10px;padding:11px;resize:vertical;box-sizing:border-box}
 .duel-panel label{display:block;font-size:12px;color:#d8f7fc;font-weight:700;margin:12px 0 5px}
 .duel-buttons{display:flex;flex-wrap:wrap;gap:9px;margin:12px 0}.duel-buttons button{flex:1;min-width:140px;padding:12px;font-size:12px;border-radius:9px;cursor:pointer;border:1px solid #8ecfdb;color:#d4ffff;background:#17405b;font-weight:800}
 .duel-buttons button:hover{background:#276d80}.duel-buttons .accent{background:#26bdb5;color:#002835}
 #duel-status{color:#fcdf96;margin:8px 0;min-height:25px;font-size:12px}
 #duel-leave{position:fixed;top:131px;right:14px;z-index:14;border:1px solid #ffa3aa;background:#2a0d20e5;color:#ffb8bd;border-radius:10px;padding:8px 12px;font-size:12px;font-weight:bold;cursor:pointer}
 #duel-screen.hidden,#duel-leave.hidden,#duel-rematch.hidden{display:none!important}
 @media(max-height:700px){.duel-panel{padding:13px}.duel-panel textarea{height:75px}}
 `;document.head.appendChild(style);
 const duel=document.createElement('div');duel.id='duel-screen';duel.className='screen hidden';
 duel.innerHTML=`<div class="duel-panel"><div class="cap">◈ DIRECT FRIEND MATCH · EXPERIMENTAL P2P</div>
 <h2>FRIEND 1V1 ARENA</h2><p>Play a private first-to-five rooftop arena with a friend. <strong>No account or server required.</strong> Share the connection text with someone you know using your normal messaging app. A GitHub Pages address (HTTPS) is recommended.</p>
 <div class="duel-buttons"><button id="duel-host" class="accent">1 · CREATE MATCH</button><button id="duel-join">1 · JOIN FRIEND</button><button id="duel-back">BACK TO MAPS</button></div>
 <label id="duel-out-label">YOUR CONNECTION CODE (SEND TO FRIEND)</label>
 <textarea id="duel-out" readonly placeholder="Create a match or join a friend to generate a code."></textarea>
 <div class="duel-buttons"><button id="duel-copy">COPY MY CODE</button></div>
 <label>PASTE YOUR FRIEND'S CODE HERE</label><textarea id="duel-in" placeholder="Paste their offer if joining, or their answer if hosting…"></textarea>
 <div class="duel-buttons"><button id="duel-answer">2 · JOIN USING OFFER</button><button id="duel-complete">3 · HOST: ACCEPT ANSWER</button></div>
 <div id="duel-status">To play: Host clicks Create Match and sends the first code. Friend pastes it and clicks Join Using Offer, then sends their answer back. Host pastes that and clicks Accept Answer.</div>
 <p><strong>Connection limitations:</strong> WebRTC sometimes needs a TURN relay, so certain schools, routers, or mobile networks may prevent pairing. Connection codes are long and temporary. This does not provide automatic room-code matchmaking, hosting, chat, or anti-cheat. Share codes only with trusted friends.</p>
 </div>`;document.body.appendChild(duel);
 const leave=document.createElement('button');leave.id='duel-leave';leave.className='hidden';leave.textContent='LEAVE FRIEND ARENA';leave.addEventListener('click',showMenu);document.body.appendChild(leave);
 const rematch=document.createElement('button');rematch.id='duel-rematch';rematch.className='hidden';rematch.textContent='REMATCH';rematch.style.cssText='position:fixed;top:172px;right:14px;z-index:14;border:1px solid #8cf4b3;background:#133b36;color:#aaffd9;border-radius:10px;padding:8px 13px;font-size:12px;font-weight:bold;cursor:pointer';rematch.addEventListener('click',()=>{v5Send({t:'rematch'});v5StartDuel(!!V5.duel?.host)});document.body.appendChild(rematch);
 const menuBottom=document.querySelector('.menu-bottom');const button=document.createElement('button');button.className='secondary';button.textContent='1V1 WITH A FRIEND';button.id='duel-open';menuBottom.insertBefore(button,$('start-btn'));
 $('duel-open').addEventListener('click',()=>{hideScreens();gameVisible(false);state='DUEL_MENU';duel.classList.remove('hidden');pointerUnlock();v5Status('Choose Create Match or Join Friend.');});
 $('duel-back').addEventListener('click',showMenu);
 $('duel-copy').addEventListener('click',async()=>{const code=$('duel-out').value;if(!code)return;
   try{await navigator.clipboard.writeText(code);v5Status('Connection code copied. Share it privately with your friend.')}catch(e){$('duel-out').focus();$('duel-out').select();document.execCommand('copy');v5Status('Code selected. Copy it with Ctrl+C if needed.')}});
 $('duel-host').addEventListener('click',async()=>{
   if(!window.RTCPeerConnection){v5Status('This browser does not support WebRTC.');return;}
   v5Status('Creating match — gathering the connection information…');$('duel-out').value='';
   try{const pc=v5MakePeer(true);const offer=await pc.createOffer();await pc.setLocalDescription(offer);await v5WaitIce(pc);
     $('duel-out').value=v5Encode(pc.localDescription);$('duel-out-label').textContent='SEND THIS OFFER CODE TO YOUR FRIEND';
     v5Status('Send your code. Your friend pastes it, clicks Join Using Offer, and replies with an answer code.');
   }catch(e){v5Status('Could not create a match: '+e.message);}
 });
 $('duel-answer').addEventListener('click',async()=>{
   try{const offer=v5Decode($('duel-in').value);if(offer.type!=='offer')throw Error('Expected an offer from the host.');
     v5Status('Joining — generating answer…');const pc=v5MakePeer(false);await pc.setRemoteDescription(offer);
     const answer=await pc.createAnswer();await pc.setLocalDescription(answer);await v5WaitIce(pc);
     $('duel-out').value=v5Encode(pc.localDescription);$('duel-out-label').textContent='SEND THIS ANSWER CODE BACK TO THE HOST';
     v5Status('Send this answer to the host. They must paste it and click Host: Accept Answer.');
   }catch(e){v5Status('Could not join: '+e.message);}
 });
 $('duel-complete').addEventListener('click',async()=>{
   try{if(!V5.duel?.host)throw Error('First create a match as host.');const answer=v5Decode($('duel-in').value);
     if(answer.type!=='answer')throw Error('Expected the answer your friend sent.');
     await V5.duel.pc.setRemoteDescription(answer);v5Status('Answer accepted — connecting to your friend…');
   }catch(e){v5Status('Could not finish connection: '+e.message);}
 });
}
function v5InitPlayer(){
 if(state!=='PLAYING')return;
 player.y=0;player.vY=0;player.vx=0;player.vz=0;player.onGround=true;player.slideTime=0;
 v5EnsureWeapons();V5.projectiles=[];V5.particles=[];V5.climb=null;
 refreshHUD();
}
function v5Setup(){
 document.title='NEON SIEGE 5.0 · 3D Rooftop & Friend Arena';
 document.querySelector('.top-pill').textContent='3D ROOFTOPS  ·  TRUE PROJECTILES  ·  FRIEND 1V1';
 document.querySelector('.eyebrow').textContent='KINETIC EDITION // VERSION 5.0';
 document.querySelector('.intro').textContent='Free-roam five sketch-style worlds in 3D. Strafe, slide, jump and climb rooftop ladders; unlock eight unique energy blasters, fight cartoon robots, or challenge a friend in a private 1v1 arena.';
 document.querySelector('.armory-label').innerHTML='EIGHT DISTINCT BLASTERS<small style="display:block;color:#6e96ad;margin-top:4px;font-weight:600;letter-spacing:0">UNLOCK MORE IN THE WAVE SHOP · SAVED ON THIS BROWSER</small>';
 const items=document.querySelector('.armory-weapons');items.innerHTML='<span>✧ VX-9<small>STARTER</small></span><span>✹ PHANTOM<small>RAPID ENERGY</small></span><span>❖ NOVA<small>WIDE BURST</small></span><span>⌁ RAIL<small>PRECISION</small></span><span>◎ ION<small>SPARK</small></span><span>◈ COMET<small>HEAVY</small></span><span>✦ ECHO<small>TRIPLE BURST</small></span><span>⬡ ZENITH<small>PRISM</small></span>';
 document.querySelector('.key-help').innerHTML='<span class="keycap">W A S D</span> Free movement · <span class="keycap">MOUSE</span> Look · <span class="keycap">CLICK</span> Energy shot · <span class="keycap">SHIFT</span> Run<br><span class="keycap">SPACE</span> Jump · <span class="keycap">CTRL</span> Slide · <span class="keycap">C</span> Dash · <span class="keycap">F</span> Climb / interact · <span class="keycap">1-8</span> Blasters · <span class="keycap">R</span> Reload';
 $('hud').querySelector('.hud-tip').textContent='WASD FREE MOVE • MOUSE LOOK • SPACE JUMP • CTRL SLIDE • C DASH • F CLIMB LADDERS • R RELOAD • 1–8 SWITCH • NO AIM ASSIST';
 v5OnlineInterface();
 build3D();
 // The original start/restart handlers fire first; then initialize new momentum & equipment.
 for(const id of ['start-btn','restart-btn','pause-restart-btn'])$(id).addEventListener('click',v5InitPlayer);
 $('quality-select').value='medium';settings.quality='medium';resize();
 // Original listeners already handle movement keys and mouse look in the wave mode.
 document.addEventListener('keydown',e=>{
   if(state!=='PLAYING'&&state!=='DUEL')return;
   if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ControlLeft','ControlRight'].includes(e.code))e.preventDefault();
   if(e.repeat)return;
   if(state==='DUEL'){
      if(e.code==='Space')v5Jump();if(e.code==='KeyC')dash();
      if(e.code==='KeyF')v5Interact();if(e.code==='KeyR')reload();
      if(e.code.startsWith('Digit')){const idx=Number(e.code.slice(5))-1;if(idx>=0&&idx<WEAPONS.length)switchWeapon(idx)}
      if(e.code==='Tab'){e.preventDefault();cycleWeapon(1)}
      if(e.code==='Escape'){pointerUnlock();toast('CLICK TO RECAPTURE MOUSE · LEAVE BUTTON TOP RIGHT',2)}
   }
   if((e.code==='ControlLeft'||e.code==='ControlRight')&&player.onGround){player.slideTime=.56;snd('pulse')}
 },{passive:false});
 canvas.addEventListener('mousedown',e=>{
   if(state!=='DUEL')return;if(e.button===0){shootDown=true;shoot();}
   pointerLock();
 });
 document.addEventListener('mousemove',e=>{if(state==='DUEL'&&document.pointerLockElement===canvas)lookBy(e.movementX||0,e.movementY||0)});
 // The original mouse-up listener clears held-fire automatically.
 canvas.addEventListener('wheel',e=>{if(state==='DUEL'){e.preventDefault();cycleWeapon(e.deltaY>0?1:-1)}},{passive:false});
 document.addEventListener('pointerlockchange',()=>{if(state==='DUEL')updateMouseHint()});
 v5EnsureWeapons();
 updateMouseHint();
}
const v4pointerLock=pointerLock;
pointerLock=function(){
 if(state==='PLAYING')return v4pointerLock();
 if(state==='DUEL'&&matchMedia('(pointer:fine)').matches&&canvas.requestPointerLock){
   try{const p=canvas.requestPointerLock();if(p?.catch)p.catch(()=>{})}catch(e){}
 }
};
updateMouseHint=function(){const mouse=matchMedia('(pointer:fine)').matches;
 $('mouse-hint').classList.toggle('hidden',!mouse||!(state==='PLAYING'||state==='DUEL')||document.pointerLockElement===canvas);
};
// The original wave-mode input now calls v5Interact directly (patched in index.html).
// The duel-specific frame also uses the original display and saved graphic settings.
const v4damagePlayer=damagePlayer;
damagePlayer=function(amount){if((player.y||0)>2.25)return;v4damagePlayer(amount)};
v5Setup();
