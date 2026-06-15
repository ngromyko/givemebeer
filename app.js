const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const menu = document.getElementById("menu");
const endScreen = document.getElementById("endScreen");
const finalScore = document.getElementById("finalScore");
const finalText = document.getElementById("finalText");
const startBtn = document.getElementById("startBtn");
const soundBtn = document.getElementById("soundBtn");
const againBtn = document.getElementById("againBtn");
const changeDrunkardBtn = document.getElementById("changeDrunkardBtn");
const scoreForm = document.getElementById("scoreForm");
const playerName = document.getElementById("playerName");
const leaderboardEl = document.getElementById("leaderboard");
const endLeaderboardEl = document.getElementById("endLeaderboard");
const refreshTop = document.getElementById("refreshTop");
const friendCards = [...document.querySelectorAll(".friend-card")];

const ASSET_VERSION = "20260615-webp-4";
const BASE_PATH = document.body.dataset.basePath || "";
let W = 1920;
let H = 1080;
let playerSize = 132;
let portraitGame = false;
const DEFAULT_MOBILE_FOREGROUND_ZOOM = 1.3;
const ZOOM_STORAGE_KEY = "gimmeBeerForegroundZoomV2";
const urlParams = new URLSearchParams(window.location.search);

function parseZoom(raw) {
  if (!raw) return null;
  const value = Number.parseFloat(raw.replace(",", "."));
  if (!Number.isFinite(value)) return null;
  return Math.max(0.9, Math.min(1.35, value));
}

function readMobileForegroundZoom() {
  return parseZoom(urlParams.get("zoom")) || parseZoom(localStorage.getItem(ZOOM_STORAGE_KEY)) || DEFAULT_MOBILE_FOREGROUND_ZOOM;
}

let mobileForegroundZoom = readMobileForegroundZoom();

window.setBeerZoom = (value) => {
  const zoom = parseZoom(String(value));
  if (!zoom) return mobileForegroundZoom;
  mobileForegroundZoom = zoom;
  localStorage.setItem(ZOOM_STORAGE_KEY, String(zoom));
  if (!running) draw();
  return zoom;
};
window.getBeerZoom = () => mobileForegroundZoom;
const backgrounds = [
  { src: "assets/bg-church.webp", label: "Костёл" },
  { src: "assets/bg-culture.webp", label: "Дом культуры" },
  { src: "assets/bg-mayor.webp", label: "Райисполком" },
  { src: "assets/bg-reservoir.webp", label: "Парк и водохранилище" },
  { src: "assets/bg-zarechno-station.webp", label: "Заречное ЖД станция" },
  { src: "assets/bg-zarechno-rail.webp", label: "Заречное" },
  { src: "assets/bg-station.webp", label: "Вокзал" },
  { src: "assets/bg-entry.webp", label: "Стела Смолевичи" },
  { src: "assets/bg-center-church.webp", label: "Церковь в центре" },
  { src: "assets/bg-orthodox.webp", label: "Православный храм" },
  { src: "assets/bg-memorial.webp", label: "Мемориал" },
  { src: "assets/bg-mound-glory.webp", label: "Курган Славы" },
  { src: "assets/bg-school.webp", label: "Школа" },
  { src: "assets/bg-aerial.webp", label: "Панорама города" },
  { src: "assets/bg-stadium-victoria.webp", label: "Стадион Виктория" },
];
const friends = [
  "assets/friend-1.png",
  "assets/friend-2.png",
  "assets/friend-3.png",
  "assets/friend-4.png",
  "assets/friend-5.png",
  "assets/friend-6.png",
  "assets/friend-7.png",
];
const beers = [
  { src: "assets/beer-zolotoe-05.png", label: "Золотое 0.5", liters: "0.5", points: 5, drunk: 1, size: 76, weight: 42 },
  { src: "assets/beer-zolotoe-1.png", label: "Золотое 1 л", liters: "1", points: 10, drunk: 2, size: 88, weight: 22 },
  { src: "assets/beer-zolotoe-2.png", label: "Золотое 2 л", liters: "2", points: 20, drunk: 4, size: 108, weight: 10 },
  { src: "assets/beer-white-gold.png", label: "Белое Золото", liters: "0.5", points: 7, drunk: 1.5, size: 82, weight: 12 },
  { src: "assets/beer-blue-pilsner.png", label: "Синий Pilsner", liters: "0.5", points: 8, drunk: 1.6, size: 82, weight: 8 },
  { src: "assets/beer-zatecky.png", label: "Zatecky Gus", liters: "1", points: 12, drunk: 2.3, size: 92, weight: 6 },
];
const images = {};
const gateCache = new Map();
let selectedFriend = 0;
let running = false;
let over = false;
let raf = 0;
let last = 0;
let audioCtx = null;
let soundEnabled = localStorage.getItem("flappySmolevichiSound") !== "off";
let leaderboardRows = [];

