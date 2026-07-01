"use strict";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const W = canvas.width;
const H = canvas.height;
const totalRounds = 7;

const phases = {
  START: "start",
  WAITING: "waiting",
  READY: "ready",
  REVEAL: "reveal",
  END: "end",
};

const assets = {
  blueFisher: loadImage("assets/fisher-blue-cutout.png"),
  pond: loadImage("assets/pond-clean.png"),
  redFisher: loadImage("assets/fisher-red-cutout.png"),
  fishSmall: loadImage("assets/fish-small.png"),
  fishMedium: loadImage("assets/fish-medium.png"),
  fishLarge: loadImage("assets/fish-large.png"),
  fishStink: loadImage("assets/fish-stink.png"),
};

const fishTable = [
  { name: "小鱼", value: 1, chance: 0.2, color: "#48a7ff", face: "^_^", sprite: "fishSmall" },
  { name: "中等鱼", value: 2, chance: 0.4, color: "#ffd34d", face: "O_O", sprite: "fishMedium" },
  { name: "大鱼", value: 3, chance: 0.2, color: "#ff5959", face: "$_$", sprite: "fishLarge" },
  { name: "臭鱼", value: 0, chance: 0.2, color: "#1f252b", face: "x_x", sprite: "fishStink", stink: true },
];

const state = {
  round: 1,
  p1Coins: 0,
  p2Coins: 0,
  phase: phases.WAITING,
  phaseUntil: 0,
  message: "",
  revealText: "",
  winnerText: "",
  fish: null,
  catchPlayer: 0,
  earlyPressed: { 1: false, 2: false },
  roundDoneAt: 0,
  roundStartedAt: 0,
  flashAt: 0,
  fishJumpAt: 0,
  fishSeenAt: 0,
  readyUntil: 0,
};

let lastTime = performance.now();
let waterTick = 0;

resetGame();
requestAnimationFrame(frame);

function loadImage(src) {
  const image = new Image();
  image.src = src;
  return image;
}

function resetGame() {
  state.round = 1;
  state.p1Coins = 0;
  state.p2Coins = 0;
  state.winnerText = "";
  state.phase = phases.START;
  state.message = "开始游戏";
  state.revealText = "";
  state.fish = null;
  state.catchPlayer = 0;
  state.earlyPressed = { 1: false, 2: false };
  state.roundDoneAt = 0;
  state.readyUntil = 0;
}

function startRound() {
  const now = performance.now();
  state.phase = phases.WAITING;
  state.phaseUntil = now + randomBetween(3000, 12000);
  state.roundStartedAt = now;
  state.message = "等待鱼儿上钩...";
  state.revealText = "";
  state.fish = null;
  state.catchPlayer = 0;
  state.earlyPressed = { 1: false, 2: false };
  state.roundDoneAt = 0;
  state.flashAt = 0;
  state.fishJumpAt = 0;
  state.fishSeenAt = 0;
  state.readyUntil = 0;
}

function frame(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;
  update(now, dt);
  draw(now);
  requestAnimationFrame(frame);
}

function update(now, dt) {
  waterTick += dt;

  if (state.phase === phases.WAITING && now >= state.phaseUntil) {
    state.phase = phases.READY;
    state.fish = rollFish();
    state.fishSeenAt = now;
    state.readyUntil = now + 4000;
    state.message = "现在按！";
    state.flashAt = now;
  }

  if (state.phase === phases.READY && now >= state.readyUntil) {
    state.phase = phases.REVEAL;
    state.message = "鱼跑掉了！";
    state.revealText = "本轮无人得分";
    state.fishJumpAt = now;
    state.roundDoneAt = now + 1300;
  }

  if (state.phase === phases.REVEAL && now >= state.roundDoneAt) {
    if (state.round >= totalRounds) {
      finishGame();
    } else {
      state.round += 1;
      startRound();
    }
  }
}

