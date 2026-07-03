let timerInterval;

const client = createWsClient({
  role: 'board',
  onState: (state) => render(state)
});

function render(state) {
  const root = document.getElementById('root');
  if (!state.game) {
    root.innerHTML = '<h1 style="text-align:center;padding-top:20vh;">Waiting for host to load a game...</h1>';
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
    startTimerTick(state.currentQuestion.questionStartedAt);
  } else {
    clearInterval(timerInterval);
  }
}

function renderIntro(state) {
  const category = state.game.categories[state.introCategoryIdx];
  return `<div class="intro">${category.name}</div>`;
}

function renderGrid(state) {
  let html = '<div class="grid">';
  state.game.categories.forEach((category, cIdx) => {
    html += `<div class="column"><div class="header">${category.name}</div>`;
    category.questions.forEach((q, qIdx) => {
      const answered = state.board[cIdx][qIdx] === 'answered';
      html += `<div class="cell ${answered ? 'answered' : ''}">${answered ? '' : q.value}</div>`;
    });
    html += '</div>';
  });
  html += '</div>';
  return html;
}

function renderQuestion(state) {
  const { categoryIdx, questionIdx } = state.currentQuestion;
  const question = state.game.categories[categoryIdx].questions[questionIdx];
  const winnerTeam = state.teams.find((t) => t.id === state.buzzWinner);

  let html = '<div class="question">';
  html += `<div class="text">${question.question}</div>`;
  if (question.image) html += `<img src="/games/${state.gameId}/${question.image}" style="max-width:50vw;" />`;
  if (state.phase === 'answer' && question.answer) {
    html += `<div class="answer">${question.answer}</div>`;
  }
  if (winnerTeam) html += `<div class="winner">${winnerTeam.name}</div>`;
  html += `<div class="timer" id="timer">0s</div>`;
  html += '</div>';
  return html;
}

function startTimerTick(startedAt) {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const el = document.getElementById('timer');
    if (!el) { clearInterval(timerInterval); return; }
    const seconds = Math.floor((Date.now() - startedAt) / 1000);
    el.textContent = `${seconds}s`;
    el.classList.toggle('late', seconds > 15);
  }, 250);
}

function renderScores(state) {
  return `<div class="scores">${state.teams.map((t) => `<span>${t.name}: ${t.score}</span>`).join('')}</div>`;
}
