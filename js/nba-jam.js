/* ── Shankton NBA JAM Easter Egg ─────────────────────────────────────────────
   Trigger : type  J A M  anywhere on the page
   Cheat   : type  STOCKTON  during the game to unlock the legends
   Controls: ARROWS / WASD = move + jump    SPACE / F = shoot    ESC = quit
────────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const W = 800, H = 500, FLOOR = 385;
  const GRAVITY = 0.52, JUMP_V = -12.5, MOVE_SPD = 4.5;

  const JAZZ  = { name:'JAZZ',        primary:'#4B2683', secondary:'#F9A01B' };
  const NETS  = { name:'NEW JERSEY',  primary:'#002A5E', secondary:'#D0103A' };

  const HOOP_L = { x:88,  y:218 }; // Nets score here (Jazz defend)
  const HOOP_R = { x:712, y:218 }; // Jazz score here  (Nets defend)

  // ── Rosters ─────────────────────────────────────────────────────────────────
  let jazzRoster = [ { name:'CLIFTON', num:'1'  }, { name:'SHANKS', num:'0'  } ];
  let netsRoster = [ { name:'VAN HORN',num:'44' }, { name:'KITTLES',num:'32' } ];
  const LEGENDS  = [ { name:'STOCKTON',num:'12' }, { name:'MALONE', num:'32' } ];

  // ── State ────────────────────────────────────────────────────────────────────
  let canvas, ctx, overlay, animId, clockInt;
  let state = 'title';
  let score = { jazz:0, nets:0 };
  let clock = 120;
  let keys  = {};
  let commentary = null;
  let particles = [], floats = [], players, ball;
  let cheatBuf = '';

  // ── Trigger ──────────────────────────────────────────────────────────────────
  let trigBuf = '';
  document.addEventListener('keydown', function(e) {
    if (!overlay) {
      trigBuf = (trigBuf + e.key).toUpperCase().slice(-10);
      if (trigBuf.endsWith('JAM')) { trigBuf = ''; launch(); }
    }
  });

  // Also: tap nav logo 5× within 2 s
  let logoTaps = 0, logoTO;
  document.addEventListener('DOMContentLoaded', function() {
    var el = document.querySelector('nav');
    if (el) el.addEventListener('click', function() {
      clearTimeout(logoTO);
      logoTO = setTimeout(function(){ logoTaps = 0; }, 2000);
      if (++logoTaps >= 5) { logoTaps = 0; launch(); }
    });
  });

  // ── Factory ──────────────────────────────────────────────────────────────────
  function makePlayer(name, num, team, x, facing) {
    return { name, num, team, x, y: FLOOR, vx:0, vy:0, w:26, h:50,
             onGround:true, hasBall:false, onFire:false, streak:0,
             facing, frame:0, shootCD:0, aiTimer:0 };
  }

  // ── Reset ────────────────────────────────────────────────────────────────────
  function resetGame() {
    score = { jazz:0, nets:0 }; clock = 120;
    particles = []; floats = []; commentary = null;
    players = [
      makePlayer(jazzRoster[0].name, jazzRoster[0].num, 'jazz', 160,  1),
      makePlayer(jazzRoster[1].name, jazzRoster[1].num, 'jazz', 270,  1),
      makePlayer(netsRoster[0].name, netsRoster[0].num, 'nets', 530, -1),
      makePlayer(netsRoster[1].name, netsRoster[1].num, 'nets', 640, -1),
    ];
    players[0].hasBall = true;
    ball = { x:180, y:FLOOR-22, vx:0, vy:0, r:11,
             inFlight:false, holder:players[0], shooter:null, trail:[] };
  }

  // ── Launch / Close ────────────────────────────────────────────────────────────
  function launch() {
    if (overlay) return;
    if (!document.getElementById('pstart')) {
      var l = document.createElement('link');
      l.id='pstart'; l.rel='stylesheet';
      l.href='https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap';
      document.head.appendChild(l);
    }
    overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#000;' +
                             'display:flex;align-items:center;justify-content:center;';
    canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    canvas.style.cssText = 'max-width:100vw;max-height:100vh;';
    ctx = canvas.getContext('2d');
    overlay.appendChild(canvas);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup',   function(e){ keys[e.code]=false; });
    resetGame(); state = 'title';
    animId = requestAnimationFrame(loop);
  }

  function closeGame() {
    if (!overlay) return;
    cancelAnimationFrame(animId); clearInterval(clockInt);
    document.removeEventListener('keydown', onKey);
    overlay.remove(); overlay = null;
    document.body.style.overflow = ''; keys = {};
  }

  function onKey(e) {
    keys[e.code] = true;
    if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
    if (e.code === 'Escape') { closeGame(); return; }

    // Cheat: STOCKTON → swap Jazz to Stockton + Malone
    cheatBuf = (cheatBuf + e.key).toUpperCase().slice(-10);
    if (cheatBuf.endsWith('STOCKTON')) {
      jazzRoster = [{ name:'STOCKTON', num:'12' }, { name:'MALONE', num:'32' }];
      cheatBuf = '';
      showCommentary('LEGENDS UNLOCKED!!'); resetGame();
    }

    if (state === 'title'    && (e.code==='Space'||e.code==='KeyF')) startGame();
    if (state === 'gameover' && (e.code==='Space'||e.code==='KeyR')) { resetGame(); startGame(); }
  }

  // ── Clock ─────────────────────────────────────────────────────────────────────
  function startGame() {
    state = 'playing'; clearInterval(clockInt);
    clockInt = setInterval(function() {
      if (state !== 'playing') return;
      if (--clock <= 0) {
        clock = 0; state = 'gameover'; clearInterval(clockInt);
        showCommentary(score.jazz > score.nets ? 'JAZZ WIN!' :
                       score.nets > score.jazz ? 'NETS WIN!'  : "IT'S A TIE!");
      }
    }, 1000);
  }

  // ── Commentary ────────────────────────────────────────────────────────────────
  const QUIPS = ['BOOMSHAKALAKA!', "HE'S ON FIRE!", 'FROM DOWNTOWN!',
    'IS IT THE SHOES?', 'UGLY… BUT GOOD!', 'NOTHING BUT NET!',
    'OH MY!!', "HE'S HEATING UP!", 'SWISH!', 'GETS THE AND-ONE!!'];
  function showCommentary(t, dur) { commentary = { text:t, life: dur||160, max: dur||160 }; }

  // ── Particles ─────────────────────────────────────────────────────────────────
  function burst(x, y, color) {
    for (var i=0; i<18; i++) {
      var a = (Math.PI*2*i/18)+Math.random()*0.4, sp = 2+Math.random()*5;
      particles.push({ x, y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp-2,
        r:3+Math.random()*4, life:1, decay:0.018, color });
    }
  }
  function firePart(x, y) {
    particles.push({ x, y, vx:(Math.random()-0.5)*2, vy:-Math.random()*3-1,
      r:3+Math.random()*5, life:1, decay:0.032,
      color: Math.random()>0.5 ? '#FF6B00' : '#FFD700' });
  }
  function floatPt(txt, x, y, color) { floats.push({ txt, x, y, vy:-1.6, life:80, color }); }

  // ── Physics ───────────────────────────────────────────────────────────────────
  function step(e) {
    e.vy += GRAVITY; e.x += e.vx; e.y += e.vy;
    if (e.y >= FLOOR) { e.y = FLOOR; e.vy = 0; e.onGround = true; }
    e.x = Math.max(10, Math.min(W-e.w-10, e.x));
    if (e.onGround) e.vx *= 0.74;
    e.shootCD = Math.max(0, e.shootCD-1);
    e.aiTimer  = Math.max(0, e.aiTimer-1);
    e.frame++;
  }

  // ── Active Jazz player (whoever has ball, or nearest to it) ───────────────────
  function activeJazz() {
    var h = players.find(function(p){ return p.team==='jazz' && p.hasBall; });
    if (h) return h;
    var j0=players[0], j1=players[1];
    return Math.abs(j0.x-ball.x) < Math.abs(j1.x-ball.x) ? j0 : j1;
  }

  // ── Controls (for whichever Jazz player is active) ────────────────────────────
  function updateHuman(p) {
    if (keys['ArrowLeft'] ||keys['KeyA']) { p.vx-=1.5; p.facing=-1; }
    if (keys['ArrowRight']||keys['KeyD']) { p.vx+=1.5; p.facing= 1; }
    if (Math.abs(p.vx)>MOVE_SPD) p.vx=Math.sign(p.vx)*MOVE_SPD;
    if ((keys['ArrowUp']||keys['KeyW']) && p.onGround) { p.vy=JUMP_V; p.onGround=false; }
    if ((keys['Space']||keys['KeyF']) && p.hasBall && p.shootCD<=0) shoot(p, HOOP_R);
    step(p);
  }

  // ── Jazz teammate AI ───────────────────────────────────────────────────────────
  function updateJazzAI(p) {
    if (p.hasBall) {
      var dx = 490 - p.x;
      p.vx += Math.sign(dx)*0.7; p.facing = Math.sign(dx)||1;
      if (p.shootCD<=0 && (Math.abs(dx)<110 || p.aiTimer<=0)) {
        if (p.aiTimer<=0) { shoot(p, HOOP_R); p.aiTimer=85; }
      }
    } else {
      var tx = 300, dx2 = tx-p.x;
      if (Math.abs(dx2)>20) { p.vx+=Math.sign(dx2)*0.5; p.facing=Math.sign(dx2); }
      if (!ball.inFlight && !players.some(function(q){return q.hasBall;}) && d2(p,ball)<52)
        { p.hasBall=true; ball.holder=p; }
    }
    if (Math.abs(p.vx)>MOVE_SPD*0.85) p.vx=Math.sign(p.vx)*MOVE_SPD*0.85;
    step(p);
  }

  // ── Nets CPU AI ────────────────────────────────────────────────────────────────
  function updateCPU(p, isLead) {
    if (p.hasBall) {
      var spotX = isLead ? 195 : 290, dx = spotX-p.x;
      p.vx += Math.sign(dx)*0.68; p.facing = Math.sign(dx)||-1;
      if (p.shootCD<=0 && (Math.abs(dx)<130 || p.aiTimer<=0)) {
        if (p.aiTimer<=0) { shoot(p, HOOP_L); p.aiTimer=92; }
      }
    } else {
      var tgt = ball.holder||ball, dx2 = tgt.x-p.x;
      if (Math.abs(dx2)>15) { p.vx+=Math.sign(dx2)*0.72; p.facing=Math.sign(dx2); }
      if (!ball.inFlight && !players.some(function(q){return q.hasBall;}) && d2(p,ball)<52)
        { p.hasBall=true; ball.holder=p; }
      // Steal
      var jb = players.find(function(q){ return q.team==='jazz' && q.hasBall; });
      if (jb && d2(p,jb)<46 && p.aiTimer<=0 && Math.random()<0.013) {
        jb.hasBall=false; p.hasBall=true; ball.holder=p; p.aiTimer=80;
        showCommentary(p.name+' STEALS IT!');
      }
    }
    if (Math.abs(p.vx)>MOVE_SPD*0.88) p.vx=Math.sign(p.vx)*MOVE_SPD*0.88;
    step(p);
    if (p.onFire && Math.random()>0.6) firePart(p.x+p.w/2, p.y-p.h*0.6);
  }

  // ── Shoot ──────────────────────────────────────────────────────────────────────
  function shoot(shooter, hoop) {
    shooter.hasBall=false; ball.holder=null; ball.inFlight=true;
    ball.shooter=shooter; ball.trail=[];
    var t=33;
    ball.vx=(hoop.x-ball.x)/t;
    ball.vy=(hoop.y-ball.y)/t - 0.5*GRAVITY*t;
    var miss = shooter.onFire ? 0.08 : 0.28;
    if (Math.random()<miss) { ball.vx+=(Math.random()-0.5)*1.4; ball.vy-=Math.random()*0.7; }
    shooter.vy=JUMP_V*0.62; shooter.onGround=false; shooter.shootCD=58;
  }

  // ── Ball update ────────────────────────────────────────────────────────────────
  function updateBall() {
    if (!ball.inFlight) {
      if (ball.holder) {
        ball.x = ball.holder.x+(ball.holder.facing>0 ? ball.holder.w+6 : -ball.r*2-6);
        ball.y = ball.holder.y-22;
      }
      return;
    }
    ball.vy+=GRAVITY; ball.x+=ball.vx; ball.y+=ball.vy;
    if (ball.shooter && ball.shooter.onFire) ball.trail.push({x:ball.x,y:ball.y,life:1});
    ball.trail = ball.trail.filter(function(t){ return (t.life-=0.07)>0; });

    // Score detection
    for (var i=0; i<2; i++) {
      var h = i===0 ? HOOP_L : HOOP_R;
      if (Math.hypot(ball.x-h.x, ball.y-h.y)<22 && ball.vy>0) { onScore(h); return; }
    }
    // Out of bounds
    if (ball.y>FLOOR+35||ball.x<-30||ball.x>W+30) {
      ball.inFlight=false; ball.trail=[];
      ball.x=W/2; ball.y=FLOOR-30; ball.vx=0; ball.vy=0; ball.holder=null;
      showCommentary('OUT OF BOUNDS!');
    }
  }

  function onScore(hoop) {
    var isJazz = (hoop===HOOP_R);
    var sc = ball.shooter;
    ball.inFlight=false; ball.trail=[];
    ball.vx=0; ball.vy=0;

    if (isJazz) {
      score.jazz+=2;
      if (sc) { sc.streak++; if(sc.streak>=2){ sc.onFire=true; } }
      burst(hoop.x, hoop.y, JAZZ.secondary);
      floatPt('+2', hoop.x, hoop.y-30, JAZZ.secondary);
      var jlines = sc&&sc.onFire
        ? ["HE'S ON FIRE!", 'BOOMSHAKALAKA!',
           sc.name==='MALONE'  ? 'THE MAILMAN DELIVERS!'   :
           sc.name==='CLIFTON' ? 'CLIFTON IS ON FIRE!!'    :
           sc.name==='SHANKS'  ? 'SHANKTON SCORES!!'       :
           sc.name==='STOCKTON'? 'STOCKTON TO… HIMSELF!!'  : "HE'S UNSTOPPABLE!"]
        : ['GOOD!', 'FROM DOWNTOWN!', 'NOTHING BUT NET!', 'IS IT THE SHOES?',
           sc&&sc.name==='CLIFTON' ? 'CLIFTON FROM THE CORNER!' :
           sc&&sc.name==='SHANKS'  ? 'SHANKS WITH THE BUCKET!'  : 'JAZZ SCORE!'];
      showCommentary(jlines[Math.floor(Math.random()*jlines.length)]);
      setTimeout(function(){ resetBallTo('nets'); }, 550);
    } else {
      score.nets+=2;
      if (sc) { sc.streak++; if(sc.streak>=2){ sc.onFire=true; } }
      burst(hoop.x, hoop.y, NETS.secondary);
      floatPt('+2', hoop.x, hoop.y-30, NETS.secondary);
      var nlines = sc&&sc.onFire
        ? ["CPU'S ON FIRE!", 'BOOMSHAKALAKA!', 'VAN HORN FROM THE CORNER!']
        : ['NETS SCORE!', 'VAN HORN!', 'KITTLES!', 'SWISH!'];
      showCommentary(nlines[Math.floor(Math.random()*nlines.length)]);
      players.filter(function(p){return p.team==='jazz';}).forEach(function(p){ p.streak=0; p.onFire=false; });
      setTimeout(function(){ resetBallTo('jazz'); }, 550);
    }
  }

  function resetBallTo(team) {
    var p = players.find(function(q){ return q.team===team; });
    if (!p) return;
    players.forEach(function(q){ q.hasBall=false; });
    p.hasBall=true; ball.holder=p; ball.shooter=null;
    ball.inFlight=false; ball.trail=[];
    p.x = team==='jazz' ? 175 : 585;
  }

  function d2(a,b){ return Math.hypot(a.x-b.x, a.y-b.y); }

  // ── Fire spawner ───────────────────────────────────────────────────────────────
  function spawnFire() {
    players.forEach(function(p){
      if (p.onFire && Math.random()>0.55) firePart(p.x+p.w/2+(Math.random()-0.5)*8, p.y-p.h*0.65);
    });
  }

  // ── Draw helpers ──────────────────────────────────────────────────────────────
  function drawCourt() {
    ctx.fillStyle='#100818'; ctx.fillRect(0,0,W,H);
    var fl=ctx.createLinearGradient(0,FLOOR,0,H);
    fl.addColorStop(0,'#C88538'); fl.addColorStop(1,'#7A4F20');
    ctx.fillStyle=fl; ctx.fillRect(0,FLOOR,W,H-FLOOR);
    ctx.save(); ctx.strokeStyle='rgba(255,255,255,0.15)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(W/2,FLOOR); ctx.lineTo(W/2,H); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(W/2,FLOOR,68,16,0,0,Math.PI); ctx.stroke();
    ctx.strokeRect(0,FLOOR,170,88); ctx.strokeRect(W-170,FLOOR,170,88);
    ctx.beginPath(); ctx.arc(HOOP_L.x,FLOOR,215,0,Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(HOOP_R.x,FLOOR,215,0,Math.PI); ctx.stroke();
    ctx.restore();
    ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillRect(0,FLOOR-3,W,3);
  }

  function drawHoop(h, tc) {
    var d = h===HOOP_L ? 1 : -1;
    ctx.fillStyle='#e8e8e8'; ctx.fillRect(h.x-3,h.y-38,6,58);
    ctx.strokeStyle='#999'; ctx.lineWidth=1; ctx.strokeRect(h.x-3,h.y-38,6,58);
    ctx.strokeStyle='#f55'; ctx.lineWidth=1.5; ctx.strokeRect(h.x-2,h.y-18,4,20);
    ctx.strokeStyle='#FF4500'; ctx.lineWidth=4; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(h.x,h.y); ctx.lineTo(h.x+d*38,h.y); ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,0.5)'; ctx.lineWidth=1;
    for (var i=0;i<=5;i++){
      ctx.beginPath(); ctx.moveTo(h.x+d*i*7.4,h.y); ctx.lineTo(h.x+d*(7+i*5),h.y+22); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(h.x+d*7,h.y+22); ctx.lineTo(h.x+d*31,h.y+22); ctx.stroke();
    ctx.fillStyle=tc.primary; ctx.fillRect(h.x-28,h.y-60,56,17);
    ctx.fillStyle=tc.secondary; ctx.font='7px "Press Start 2P",monospace';
    ctx.textAlign='center'; ctx.fillText(tc.name,h.x,h.y-48);
  }

  function drawPlayer(p) {
    var cx=p.x+p.w/2, top=p.y-p.h;
    var tc = p.team==='jazz' ? JAZZ : NETS;
    var bob = p.onGround ? Math.sin(p.frame*0.14)*2 : 0;
    ctx.save(); ctx.translate(cx, p.y+bob*0.3); ctx.scale(p.facing,1);

    if (p.onFire) {
      ctx.save(); ctx.globalAlpha=0.3+Math.sin(Date.now()*0.009)*0.15;
      var glow=ctx.createRadialGradient(0,-p.h/2,4,0,-p.h/2,p.w*2.2);
      glow.addColorStop(0,'#FF6B00'); glow.addColorStop(1,'transparent');
      ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(0,-p.h/2,p.w*2.2,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
    ctx.save(); ctx.globalAlpha=0.22; ctx.fillStyle='#000';
    ctx.beginPath(); ctx.ellipse(0,4,p.w*0.62,5,0,0,Math.PI*2); ctx.fill(); ctx.restore();

    var leg=p.onGround ? Math.sin(p.frame*0.27)*5 : 0;
    ctx.fillStyle=tc.primary;
    ctx.fillRect(-p.w/2+2,-p.h*0.32,p.w/2-3,p.h*0.28+leg);
    ctx.fillRect(2,-p.h*0.32,p.w/2-3,p.h*0.28-leg);
    ctx.fillStyle='#eee';
    ctx.fillRect(-p.w/2+1,-p.h*0.32+p.h*0.28+leg,p.w/2-2,8);
    ctx.fillRect(2,-p.h*0.32+p.h*0.28-leg,p.w/2-2,8);
    ctx.fillStyle=tc.secondary; ctx.fillRect(-p.w/2,-p.h*0.44,p.w,p.h*0.13);
    ctx.fillStyle=tc.primary;   ctx.fillRect(-p.w/2,-p.h*0.82,p.w,p.h*0.4);
    ctx.fillStyle=tc.secondary; ctx.fillRect(-p.w/2,-p.h*0.74,p.w,5);
    ctx.fillStyle='#D4906A';
    ctx.beginPath(); ctx.arc(0,-p.h*0.9,p.w*0.38,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#2a1a0a';
    ctx.beginPath(); ctx.arc(0,-p.h*0.9-p.w*0.2,p.w*0.32,Math.PI,0); ctx.fill();
    ctx.fillStyle=tc.secondary; ctx.font='bold 9px monospace'; ctx.textAlign='center';
    ctx.fillText(p.num, 0, -p.h*0.62);
    ctx.strokeStyle=tc.primary; ctx.lineWidth=6; ctx.lineCap='round';
    var sw=Math.sin(p.frame*0.14)*7;
    ctx.beginPath(); ctx.moveTo(p.w/2-2,-p.h*0.74);
    ctx.lineTo(p.w/2+11,-p.h*0.74+sw+(p.hasBall?-9:0)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-p.w/2+2,-p.h*0.74);
    ctx.lineTo(-p.w/2-8,-p.h*0.74-sw); ctx.stroke();
    ctx.restore();

    // Name badge
    ctx.fillStyle='rgba(0,0,0,0.6)';
    ctx.fillRect(cx-30,top-15,60,12);
    ctx.fillStyle=tc.secondary; ctx.font='6px "Press Start 2P",monospace';
    ctx.textAlign='center'; ctx.fillText(p.name.slice(0,9),cx,top-6);
  }

  function drawBall() {
    ball.trail.forEach(function(t){
      ctx.save(); ctx.globalAlpha=t.life*0.55;
      var g=ctx.createRadialGradient(t.x,t.y,0,t.x,t.y,ball.r*2.2);
      g.addColorStop(0,'#FFD700'); g.addColorStop(1,'transparent');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(t.x,t.y,ball.r*2.2,0,Math.PI*2); ctx.fill();
      ctx.restore();
    });
    ctx.save(); ctx.globalAlpha=Math.max(0.08,0.32-(FLOOR+4-ball.y)*0.0009);
    ctx.fillStyle='#000';
    ctx.beginPath(); ctx.ellipse(ball.x,FLOOR+5,ball.r*1.4,4,0,0,Math.PI*2); ctx.fill(); ctx.restore();
    var onFire = ball.shooter && ball.shooter.onFire;
    var bg=ctx.createRadialGradient(ball.x-3,ball.y-3,1,ball.x,ball.y,ball.r);
    if (onFire){ bg.addColorStop(0,'#FFF060'); bg.addColorStop(0.5,'#FF6B00'); bg.addColorStop(1,'#CC2200'); }
    else       { bg.addColorStop(0,'#FFA040'); bg.addColorStop(0.6,'#CC5500'); bg.addColorStop(1,'#773300'); }
    ctx.fillStyle=bg; ctx.beginPath(); ctx.arc(ball.x,ball.y,ball.r,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(ball.x-ball.r,ball.y); ctx.lineTo(ball.x+ball.r,ball.y); ctx.stroke();
    ctx.beginPath(); ctx.arc(ball.x,ball.y,ball.r,-0.6,0.6); ctx.stroke();
    ctx.beginPath(); ctx.arc(ball.x,ball.y,ball.r,Math.PI-0.6,Math.PI+0.6); ctx.stroke();
  }

  function drawHUD() {
    ctx.fillStyle='rgba(0,0,0,0.82)'; ctx.fillRect(0,0,W,52);
    ctx.fillStyle=JAZZ.primary;  ctx.fillRect(0,0,W/2-58,52);
    ctx.fillStyle=NETS.primary;  ctx.fillRect(W/2+58,0,W/2-58,52);
    ctx.fillStyle='#111';        ctx.fillRect(W/2-58,0,116,52);
    ctx.fillStyle=JAZZ.secondary; ctx.font='12px "Press Start 2P",monospace';
    ctx.textAlign='left'; ctx.fillText('JAZZ  '+score.jazz,14,33);
    ctx.fillStyle=NETS.secondary;
    ctx.textAlign='right'; ctx.fillText(score.nets+'  NETS',W-14,33);
    var m=Math.floor(clock/60), s=String(clock%60).padStart(2,'0');
    ctx.fillStyle=clock<=10?'#FF3030':'#FFD700';
    ctx.font='16px "Press Start 2P",monospace'; ctx.textAlign='center';
    ctx.fillText(m+':'+s,W/2,33);
    ctx.font='6px "Press Start 2P",monospace'; ctx.fillStyle='rgba(255,255,255,0.3)';
    ctx.fillText('ESC TO EXIT',W/2,47);
    var fy=62;
    players.filter(function(p){return p.onFire;}).forEach(function(p){
      ctx.fillStyle='#FF6B00'; ctx.font='7px "Press Start 2P",monospace';
      ctx.textAlign= p.team==='jazz'?'left':'right';
      ctx.fillText('🔥 '+p.name+' IS ON FIRE!', p.team==='jazz'?8:W-8, fy); fy+=13;
    });
  }

  function drawCommentary() {
    if (!commentary) return;
    var frac=commentary.life/commentary.max;
    var a=frac>0.82?(1-frac)/0.18:frac<0.22?frac/0.22:1;
    ctx.save(); ctx.globalAlpha=a;
    ctx.font='bold 24px "Press Start 2P",monospace';
    ctx.textAlign='center'; ctx.shadowColor='#FF6B00'; ctx.shadowBlur=22;
    ctx.fillStyle='#FFD700'; ctx.fillText(commentary.text,W/2,H/2-10);
    ctx.restore();
    commentary.life--;
    if (commentary.life<=0) commentary=null;
  }

  function drawParticles() {
    particles.forEach(function(p){
      ctx.save(); ctx.globalAlpha=p.life; ctx.fillStyle=p.color;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill(); ctx.restore();
    });
    floats.forEach(function(t){
      ctx.save(); ctx.globalAlpha=t.life/80;
      ctx.font='bold 16px "Press Start 2P",monospace'; ctx.textAlign='center';
      ctx.fillStyle=t.color; ctx.shadowColor=t.color; ctx.shadowBlur=8;
      ctx.fillText(t.txt,t.x,t.y); ctx.restore();
    });
  }

  function drawTitle() {
    ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H);
    if (Math.random()>0.62) firePart(W/2+(Math.random()-0.5)*340,182);
    tickParticles(); drawParticles();
    var tg=ctx.createLinearGradient(0,108,0,192);
    tg.addColorStop(0,'#FFF060'); tg.addColorStop(0.5,'#FF6B00'); tg.addColorStop(1,'#CC2200');
    ctx.save(); ctx.shadowColor='#FF4400'; ctx.shadowBlur=32; ctx.fillStyle=tg;
    ctx.font='bold 60px "Press Start 2P",monospace'; ctx.textAlign='center';
    ctx.fillText('NBA JAM',W/2,182); ctx.restore();
    ctx.font='11px "Press Start 2P",monospace'; ctx.textAlign='center';
    ctx.fillStyle=JAZZ.secondary; ctx.fillText('UTAH JAZZ',W/2-148,232);
    ctx.fillStyle='#666'; ctx.fillText('VS',W/2,232);
    ctx.fillStyle=NETS.secondary; ctx.fillText('NEW JERSEY',W/2+145,232);
    // Roster panels
    ctx.fillStyle=JAZZ.primary;  ctx.fillRect(W/2-285,248,210,62);
    ctx.fillStyle=NETS.primary;  ctx.fillRect(W/2+75,248,210,62);
    ctx.font='8px "Press Start 2P",monospace';
    jazzRoster.forEach(function(r,i){
      ctx.fillStyle=JAZZ.secondary; ctx.textAlign='center';
      ctx.fillText('#'+r.num+' '+r.name, W/2-180, 272+i*22);
    });
    netsRoster.forEach(function(r,i){
      ctx.fillStyle=NETS.secondary; ctx.textAlign='center';
      ctx.fillText('#'+r.num+' '+r.name, W/2+180, 272+i*22);
    });
    ctx.fillStyle='rgba(255,255,255,0.12)'; ctx.font='6px "Press Start 2P",monospace';
    ctx.fillText('TYPE  STOCKTON  TO UNLOCK THE LEGENDS',W/2,330);
    ctx.fillStyle='#444'; ctx.font='7px "Press Start 2P",monospace';
    ctx.fillText('ARROWS/WASD: MOVE+JUMP    SPACE/F: SHOOT    ESC: QUIT',W/2,378);
    if (Math.floor(Date.now()/540)%2===0) {
      ctx.fillStyle='#FF6B00'; ctx.font='10px "Press Start 2P",monospace';
      ctx.fillText('▶  PRESS SPACE TO TIP OFF  ◀',W/2,422);
    }
  }

  function drawGameOver() {
    ctx.fillStyle='rgba(0,0,0,0.8)'; ctx.fillRect(0,0,W,H);
    ctx.font='bold 30px "Press Start 2P",monospace'; ctx.textAlign='center';
    ctx.shadowColor='#FF6B00'; ctx.shadowBlur=20; ctx.fillStyle='#FFD700';
    ctx.fillText('GAME OVER',W/2,H/2-52); ctx.shadowBlur=0;
    ctx.font='13px "Press Start 2P",monospace'; ctx.fillStyle='#fff';
    ctx.fillText('JAZZ '+score.jazz+'  —  '+score.nets+' NETS',W/2,H/2+4);
    var w=score.jazz>score.nets?'JAZZ WIN!':score.nets>score.jazz?'NETS WIN!':"TIE GAME!";
    ctx.fillStyle=score.jazz>=score.nets?JAZZ.secondary:NETS.secondary;
    ctx.font='18px "Press Start 2P",monospace'; ctx.fillText(w,W/2,H/2+46);
    if (Math.floor(Date.now()/580)%2===0) {
      ctx.fillStyle='#888'; ctx.font='8px "Press Start 2P",monospace';
      ctx.fillText('SPACE: PLAY AGAIN     ESC: QUIT',W/2,H/2+92);
    }
  }

  // ── Tick helpers ──────────────────────────────────────────────────────────────
  function tickParticles() {
    particles = particles.filter(function(p){
      p.x+=p.vx; p.y+=p.vy; p.vy+=0.07; p.life-=p.decay; return p.life>0;
    });
    floats = floats.filter(function(t){ t.y+=t.vy; t.life--; return t.life>0; });
  }

  // ── Main loop ─────────────────────────────────────────────────────────────────
  function loop() {
    if (!overlay) return;
    if (state==='playing') {
      var aj = activeJazz();
      players.forEach(function(p){
        if (p===aj)             updateHuman(p);
        else if (p.team==='jazz') updateJazzAI(p);
        else                    updateCPU(p, p===players[2]);
      });
      updateBall();
      spawnFire();
      tickParticles();
    } else if (state==='title') {
      tickParticles();
    }

    ctx.clearRect(0,0,W,H);
    if (state==='title') {
      drawTitle();
    } else {
      drawCourt();
      drawHoop(HOOP_L, NETS); drawHoop(HOOP_R, JAZZ);
      drawParticles();
      drawBall();
      players.slice().reverse().forEach(drawPlayer);
      drawHUD();
      drawCommentary();
      if (state==='gameover') drawGameOver();
    }
    animId = requestAnimationFrame(loop);
  }

})();