function finishGame() {
  state.phase = phases.END;
  if (state.p1Coins > state.p2Coins) state.winnerText = "P1 获胜！";
  else if (state.p2Coins > state.p1Coins) state.winnerText = "P2 获胜！";
  else state.winnerText = "平局！";
  state.message = "比赛结束";
}

function pressPlayer(player) {
  const now = performance.now();

  if (state.phase === phases.START || state.phase === phases.END || state.phase === phases.REVEAL) return;

  if (state.phase === phases.READY) {
    catchFish(player, now);
    return;
  }

  if (state.phase === phases.WAITING) {
    if (now - state.roundStartedAt <= 500) {
      state.flashAt = now;
      state.message = "刚开局，误触不扣分";
      return;
    }

    if (state.earlyPressed[player]) return;
    if (player === 1) state.p1Coins -= 1;
    else state.p2Coins -= 1;
    state.earlyPressed[player] = true;
    state.flashAt = now;
    state.message = `P${player} 抢早了，-1 金币！`;
  }
}

function catchFish(player, now) {
  state.phase = phases.REVEAL;
  state.catchPlayer = player;
  state.fishJumpAt = now;

  if (state.fish.stink) {
    if (player === 1) state.p1Coins = Math.floor(state.p1Coins / 2);
    else state.p2Coins = Math.floor(state.p2Coins / 2);
    state.revealText = `P${player} 抢到臭鱼！金币减半`;
  } else {
    if (player === 1) state.p1Coins += state.fish.value;
    else state.p2Coins += state.fish.value;
    state.revealText = `P${player} 抢到${state.fish.name}！+${state.fish.value} 金币`;
  }

  state.message = "鱼跳出来了！";
  state.roundDoneAt = now + 2100;
}

function rollFish() {
  let roll = Math.random();
  for (const fish of fishTable) {
    roll -= fish.chance;
    if (roll <= 0) return fish;
  }
  return fishTable[0];
}

function draw(now) {
  drawBackground();
  drawPond(now);
  drawPlayers(now);
  drawHud();
  drawPrompt(now);
  drawButtons();
  drawReveal(now);
  if (state.phase === phases.END) drawEndScreen();
}

function drawBackground() {
  const grd = ctx.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, "#fff8ec");
  grd.addColorStop(0.66, "#fff3d9");
  grd.addColorStop(1, "#e9f7c6");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(255,255,255,0.58)";
  cloud(175, 110, 1);
  cloud(1040, 120, 0.9);
}

function drawHud() {
  drawGlassPanel(38, 18, W - 76, 74, 22, "rgba(255,255,255,0.9)");

  drawScoreBadge(62, 31, 250, 48, "#2d89df", "P1", state.p1Coins, "left");
  drawScoreBadge(W - 312, 31, 250, 48, "#e65353", "P2", state.p2Coins, "right");

  const roundText = `第 ${state.round} / ${totalRounds} 轮`;
  ctx.save();
  ctx.fillStyle = "#f5fbff";
  ctx.strokeStyle = "rgba(44, 58, 72, 0.12)";
  ctx.lineWidth = 2;
  roundRect(W / 2 - 122, 28, 244, 54, 18);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#243143";
  ctx.font = "900 28px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(roundText, W / 2, 56);
  ctx.restore();
}

function drawScoreBadge(x, y, w, h, color, player, coins, align) {
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, color);
  grad.addColorStop(1, lighten(color, 0.22));

  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  roundRect(x, y, w, h, 16);
  ctx.fill();

  ctx.fillStyle = grad;
  roundRect(x + 5, y + 5, w - 10, h - 10, 13);
  ctx.fill();

  ctx.fillStyle = "white";
  ctx.font = "900 25px Arial";
  ctx.textBaseline = "middle";
  ctx.textAlign = align;
  const textX = align === "left" ? x + 22 : x + w - 22;
  ctx.fillText(`${player}  ${coins} 金币`, textX, y + h / 2 + 1);
  ctx.restore();
}

