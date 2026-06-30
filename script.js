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
