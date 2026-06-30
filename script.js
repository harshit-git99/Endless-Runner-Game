(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('startBtn');
  const resetBtn = document.getElementById('resetBtn');
  const leftBtn = document.getElementById('leftBtn');
  const rightBtn = document.getElementById('rightBtn');

  const howToFab = document.getElementById('howToFab');
  const howToOverlay = document.getElementById('howToOverlay');
  const howToClose = document.getElementById('howToClose');

  let W = canvas.width;
  let H = canvas.height;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  const state = {
    started: false,
    score: 0,
    best: Number(localStorage.getItem('best_crowd_avoided') || '0'),
    keys: {
      up: false,
      down: false,
      left: false,
      right: false,
    },
    car: {
      // Position (center)
      x: W / 2,
      y: H * 0.78,
      // Kinematics
      vx: 0,
      // forward speed is implicit (car moves “up” the screen)
      angle: 0, // purely for visuals
      // Size
      w: 44,
      h: 64,
      // Speed tuning (feels like arcade)
      accel: 0.1,
      maxSpeed: 0.2,
      minSpeed: 0.005,
      decel: 0.1,
      lateralAccel: 0.1,
      lateralFriction: 0.1,
      steerAmount: 1.1,
    },
    world: {
      // Obstacles move from top -> bottom. Car stays near bottom.
      obstacles: [],
      // Current forward speed
      speed: 0.5,
      spawnTimer: 20,
      spawnEvery: 20, // seconds (fewer obstacles)

      speedGainEvery: 1, // score threshold steps
      speedGain: 0.1,
    },
    lastTs: 0,
  };

  bestEl.textContent = String(state.best);

  function resetGame() {
    state.started = false;
    state.score = 0;
    state.lastTs = 0;
    state.car.x = W / 2;
    state.car.y = H / 1.25;
    state.car.vx = 0;
    state.car.vy = 0;
    state.world.speed = state.car.minSpeed;
    state.world.obstacles = [];
    state.world.spawnTimer = 0;

    state.car.angle = 0;
    scoreEl.textContent = '0';
    overlay.classList.remove('hidden');
  }

  function startGame() {
    state.started = true;
    overlay.classList.add('hidden');
  }

  function onKey(e, down) {
    const k = e.key.toLowerCase();

    // Arrow keys
    if (e.key === 'ArrowUp') state.keys.up = down;
    else if (e.key === 'ArrowDown') state.keys.down = down;
    else if (e.key === 'ArrowLeft') state.keys.left = down;
    else if (e.key === 'ArrowRight') state.keys.right = down;

    // WASD
    else if (k === 'w') state.keys.up = down;
    else if (k === 's') state.keys.down = down;
    else if (k === 'a') state.keys.left = down;
    else if (k === 'd') state.keys.right = down;
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      if (!state.started) startGame();
      e.preventDefault();
      return;
    }

    onKey(e, true);
    // Prevent arrow keys from scrolling the page.
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) e.preventDefault();

    if (!state.started) {
      // Allow driving immediately without extra click if user presses arrows.
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) startGame();
    }
  }, { passive: false });

  window.addEventListener('keyup', (e) => {
    onKey(e, false);
  });

  function bindHoldButton(btnEl, keyName) {
    if (!btnEl) return;

    const setDown = (down) => {
      state.keys[keyName] = down;
    };

    const onPointerDown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDown(true);
      if (!state.started) startGame();
    };

    const onPointerUp = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDown(false);
    };

    btnEl.addEventListener('pointerdown', onPointerDown, { passive: false });
    btnEl.addEventListener('pointerup', onPointerUp, { passive: false });
    btnEl.addEventListener('pointercancel', onPointerUp, { passive: false });
    btnEl.addEventListener('pointerleave', onPointerUp, { passive: false });
  }

  startBtn.addEventListener('click', () => {
    if (!state.started) startGame();
  });

  resetBtn.addEventListener('click', () => {
    resetGame();
  });

  bindHoldButton(leftBtn, 'left');
  bindHoldButton(rightBtn, 'right');

  // HOW TO PLAY popup behavior
  function showHowTo() {
    if (!howToOverlay) return;
    howToOverlay.classList.remove('hidden');
  }

  function hideHowTo() {
    if (!howToOverlay) return;
    howToOverlay.classList.add('hidden');
  }

  if (howToFab) howToFab.addEventListener('click', showHowTo);
  if (howToClose) howToClose.addEventListener('click', hideHowTo);
  if (howToOverlay) {
    howToOverlay.addEventListener('click', (e) => {
      if (e.target === howToOverlay) hideHowTo();
    });
  }
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideHowTo();
  });

  function drawBackground() {
    // subtle grid
    ctx.clearRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, 0, W, H);

    const grid = 30;
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += grid) {
      ctx.strokeStyle = x % (grid * 3) === 0 ? 'rgba(76,201,240,0.12)' : 'rgba(255,255,255,0.06)';
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y <= H; y += grid) {
      ctx.strokeStyle = y % (grid * 3) === 0 ? 'rgba(247,37,133,0.10)' : 'rgba(255,255,255,0.06)';
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // border
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 2;
    ctx.strokeRect(12, 12, W - 24, H - 24);

    // speed lines (forward motion feel)
    const speed = state.world.speed;
    const lineCount = 18;
    for (let i = 0; i < lineCount; i++) {
      const t = (i / lineCount);
      const yy = 12 + (H - 24) * (t);
      const len = 16 + 28 * t;
      const alpha = 0.08 + 0.12 * (1 - t);
      ctx.strokeStyle = `rgba(76,201,240,${alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      const wobble = Math.sin((state.score * 0.02) + i) * 6;
      ctx.moveTo(12 + (W - 24) / 2 + wobble, yy);
      ctx.lineTo(12 + (W - 24) / 2 + wobble, yy + len * (0.4 + speed / 16));
      ctx.stroke();
    }
  }


  function drawCar() {
    const { x, y } = state.car;

    // Render car as an emoji
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '44px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

    // subtle shadow/glow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillText('🤐', x + 3, y + 6);

    ctx.fillStyle = 'rgba(255,255,255,0.98)';
    ctx.fillText('🤐', x, y);

    ctx.restore();
  }

  const OB_EMOJI_LIST = [
    '☠','😺','🐵','🗣','👤','👥','👯‍♀️','👨‍❤️‍💋‍👨','👨‍👩‍👦','👨‍👩‍👦‍👦','👪','👨‍👩‍👧👦','👨‍👩‍👧','👨‍👩‍👧','👨‍👨‍👦','👨‍👨‍👧','👨‍👨‍👦','👨‍👨‍👦','👨‍👨‍👧','👦','👩‍👦','👨‍👦','👨‍👧','👭','👫','👩👨','🧑','🧒','👴','👩‍🦰','👨‍🦱','👩‍🦳','🤴','🚴‍♀️','🚴‍♂️','🏇','🏃‍♀️','🏃‍♂️','👩‍🦯','👨‍🦯','👩‍🦼','👨‍🦼'
  ];

  function pickObstacleEmoji() {
    return OB_EMOJI_LIST[Math.floor(Math.random() * OB_EMOJI_LIST.length)];
  }

  function drawObstacles() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const ob of state.world.obstacles) {
      const { x, y } = ob;
      ctx.font = `${Math.max(26, Math.min(54, ob.w))}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;

      const emoji = ob.emoji;

      // subtle shadow
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillText(emoji, x + 3, y + 5);

      ctx.fillStyle = 'rgba(255,255,255,0.98)';
      ctx.fillText(emoji, x, y);
    }
  }

  function update(dt) {
    const c = state.car;
    if (!state.started) return;

    // UP/DOWN control forward speed (car auto-moves forward)
    if (state.keys.up) state.world.speed = Math.min(c.maxSpeed, state.world.speed + c.accel * dt * 2.1);
    if (state.keys.down) state.world.speed = Math.max(c.minSpeed, state.world.speed - c.decel * dt * 2.1);
    // LEFT/RIGHT steer laterally
    if (state.keys.left) c.vx -= c.lateralAccel * dt * 4.2;
    if (state.keys.right) c.vx += c.lateralAccel * dt * 4.2;

    c.vx *= Math.pow(c.lateralFriction, dt);

    // move horizontally only (forward is obstacle motion)
    c.x += c.vx * dt * 60;

    // angle based on steering
    const targetAngle = clamp(c.vx * c.steerAmount, -0.35, 0.35);
    c.angle += (targetAngle - c.angle) * (1 - Math.pow(0.001, dt));

    // world + obstacles
    state.world.spawnTimer += dt;
    if (state.world.spawnTimer >= state.world.spawnEvery) {
      state.world.spawnTimer = 0;
      spawnObstacle();
    }

    // speed scaling with score
    state.world.speed = clamp(state.world.speed + Math.floor(state.score / state.world.speedGainEvery) * state.world.speedGain * dt * 0.01, c.minSpeed, c.maxSpeed);

    const speed = state.world.speed;

    // Move obstacles
    for (const ob of state.world.obstacles) {
      ob.y += ob.speed * dt * speed * 10;
    }
    // Remove offscreen
    state.world.obstacles = state.world.obstacles.filter(o => o.y - o.h/2 < H + 80);

    // Collision (AABB)
    const halfW = c.w / 2;
    const pad = 12;
    const minX = pad + halfW;
    const maxX = W - pad - halfW;

    let hit = false;
    // Edge collision
    if (c.x < minX) { c.x = minX; hit = true; }
    if (c.x > maxX) { c.x = maxX; hit = true; }

    // Obstacle collision
    const carBox = {
      left: c.x - c.w/2,
      right: c.x + c.w/2,
      top: c.y - c.h/2,
      bottom: c.y + c.h/2,
    };

    for (const ob of state.world.obstacles) {
      const oLeft = ob.x - ob.w/2;
      const oRight = ob.x + ob.w/2;
      const oTop = ob.y - ob.h/2;
      const oBottom = ob.y + ob.h/2;

      const overlap = !(carBox.right < oLeft || carBox.left > oRight || carBox.bottom < oTop || carBox.top > oBottom);
      if (overlap) { hit = true; break; }
    }

    // Score increases with forward speed and time
    state.score += speed * dt * 6;
    scoreEl.textContent = String(Math.floor(state.score));

    // Game over
    if (hit) gameOver();
  }

  function spawnObstacle() {
    // obstacle is a small car / box coming from top to bottom
    const laneMargin = 18;
    const xMin = 12 + (state.world.obstacles.length % 2 === 0 ? 0 : 0);
    const xMax = W - 12;

    // keep obstacle slightly away from edges
    const x = Math.random() * (xMax - xMin - laneMargin) + xMin + laneMargin;
    const size = 28 + Math.random() * 22;

    state.world.obstacles.push({
      x,
      y: -80,
      w: size * 0.9,
      h: size,
      speed: 1 + Math.random() * 0.9,
      emoji: pickObstacleEmoji(),
    });
  }

  function gameOver() {
    state.started = false;
    overlay.classList.remove('hidden');
    const finalScore = Math.floor(state.score);
    state.score = 0;


    if (finalScore > state.best) {
      state.best = finalScore;
      localStorage.setItem('car_game_best', String(state.best));
      bestEl.textContent = String(state.best);
    }

    overlay.querySelector('.overlay-title').textContent = 'Game Over';
    overlay.querySelectorAll('.overlay-text')[0].innerHTML = `Score: <b>${finalScore}</b>. Press <b>Space</b> to restart.`;
  }

  function loop(ts) {
    if (!state.lastTs) state.lastTs = ts;
    const dt = clamp((ts - state.lastTs) / 16.6667, 0.2, 2); // normalize around 60fps
    state.lastTs = ts;

    drawBackground();
    update(dt);
    drawObstacles();
    drawCar();


    // If not started, show the default overlay content.
    if (!state.started) {
      overlay.querySelector('.overlay-title').textContent = 'Press "SPACE" or "Start" button to Start.';
      overlay.querySelectorAll('.overlay-text')[0].innerHTML = 'Press arrow keys for moving.';
    }

    requestAnimationFrame(loop);
  }

  // Start with overlay visible.
  overlay.classList.remove('hidden');

  // Minimal polyfill for hidden (since CSS may not include it)
  const style = document.createElement('style');
  style.textContent = `.hidden{display:none !important;}`;
  document.head.appendChild(style);

  function resizeCanvasForOrientation() {
    // Desired internal resolutions:
    // - Landscape: 600x400
    // - Portrait:  400x600
    const isPortrait = window.innerHeight > window.innerWidth;
    const targetW = isPortrait ? 400 : 600;
    const targetH = isPortrait ? 600 : 400;

    // Only resize when needed (avoid resetting gameplay constantly)
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
      W = canvas.width;
      H = canvas.height;

      // Re-align game entities to the new dimensions.
      // Simpler + more reliable than trying to scale state mid-run.
      resetGame();
    }
  }

  // Handle initial layout + future orientation changes.
  window.addEventListener('resize', () => {
    // Debounce via rAF tick.
    if (resizeCanvasForOrientation._raf) cancelAnimationFrame(resizeCanvasForOrientation._raf);
    resizeCanvasForOrientation._raf = requestAnimationFrame(resizeCanvasForOrientation);
  });

  resizeCanvasForOrientation();

  requestAnimationFrame(loop);

  resetGame();
})();