function drawPond(now) {
  if (assets.pond.complete && assets.pond.naturalWidth) {
    drawImageContain(assets.pond, 74, 235, 1132, 390);
  } else {
    drawFallbackPond();
  }

  drawWaterShine();

  if (state.phase === phases.READY) {
    drawBubbles(now);
  }

  if (state.phase === phases.READY && state.fish) {
    const rise = Math.min(1, (now - state.fishSeenAt) / 520);
    const bob = Math.sin(now / 150) * 5;
    drawFish(W / 2, 500 - rise * 68 + bob, state.fish, 0.72);
  }
}

function drawPlayers(now) {
  const p1Lift = state.catchPlayer === 1 && state.phase === phases.REVEAL ? Math.sin(Math.min(1, (now - state.fishJumpAt) / 350) * Math.PI) * 14 : 0;
  const p2Lift = state.catchPlayer === 2 && state.phase === phases.REVEAL ? Math.sin(Math.min(1, (now - state.fishJumpAt) / 350) * Math.PI) * 14 : 0;

  drawFisherSprite(assets.blueFisher, 18, 135 - p1Lift, 420, 420);
  drawFisherSprite(assets.redFisher, W - 438, 135 - p2Lift, 420, 420);

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "900 28px Arial";
  ctx.textAlign = "center";
  ctx.fillText("P1", 203, 563);
  ctx.fillText("P2", W - 203, 563);
}

function drawFisherSprite(image, x, y, w, h) {
  if (image.complete && image.naturalWidth) {
    drawImageContain(image, x, y, w, h);
    return;
  }

  ctx.fillStyle = image === assets.blueFisher ? "#3b9cff" : "#ff6868";
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2 - 42, 42, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x + w / 2 - 40, y + h / 2, 80, 90);
}

function drawWaterShine() {
  ctx.strokeStyle = "rgba(255,255,255,0.62)";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  for (let i = 0; i < 5; i++) {
    const y = 460 + i * 24;
    const wave = Math.sin(waterTick * 3 + i) * 12;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 190, y);
    ctx.bezierCurveTo(W / 2 - 95, y + wave, W / 2 + 95, y - wave, W / 2 + 190, y);
    ctx.stroke();
  }
}

