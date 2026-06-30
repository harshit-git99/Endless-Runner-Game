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
