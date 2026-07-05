let timerInterval;
let frozenElapsed = {};
let wifiInfo = null;
let buzzUrl = null;

fetch('/api/wifi').then((r) => r.json()).then((data) => { wifiInfo = data; });
fetch('/api/server-info').then((r) => r.json()).then((data) => { buzzUrl = data.buzzUrl; });

const client = createWsClient({
  role: 'board',
  onState: (state) => render(state)
});

function render(state) {
  const root = document.getElementById('root');

  if (state.showQr) {
    root.innerHTML = renderQrScreen();
    clearInterval(timerInterval);
    return;
  }

  if (!state.game) {
    root.innerHTML = '<div class="waiting">Waiting for host to load a game...</div>';
    return;
  }

  let bodyHtml;
  if (state.phase === 'intro') {
    bodyHtml = renderIntro(state);
  } else if ((state.phase === 'question' || state.phase === 'answer') && state.currentQuestion) {
    bodyHtml = renderQuestion(state);
  } else {
    bodyHtml = renderGrid(state);
  }

  root.innerHTML = bodyHtml + renderScores(state);

  if ((state.phase === 'question' || state.phase === 'answer') && state.currentQuestion) {
    const shouldFreeze = Boolean(state.buzzWinner) || state.phase === 'answer';
    const freezeKey = `${state.currentQuestion.questionStartedAt}:${state.buzzWinner || 'none'}`;
    renderTimerFor(state.currentQuestion.questionStartedAt, shouldFreeze, freezeKey);
  } else {
    clearInterval(timerInterval);
  }
}

function escapeWifiField(value) {
  return String(value).replace(/([\\;,:"])/g, '\\$1');
}

function renderQrScreen() {
  const wifiQrUrl = wifiInfo
    ? `/api/qrcode?data=${encodeURIComponent(`WIFI:T:WPA;S:${escapeWifiField(wifiInfo.ssid)};P:${escapeWifiField(wifiInfo.password)};;`)}`
    : null;
  const buzzQrUrl = buzzUrl ? `/api/qrcode?data=${encodeURIComponent(buzzUrl)}` : null;

  return `
    <div class="qr-screen">
      <div class="qr-step">
        <div class="qr-step-label">Step 1 — Join WiFi</div>
        ${wifiQrUrl ? `<img class="qr-image" src="${wifiQrUrl}" />` : '<p>WiFi not configured</p>'}
        ${wifiInfo ? `<div class="qr-text">Network: <strong>${wifiInfo.ssid}</strong><br />Password: <strong>${wifiInfo.password}</strong></div>` : ''}
      </div>
      <div class="qr-step">
        <div class="qr-step-label">Step 2 — Join the Game</div>
        ${buzzQrUrl ? `<img class="qr-image" src="${buzzQrUrl}" />` : '<p>Loading...</p>'}
        ${buzzUrl ? `<div class="qr-text">${buzzUrl}</div>` : ''}
      </div>
    </div>
  `;
}

function renderIntro(state) {
  const category = state.game.categories[state.introCategoryIdx];
  return `<div class="intro">${category.name}</div>`;
}

function renderGrid(state) {
  const numCols = state.game.categories.length;
  const numRows = state.game.categories[0].questions.length;
  let html = `<div class="grid" style="grid-template-columns: repeat(${numCols}, 1fr); grid-template-rows: auto repeat(${numRows}, 1fr);">`;
  state.game.categories.forEach((category, cIdx) => {
    html += `<div class="header" style="grid-column:${cIdx + 1}; grid-row:1;">${category.name}</div>`;
  });
  state.game.categories.forEach((category, cIdx) => {
    category.questions.forEach((q, qIdx) => {
      const answered = state.board[cIdx][qIdx] === 'answered';
      html += `<div class="cell ${answered ? 'answered' : ''}" style="grid-column:${cIdx + 1}; grid-row:${qIdx + 2};">${answered ? '' : q.value}</div>`;
    });
  });
  html += '</div>';
  return html;
}

function renderQuestion(state) {
  const { categoryIdx, questionIdx } = state.currentQuestion;
  const category = state.game.categories[categoryIdx];
  const question = category.questions[questionIdx];
  const winnerTeam = state.teams.find((t) => t.id === state.buzzWinner);

  let html = '<div class="view">';
  html += `<div class="question-meta"><span class="meta-category">${category.name}</span><span class="meta-value">${question.value}</span></div>`;
  html += `<div class="timer-corner" id="timer">0s</div>`;
  html += `<div class="text">${question.question}</div>`;
  if (question.image) html += `<img src="/games/${state.gameId}/${question.image}" />`;
  if (state.phase === 'answer' && question.answer) {
    html += `<div class="answer">${question.answer}</div>`;
  }
  if (state.phase === 'answer' && question.answerImage) {
    html += `<img src="/games/${state.gameId}/${question.answerImage}" />`;
  }
  if (winnerTeam) html += `<div class="winner">${winnerTeam.name}</div>`;
  html += '</div>';
  return html;
}

function setTimerDisplay(el, seconds) {
  el.textContent = `${seconds}s`;
  el.classList.toggle('late', seconds > 15);
}

function renderTimerFor(startedAt, shouldFreeze, freezeKey) {
  clearInterval(timerInterval);
  const el = document.getElementById('timer');
  if (!el) return;

  if (shouldFreeze) {
    if (frozenElapsed[freezeKey] === undefined) {
      frozenElapsed[freezeKey] = Math.floor((Date.now() - startedAt) / 1000);
    }
    setTimerDisplay(el, frozenElapsed[freezeKey]);
    return;
  }

  setTimerDisplay(el, Math.floor((Date.now() - startedAt) / 1000));
  timerInterval = setInterval(() => {
    const liveEl = document.getElementById('timer');
    if (!liveEl) { clearInterval(timerInterval); return; }
    setTimerDisplay(liveEl, Math.floor((Date.now() - startedAt) / 1000));
  }, 250);
}

function renderScores(state) {
  return `<div class="scores">${state.teams.map((t) => `<span>${t.name}: ${t.score}</span>`).join('')}</div>`;
}