const state = {
  score: 0,
  beers: 0,
  drunk: 0,
  bgIndex: 0,
  player: { x: 350, y: 470, vy: 0, rot: 0 },
  gates: [],
  collectibles: [],
  popups: [],
  spawn: 0,
  bgScroll: 0,
  shake: 0,
};

function isPortraitLayout() {
  return window.matchMedia("(max-width: 700px) and (orientation: portrait)").matches;
}

function playerBaseX() {
  return portraitGame ? Math.round(W * 0.24) : 350;
}

function playerBaseY() {
  return portraitGame ? Math.round(H * 0.42) : 470;
}

function foregroundZoom() {
  return portraitGame ? mobileForegroundZoom : 1;
}

function syncCanvasSize() {
  portraitGame = isPortraitLayout();
  W = portraitGame ? 1080 : 1920;
  H = portraitGame ? 1920 : 1080;
  playerSize = portraitGame ? 118 : 132;
  canvas.width = W;
  canvas.height = H;
  gateCache.clear();
  canvas.classList.toggle("portrait-canvas", portraitGame);
}

function weightedBeer() {
  const total = beers.reduce((sum, beer) => sum + beer.weight, 0);
  let roll = Math.random() * total;
  for (const beer of beers) {
    roll -= beer.weight;
    if (roll <= 0) return beer;
  }
  return beers[0];
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      images[src] = img;
      resolve();
    };
    img.onerror = () => {
      console.warn(`Asset failed: ${src}`);
      resolve();
    };
    img.src = src.endsWith(".webp") ? `${src}?v=${ASSET_VERSION}` : src;
  });
}

function syncSoundButton() {
  soundBtn.textContent = soundEnabled ? "Звук: вкл" : "Звук: выкл";
}

function initAudio() {
  if (!soundEnabled) return null;
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function tone(freq, duration, type = "sine", volume = 0.08, when = 0, slideTo = null) {
  const ctxAudio = initAudio();
  if (!ctxAudio) return;
  const osc = ctxAudio.createOscillator();
  const gain = ctxAudio.createGain();
  const startAt = ctxAudio.currentTime + when;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startAt);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, startAt + duration);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(gain).connect(ctxAudio.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.03);
}