function drawFallbackPond() {
  ctx.fillStyle = "#9dcf63";
  ctx.beginPath();
  ctx.ellipse(W / 2, 515, 470, 150, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#70c9ff";
  ctx.beginPath();
  ctx.ellipse(W / 2, 500, 410, 115, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawImageContain(image, x, y, w, h) {
  const scale = Math.min(w / image.naturalWidth, h / image.naturalHeight);
  const dw = image.naturalWidth * scale;
  const dh = image.naturalHeight * scale;
  ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function drawImageCover(image, x, y, w, h) {
  const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (image.naturalWidth - sw) / 2;
  const sy = (image.naturalHeight - sh) / 2;
  ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
}

function drawBubbles(now) {
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = 3;
  for (let i = 0; i < 8; i++) {
    const t = (now / 360 + i * 0.17) % 1;
    const x = W / 2 + Math.sin(i * 2.4) * 85 + Math.sin(now / 260 + i) * 12;
    const y = 515 - t * 90;
    ctx.beginPath();
    ctx.arc(x, y, 6 + (i % 3), 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawPrompt(now) {
  const pulse = Math.max(0, 1 - (now - state.flashAt) / 520);
  const scale = state.phase === phases.READY ? 1 + Math.sin(now / 80) * 0.04 + pulse * 0.18 : 1 + pulse * 0.05;
  const isStart = state.phase === phases.START;
  const panelW = isStart ? 410 : 560;
  const panelH = isStart ? 78 : 82;
  const y = isStart ? 140 : 136;

  ctx.save();
  ctx.translate(W / 2, y);
  ctx.scale(scale, scale);
  ctx.shadowColor = "rgba(25, 39, 54, 0.18)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 7;

  const grad = ctx.createLinearGradient(-panelW / 2, -panelH / 2, panelW / 2, panelH / 2);
  if (state.phase === phases.READY) {
    grad.addColorStop(0, "#fff36b");
    grad.addColorStop(1, "#ffb347");
  } else if (isStart) {
    grad.addColorStop(0, "#37b9d4");
    grad.addColorStop(1, "#228bdc");
  } else {
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(1, "#f5fbff");
  }

  ctx.fillStyle = grad;
  roundRect(-panelW / 2, -panelH / 2, panelW, panelH, isStart ? 28 : 24);
  ctx.fill();

  ctx.shadowColor = "transparent";
  ctx.strokeStyle = state.phase === phases.READY ? "rgba(179, 91, 21, 0.5)" : isStart ? "rgba(20, 112, 157, 0.45)" : "rgba(51,80,96,0.14)";
  ctx.lineWidth = isStart ? 4 : 3;
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.25)";
  roundRect(-panelW / 2 + 14, -panelH / 2 + 10, panelW - 28, 17, 9);
  ctx.fill();

  ctx.fillStyle = isStart || state.phase === phases.READY ? "white" : "#263544";
  ctx.font = isStart ? "900 38px Arial" : "900 40px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(state.message, 0, isStart ? 4 : 3);
  ctx.restore();
}

function drawButtons() {
  drawButton(48, H - 138, 420, 102, "#3198ef", "P1 按钮", "Space / 点击左侧", state.earlyPressed[1]);
  drawButton(W - 468, H - 138, 420, 102, "#f45d59", "P2 按钮", "Enter / 点击右侧", state.earlyPressed[2]);
}

function drawButton(x, y, w, h, color, title, sub, earlyPressed) {
  ctx.save();
  ctx.shadowColor = "rgba(25, 39, 54, 0.16)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 6;

  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, lighten(color, 0.08));
  grad.addColorStop(1, color);
  ctx.fillStyle = grad;
  roundRect(x, y, w, h, 24);
  ctx.fill();
  ctx.shadowColor = "transparent";

  ctx.fillStyle = "white";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = "900 32px Arial";
  ctx.fillText(earlyPressed ? "已早按 -1" : title, x + w / 2, y + 50);
  ctx.font = "700 20px Arial";
  ctx.fillText(sub, x + w / 2, y + 78);
  ctx.restore();
}

function drawReveal(now) {
  if (state.phase !== phases.REVEAL || !state.fish) {
    if (state.phase === phases.REVEAL) drawResultText();
    return;
  }

  const t = Math.min(1, (now - state.fishJumpAt) / 900);
  const y = 500 - Math.sin(t * Math.PI) * 150;
  drawFish(W / 2, y, state.fish, 1 + Math.sin(t * Math.PI) * 0.25);
  drawResultText();
}

function drawResultText() {
  drawGlassPanel(W / 2 - 260, 205, 520, 76, 20, "rgba(255,255,255,0.94)");
  ctx.fillStyle = "#263544";
  ctx.font = "800 30px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(state.revealText, W / 2, 243);
}

function drawFish(x, y, fish, scale) {
  const sprite = assets[fish.sprite];
  if (sprite?.complete && sprite.naturalWidth) {
    ctx.save();
    ctx.translate(x, y);
    const size = 190 * scale;
    drawImageContain(sprite, -size / 2, -size / 2, size, size);
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = fish.color;
  ctx.beginPath();
  ctx.ellipse(0, 0, 74, 42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-65, 0);
  ctx.lineTo(-112, -36);
  ctx.lineTo(-105, 0);
  ctx.lineTo(-112, 36);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(28, -12, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#222";
  ctx.beginPath();
  ctx.arc(32, -12, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#243143";
  ctx.font = "800 22px Arial";
  ctx.textAlign = "center";
  ctx.fillText(fish.face, 8, 18);

  if (fish.stink) {
    ctx.strokeStyle = "rgba(71, 104, 35, 0.7)";
    ctx.lineWidth = 5;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(72 + i * 20, 28);
      ctx.bezierCurveTo(92 + i * 20, 5, 70 + i * 20, -12, 90 + i * 20, -34);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawEndScreen() {
  ctx.fillStyle = "rgba(23, 37, 48, 0.68)";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#fff8d7";
  roundRect(W / 2 - 300, 190, 600, 300, 28);
  ctx.fill();

  ctx.fillStyle = "#263544";
  ctx.font = "900 56px Arial";
  ctx.textAlign = "center";
  ctx.fillText(state.winnerText, W / 2, 280);
  ctx.font = "800 30px Arial";
  ctx.fillText(`P1 ${state.p1Coins} 金币   P2 ${state.p2Coins} 金币`, W / 2, 340);

  ctx.fillStyle = "#38b6cf";
  roundRect(W / 2 - 170, 382, 340, 74, 20);
  ctx.fill();
  ctx.fillStyle = "white";
  ctx.font = "900 32px Arial";
  ctx.fillText("再来一局", W / 2, 430);
}

function cloud(x, y, s) {
  ctx.beginPath();
  ctx.arc(x, y, 30 * s, 0, Math.PI * 2);
  ctx.arc(x + 35 * s, y - 18 * s, 38 * s, 0, Math.PI * 2);
  ctx.arc(x + 78 * s, y, 31 * s, 0, Math.PI * 2);
  ctx.arc(x + 38 * s, y + 12 * s, 40 * s, 0, Math.PI * 2);
  ctx.fill();
}

function drawGlassPanel(x, y, w, h, r, fill) {
  ctx.save();
  ctx.shadowColor = "rgba(25, 39, 54, 0.1)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = fill;
  roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "rgba(36, 49, 67, 0.1)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function lighten(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) + Math.round(255 * amount));
  const g = Math.min(255, ((n >> 8) & 255) + Math.round(255 * amount));
  const b = Math.min(255, (n & 255) + Math.round(255 * amount));
  return `rgb(${r}, ${g}, ${b})`;
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function pointerToCanvas(event) {
  const rect = canvas.getBoundingClientRect();
  const touch = event.changedTouches ? event.changedTouches[0] : event;
  return {
    x: ((touch.clientX - rect.left) / rect.width) * W,
    y: ((touch.clientY - rect.top) / rect.height) * H,
  };
}

function handlePointer(event) {
  event.preventDefault();
  const point = pointerToCanvas(event);

  if (state.phase === phases.START) {
    if (point.x > W / 2 - 215 && point.x < W / 2 + 215 && point.y > 98 && point.y < 182) {
      startRound();
    }
    return;
  }

  if (state.phase === phases.END) {
    if (point.x > W / 2 - 190 && point.x < W / 2 + 190 && point.y > 360 && point.y < 475) {
      resetGame();
    }
    return;
  }

  if (point.x < W / 2) pressPlayer(1);
  else pressPlayer(2);
}

canvas.addEventListener("pointerdown", handlePointer);
canvas.addEventListener("touchstart", handlePointer, { passive: false });

window.addEventListener("keydown", (event) => {
  if (event.repeat) return;
  const isP1Key = event.code === "Space" || event.key === " ";
  const isP2Key = event.code === "Enter" || event.code === "NumpadEnter" || event.key === "Enter";

  if (isP1Key) {
    event.preventDefault();
    if (state.phase === phases.START) startRound();
    else if (state.phase === phases.END) resetGame();
    else pressPlayer(1);
  }

  if (isP2Key) {
    event.preventDefault();
    if (state.phase === phases.START) startRound();
    else if (state.phase === phases.END) resetGame();
    else pressPlayer(2);
  }
});
