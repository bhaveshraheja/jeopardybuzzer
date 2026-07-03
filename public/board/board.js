let timerInterval;
let frozenElapsed = {};

const client = createWsClient({
  role: 'board',
  onState: (state) => render(state)
});

function render(state) {
  const root = document.getElementById('root');
  if (!state.game) {
    root.innerHTML = '<div class="waiting">Waiting for host to load a game...</div>';
    return;
  }

  let bodyHtml;
  if (state.phase === 'intro') {
    bodyHtml = renderIntro(state);
  } else if (state.phase === 'question' || state.phase === 'answer') {
    bodyHtml = renderQuestion(state);
  } else {
    bodyHtml = renderGrid(state);
  }

  root.innerHTML = bodyHtml + renderScores(state);

  if (state.phase === 'question' || state.phase === 'answer') {
    const shouldFreeze = Boolean(state.buzzWinner) || state.phase === 'answer';
    renderTimerFor(state.currentQuestion.questionStartedAt, shouldFreeze);
  } else {
    clearInterval(timerInterval);
  }
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
  if (winnerTeam) html += `<div class="winner">${winnerTeam.name}</div>`;
  html += '</div>';
  return html;
}

function setTimerDisplay(el, seconds) {
  el.textContent = `${seconds}s`;
  el.classList.toggle('late', seconds > 15);
}

function renderTimerFor(startedAt, shouldFreeze) {
  clearInterval(timerInterval);
  const el = document.getElementById('timer');
  if (!el) return;

  if (shouldFreeze) {
    if (frozenElapsed[startedAt] === undefined) {
      frozenElapsed[startedAt] = Math.floor((Date.now() - startedAt) / 1000);
    }
    setTimerDisplay(el, frozenElapsed[startedAt]);
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