function noise(duration, volume = 0.06, when = 0) {
  const ctxAudio = initAudio();
  if (!ctxAudio) return;
  const length = Math.max(1, Math.floor(ctxAudio.sampleRate * duration));
  const buffer = ctxAudio.createBuffer(1, length, ctxAudio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const source = ctxAudio.createBufferSource();
  const gain = ctxAudio.createGain();
  const startAt = ctxAudio.currentTime + when;
  source.buffer = buffer;
  gain.gain.setValueAtTime(volume, startAt);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  source.connect(gain).connect(ctxAudio.destination);
  source.start(startAt);
  source.stop(startAt + duration + 0.02);
}

const sfx = {
  start() {
    tone(330, 0.08, "square", 0.045);
    tone(520, 0.11, "square", 0.05, 0.07);
  },
  flap() {
    noise(0.045, 0.035);
    tone(210, 0.06, "triangle", 0.035, 0, 420);
  },
  beer(points) {
    tone(440, 0.07, "sine", 0.055);
    tone(points >= 20 ? 880 : 660, 0.11, "sine", 0.06, 0.06);
    if (points >= 10) tone(990, 0.08, "triangle", 0.04, 0.15);
  },
  crash() {
    noise(0.22, 0.11);
    tone(150, 0.24, "sawtooth", 0.06, 0, 70);
  },
  save() {
    tone(520, 0.08, "triangle", 0.045);
    tone(780, 0.11, "triangle", 0.05, 0.08);
  },
};

async function loadLeaderboard() {
  try {
    const res = await fetch(`${BASE_PATH}/api/leaderboard`);
    if (!res.ok) throw new Error("top unavailable");
    leaderboardRows = await res.json();
    renderLeaderboard(leaderboardRows);
    return leaderboardRows;
  } catch {
    leaderboardRows = JSON.parse(localStorage.getItem("flappySmolevichiTop") || "[]");
    renderLeaderboard(leaderboardRows);
    return leaderboardRows;
  }
}

function isRecordScore(score, rows = leaderboardRows) {
  const top = [...rows].sort((a, b) => Number(b.score || 0) - Number(a.score || 0)).slice(0, 5);
  return top.length < 5 || score > Number(top.at(-1)?.score || 0);
}

function renderLeaderboard(rows) {
  leaderboardEl.innerHTML = "";
  endLeaderboardEl.innerHTML = "";
  const top = rows.slice(0, 5);
  if (!top.length) {
    const li = document.createElement("li");
    li.textContent = "пока пусто";
    leaderboardEl.appendChild(li);
    endLeaderboardEl.appendChild(li.cloneNode(true));
    return;
  }
  for (const row of top) {
    const li = document.createElement("li");
    li.textContent = `${row.name} — ${row.score}`;
    leaderboardEl.appendChild(li);
    endLeaderboardEl.appendChild(li.cloneNode(true));
  }
}

async function saveScore(name, score) {
  const payload = { name: name.trim() || "безымянный", score };
  if (!isRecordScore(score)) {
    finalText.textContent = "Имя можно оставить только если побит рекорд.";
    return;
  }
  try {
    const res = await fetch(`${BASE_PATH}/api/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.status === 409) {
      const data = await res.json().catch(() => null);
      if (data?.leaderboard) {
        leaderboardRows = data.leaderboard;
        renderLeaderboard(leaderboardRows);
      }
      scoreForm.classList.add("hidden");
      finalText.textContent = "Имя можно оставить только если побит рекорд.";
      return;
    }
    if (!res.ok) throw new Error("save failed");
    leaderboardRows = await res.json();
    renderLeaderboard(leaderboardRows);
    finalText.textContent = "Сохранено в общий топ.";
  } catch {
    const rows = JSON.parse(localStorage.getItem("flappySmolevichiTop") || "[]");
    const key = payload.name.trim().toLocaleLowerCase("ru-RU");
    const previous = rows.find((row) => String(row.name || "").trim().toLocaleLowerCase("ru-RU") === key);
    const filtered = rows.filter((row) => String(row.name || "").trim().toLocaleLowerCase("ru-RU") !== key);
    if (!previous || payload.score > Number(previous.score || 0)) {
      filtered.push({ ...payload, createdAt: new Date().toISOString() });
    } else {
      filtered.push(previous);
    }
    filtered.sort((a, b) => b.score - a.score);
    localStorage.setItem("flappySmolevichiTop", JSON.stringify(filtered.slice(0, 5)));
    leaderboardRows = filtered.slice(0, 5);
    renderLeaderboard(leaderboardRows);
    finalText.textContent = "Сохранено локально, сервер топа недоступен.";
  }
}

function randomBackgroundIndex() {
  return Math.floor(Math.random() * backgrounds.length);
}

window.listBeerBg = () => backgrounds.map((bg, index) => `${index}: ${bg.label}`);
window.setBeerBg = (value) => {
  const query = String(value).toLowerCase();
  const index = Number.isFinite(Number(value))
    ? Number(value)
    : backgrounds.findIndex((bg) => bg.label.toLowerCase().includes(query));
  if (index < 0 || index >= backgrounds.length) return window.listBeerBg();
  state.bgIndex = index;
  state.bgScroll = 0;
  draw();
  return backgrounds[index].label;
};

function reset(options = {}) {
  syncCanvasSize();
  state.score = 0;
  state.beers = 0;
  state.drunk = 0;
  state.bgIndex = options.randomBackground ? randomBackgroundIndex() : state.bgIndex;
  state.player = { x: playerBaseX(), y: playerBaseY(), vy: 0, rot: 0 };
  state.gates = [];
  state.collectibles = [];
  state.popups = [];
  state.spawn = 0;
  state.bgScroll = 0;
  state.shake = 0;
  running = false;
  over = false;
  last = 0;
  scoreEl.textContent = "0";
  draw();
}

function start() {
  reset({ randomBackground: true });
  initAudio();
  sfx.start();
  menu.classList.add("hidden");
  endScreen.classList.add("hidden");
  running = true;
  flap();
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(loop);
}

function gameOver() {
  if (over) return;
  sfx.crash();
  running = false;
  over = true;
  finalScore.textContent = `${state.score} очков`;
  scoreForm.classList.add("hidden");
  finalText.textContent = `Финиш, время пить водку. Собрано пива: ${state.beers}. Проверяем топ...`;
  endScreen.classList.remove("hidden");
  loadLeaderboard().then((rows) => {
    if (!over) return;
    if (isRecordScore(state.score, rows)) {
      scoreForm.classList.remove("hidden");
      finalText.textContent = `Финиш, время пить водку. Собрано пива: ${state.beers}. Рекорд побит, оставь имя.`;
    } else {
      scoreForm.classList.add("hidden");
      const cutoff = rows.length >= 5 ? Number(rows[4]?.score || 0) : 0;
      finalText.textContent = `Финиш, время пить водку. Собрано пива: ${state.beers}. До топа нужно больше ${cutoff} очков.`;
    }
  });
}

function flap() {
  if (over) return;
  if (!running) {
    start();
    return;
  }
  sfx.flap();
  const wobblePenalty = Math.min(120, state.drunk * 6);
  state.player.vy = -850 + (Math.random() - 0.5) * wobblePenalty;
}

function addGate() {
  const gap = portraitGame ? Math.max(360, 440 - state.drunk * 3.4) : Math.max(270, 340 - state.drunk * 3.2);
  const margin = portraitGame ? 210 : 145;
  const center = margin + Math.random() * (H - margin * 2 - gap) + gap / 2;
  const gate = {
    x: W + (portraitGame ? 115 : 150),
    w: portraitGame ? 124 : 165,
    top: center - gap / 2,
    bottom: center + gap / 2,
    passed: false,
  };
  state.gates.push(gate);

  const beer = weightedBeer();
  state.collectibles.push({
    x: gate.x + (portraitGame ? 185 : 240),
    y: center - 16 + (Math.random() - 0.5) * 110,
    beer,
    taken: false,
  });
}

function circleHitsRect(cx, cy, r, rect) {
  const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

function update(dt) {
  const p = state.player;
  state.bgScroll += dt * (portraitGame ? 0.44 : 0.34);
  p.vy += (2200 + state.drunk * 14) * dt;
  p.y += p.vy * dt;
  p.x = playerBaseX() + Math.sin(performance.now() / 180) * Math.min(34, state.drunk * 1.8);
  p.rot = Math.max(-0.55, Math.min(0.82, p.vy / 1040 + Math.sin(performance.now() / 120) * state.drunk * 0.006));
  state.drunk = Math.max(0, state.drunk - dt * 0.22);
  state.spawn -= dt;
  if (state.spawn <= 0) {
    addGate();
    state.spawn = Math.max(1.15, 1.55 - state.score * 0.002);
  }

  const speed = 470 + Math.min(100, state.score * 0.7);
  for (const gate of state.gates) {
    gate.x -= speed * dt;
    if (!gate.passed && gate.x + gate.w < p.x) {
      gate.passed = true;
      state.score += 1;
      if (state.score % 25 === 0) state.bgIndex = (state.bgIndex + 1) % backgrounds.length;
      scoreEl.textContent = state.score;
    }
  }

  for (const item of state.collectibles) {
    item.x -= speed * dt;
    item.y += Math.sin((performance.now() + item.x) / 220) * 0.42;
    const dx = item.x - p.x;
    const dy = item.y - p.y;
    if (!item.taken && dx * dx + dy * dy < (item.beer.size / 2 + 34) ** 2) {
      item.taken = true;
      state.score += item.beer.points;
      state.beers += 1;
      state.drunk = Math.min(34, state.drunk + item.beer.drunk);
      state.shake = Math.min(18, state.shake + item.beer.drunk * 1.6);
      state.popups.push({
        x: item.x,
        y: item.y,
        text: `+${item.beer.liters} л`,
        life: 0.95,
        age: 0,
      });
      sfx.beer(item.beer.points);
      scoreEl.textContent = state.score;
    }
  }

  for (const popup of state.popups) {
    popup.age += dt;
    popup.y -= 92 * dt;
    popup.x += Math.sin((popup.age + popup.x) * 6) * 0.26;
  }

  state.shake = Math.max(0, state.shake - dt * 10);
  state.gates = state.gates.filter((gate) => gate.x > -160);
  state.collectibles = state.collectibles.filter((item) => item.x > -100 && !item.taken);
  state.popups = state.popups.filter((popup) => popup.age < popup.life);

  if (p.y < 38 || p.y > H - 68) gameOver();
  for (const gate of state.gates) {
    const top = circleHitsRect(p.x, p.y, 54, { x: gate.x, y: 0, w: gate.w, h: gate.top });
    const bottom = circleHitsRect(p.x, p.y, 54, { x: gate.x, y: gate.bottom, w: gate.w, h: H - gate.bottom });
    if (top || bottom) gameOver();
  }
}

function drawCoverImage(img, x, y, w, h) {
  if (!img) {
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, "#7fd8f0");
    gradient.addColorStop(0.62, "#bfead5");
    gradient.addColorStop(1, "#86d5ee");
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, w, h);
    return;
  }
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  const sx = Math.max(0, (img.width - sw) / 2);
  const sy = Math.max(0, (img.height - sh) / 2);
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function drawBackground() {
  const bg = images[backgrounds[state.bgIndex].src];
  const travel = portraitGame ? 54 : 42;
  const drift = Math.sin(state.bgScroll) * travel;
  drawCoverImage(bg, -travel + drift, 0, W + travel * 2, H);
  ctx.fillStyle = `rgba(255, 245, 205, ${0.04 + Math.min(0.08, state.drunk * 0.003)})`;
  ctx.fillRect(0, 0, W, H);
}

function getGateSprite(type, visualW) {
  const top = images["assets/obstacle-top.png"];
  const bottom = images["assets/obstacle-bottom.png"];
  const source = type === "top" ? top : bottom;
  if (!source) return null;
  const key = `${type}:${visualW}:${H}`;
  if (gateCache.has(key)) return gateCache.get(key);

  const ratio = source.height / source.width;
  const tileH = Math.ceil(visualW * ratio);
  const step = Math.max(1, Math.floor(tileH * 0.92));
  const buffer = document.createElement("canvas");
  buffer.width = Math.ceil(visualW + 42);
  buffer.height = Math.ceil(H + tileH * 2);
  const bctx = buffer.getContext("2d");
  const x = Math.floor((buffer.width - visualW) / 2);

  bctx.save();
  bctx.shadowColor = "rgba(0, 0, 0, 0.32)";
  bctx.shadowBlur = portraitGame ? 10 : 12;
  bctx.shadowOffsetX = portraitGame ? 6 : 7;
  bctx.shadowOffsetY = portraitGame ? 6 : 7;
  for (let y = type === "top" ? buffer.height - tileH : 0; type === "top" ? y >= -tileH : y < buffer.height; y += type === "top" ? -step : step) {
    bctx.drawImage(source, x, y, visualW, tileH);
  }
  bctx.restore();

  const sprite = { canvas: buffer, padX: x, tileH };
  gateCache.set(key, sprite);
  return sprite;
}

function drawGate(gate) {
  const visualW = portraitGame ? 138 : gate.w + 56;
  const topSprite = getGateSprite("top", visualW);
  const bottomSprite = getGateSprite("bottom", visualW);
  if (!topSprite || !bottomSprite) return;
  const x = gate.x + gate.w / 2 - visualW / 2;
  ctx.drawImage(topSprite.canvas, x - topSprite.padX, gate.top - topSprite.canvas.height);
  ctx.drawImage(bottomSprite.canvas, x - bottomSprite.padX, gate.bottom);
}

function drawWingHalf(wings, side, flap) {
  const sw = wings.width / 2;
  const sh = wings.height;
  const isLeft = side === "left";
  const pivotX = isLeft ? -36 : 36;
  const srcX = isLeft ? 0 : sw;
  const wingW = 118;
  const wingH = wingW * (sh / sw);
  const angle = (isLeft ? -1 : 1) * (0.1 + flap * 0.38);
  const lift = 10 - flap * 9;
  ctx.save();
  ctx.translate(pivotX, lift);
  ctx.rotate(angle);
  if (isLeft) {
    ctx.drawImage(wings, srcX, 0, sw, sh, -wingW, -wingH * 0.48, wingW, wingH);
  } else {
    ctx.drawImage(wings, srcX, 0, sw, sh, 0, -wingH * 0.48, wingW, wingH);
  }
  ctx.restore();
}

function drawPlayer(offsetX = 0, alpha = 1) {
  const p = state.player;
  const img = images[friends[selectedFriend]];
  const wings = images["assets/wings.png"];
  const flap = (Math.sin(performance.now() / 58) + 1) / 2;
  const vatnik = Math.min(1, Math.max(0, (state.drunk - 6) / 22));
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(p.x + offsetX, p.y);
  ctx.rotate(p.rot);
  drawWingHalf(wings, "left", flap);
  drawWingHalf(wings, "right", flap);
  ctx.drawImage(img, -playerSize / 2, -playerSize / 2, playerSize, playerSize);
  drawVatnikCostume(vatnik);
  ctx.restore();
}

function drawVatnikCostume(level) {
  if (level <= 0) return;
  const jacket = Math.min(1, Math.max(0, (level - 0.35) / 0.65));
  const hat = Math.min(1, Math.max(0, (level - 0.18) / 0.45));
  const face = Math.min(1, level / 0.35);

  ctx.save();
  ctx.globalAlpha = face;
  ctx.fillStyle = "rgba(216, 53, 47, 0.55)";
  ctx.beginPath();
  ctx.ellipse(-18, -5, 8, 5, -0.2, 0, Math.PI * 2);
  ctx.ellipse(18, -5, 8, 5, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(192, 33, 33, 0.62)";
  ctx.beginPath();
  ctx.arc(0, 4, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (hat > 0) {
    ctx.save();
    ctx.globalAlpha = hat;
    ctx.fillStyle = "#6d5948";
    ctx.strokeStyle = "#202629";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(-34, -56, 68, 24, 11);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#4c3c31";
    ctx.beginPath();
    ctx.roundRect(-47, -39, 22, 40, 9);
    ctx.roundRect(25, -39, 22, 40, 9);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#d9c8ae";
    ctx.beginPath();
    ctx.roundRect(-24, -52, 48, 14, 7);
    ctx.fill();
    ctx.restore();
  }

  if (jacket > 0) {
    ctx.save();
    ctx.globalAlpha = jacket;
    ctx.fillStyle = "#777061";
    ctx.strokeStyle = "#202629";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(-48, 29, 96, 45, 16);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(32, 38, 41, 0.55)";
    ctx.lineWidth = 3;
    for (let x = -42; x <= 42; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x, 31);
      ctx.lineTo(x + 24, 73);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 24, 31);
      ctx.lineTo(x, 73);
      ctx.stroke();
    }
    ctx.fillStyle = "#4e463b";
    ctx.beginPath();
    ctx.roundRect(-9, 31, 18, 42, 8);
    ctx.fill();
    ctx.restore();
  }
}

function drawCollectibles() {
  for (const item of state.collectibles) {
    const img = images[item.beer.src];
    const w = item.beer.size;
    const h = w * (img.height / img.width);
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(Math.sin((performance.now() + item.x) / 180) * 0.1);
    ctx.shadowColor = "rgba(0, 0, 0, 0.34)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetX = 7;
    ctx.shadowOffsetY = 8;
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
}

function drawPopups() {
  for (const popup of state.popups) {
    const t = popup.age / popup.life;
    const alpha = Math.max(0, 1 - t);
    const scale = 1 + Math.sin(Math.min(1, t * 2) * Math.PI) * 0.18;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(popup.x, popup.y);
    ctx.scale(scale, scale);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${portraitGame ? 42 : 48}px Arial`;
    ctx.lineWidth = portraitGame ? 9 : 10;
    ctx.strokeStyle = "#202629";
    ctx.shadowColor = "rgba(0, 0, 0, 0.34)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 5;
    ctx.shadowOffsetY = 6;
    ctx.strokeText(popup.text, 0, 0);
    ctx.shadowColor = "transparent";
    ctx.fillStyle = "#fff4d2";
    ctx.fillText(popup.text, 0, 0);
    ctx.fillStyle = "#f0bf42";
    ctx.fillText(popup.text, 0, -2);
    ctx.restore();
  }
}

function drawSceneLabel() {
  ctx.fillStyle = "rgba(32, 38, 41, 0.78)";
  ctx.fillRect(W - 500, 42, 450, 70);
  ctx.fillStyle = "#fff4d2";
  ctx.font = "900 34px Arial";
  ctx.textAlign = "center";
  ctx.fillText(backgrounds[state.bgIndex].label, W - 275, 88);
  ctx.textAlign = "left";
}

function drawDrunkOverlay() {
  if (state.drunk <= 4) return;
  const level = Math.min(1, state.drunk / 32);
  ctx.save();
  ctx.globalAlpha = level * 0.035;
  ctx.fillStyle = "#f0bf42";
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = level * 0.1;
  ctx.strokeStyle = "#d8352f";
  ctx.lineWidth = portraitGame ? 5 : 6;
  for (let y = -40; y < H + 40; y += portraitGame ? 140 : 120) {
    ctx.beginPath();
    for (let x = -20; x < W + 20; x += 48) {
      const yy = y + Math.sin(x / 40 + performance.now() / 220) * 10 * level;
      if (x === -20) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  ctx.restore();

  if (state.drunk > 22) {
    ctx.save();
    ctx.fillStyle = "rgba(255, 250, 240, 0.72)";
    ctx.strokeStyle = "#202629";
    ctx.lineWidth = 4;
    ctx.roundRect(58, H - 132, 380, 72, 14);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#202629";
    ctx.font = "900 36px Arial";
    ctx.fillText("ВАТНЫЙ РЕЖИМ", 88, H - 84);
    ctx.restore();
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  const sx = (Math.random() - 0.5) * state.shake;
  const sy = (Math.random() - 0.5) * state.shake;
  drawBackground();
  ctx.save();
  ctx.translate(sx, sy);
  const zoom = foregroundZoom();
  if (zoom !== 1) {
    ctx.translate(W / 2, H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-W / 2, -H / 2);
  }
  for (const gate of state.gates) drawGate(gate);
  drawCollectibles();
  drawPopups();
  if (state.drunk > 14) drawPlayer(-7, 0.22);
  drawPlayer();
  ctx.restore();
  drawSceneLabel();
  drawDrunkOverlay();
}

function loop(ts) {
  if (!running) {
    draw();
    return;
  }
  if (!last) last = ts;
  const dt = Math.min(0.033, (ts - last) / 1000);
  last = ts;
  update(dt);
  draw();
  raf = requestAnimationFrame(loop);
}

function chooseFriend(index) {
  selectedFriend = index;
  friendCards.forEach((card, i) => card.classList.toggle("active", i === index));
  draw();
}

window.addEventListener("keydown", (event) => {
  if (event.code === "Space" || event.code === "ArrowUp") {
    event.preventDefault();
    flap();
  }
  if (event.code.startsWith("Digit")) {
    const index = Number(event.code.replace("Digit", "")) - 1;
    if (index >= 0 && index < friends.length) chooseFriend(index);
  }
});

window.addEventListener("resize", () => {
  const wasPortrait = portraitGame;
  syncCanvasSize();
  if (wasPortrait !== portraitGame) {
    state.player.x = playerBaseX();
    state.player.y = Math.min(Math.max(state.player.y, 120), H - 120);
    draw();
  }
});

canvas.addEventListener("pointerdown", flap);
startBtn.addEventListener("click", start);
soundBtn.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  localStorage.setItem("flappySmolevichiSound", soundEnabled ? "on" : "off");
  syncSoundButton();
  if (soundEnabled) {
    initAudio();
    sfx.start();
  }
});
againBtn.addEventListener("click", () => {
  start();
});
changeDrunkardBtn.addEventListener("click", () => {
  endScreen.classList.add("hidden");
  menu.classList.remove("hidden");
  loadLeaderboard();
  reset();
});
refreshTop.addEventListener("click", loadLeaderboard);
friendCards.forEach((card) => card.addEventListener("click", () => chooseFriend(Number(card.dataset.friend))));
scoreForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveScore(playerName.value, state.score);
  sfx.save();
});

Promise.all([
  ...backgrounds.map((bg) => loadImage(bg.src)),
  ...friends.map(loadImage),
  ...beers.map((beer) => loadImage(beer.src)),
  loadImage("assets/wings.png"),
  loadImage("assets/obstacle-top.png"),
  loadImage("assets/obstacle-bottom.png"),
]).then(() => {
  syncSoundButton();
  reset();
  loadLeaderboard();
});
