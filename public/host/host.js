let bulbs = [];
let currentState = null;
let uiMode = 'setup';
let selectedGameId = null;
let seenFirstState = false;

const client = createWsClient({
  role: 'host',
  onState: (state) => {
    currentState = state;
    if (!seenFirstState) {
      seenFirstState = true;
      if (state.game && state.teams.length) {
        uiMode = 'play';
        selectedGameId = state.gameId;
      }
    }
    render(state);
  }
});

const addTeamBtn = document.getElementById('add-team-btn');
addTeamBtn.disabled = true;

fetch('/api/bulbs').then((r) => r.json()).then((data) => {
  bulbs = data;
  addTeamBtn.disabled = false;
});

async function loadGamesList() {
  const games = await fetch('/api/games').then((r) => r.json());
  const list = document.getElementById('games-list');
  list.innerHTML = games.map((g) => `<button class="game-card" data-id="${g.id}">${g.name}</button>`).join('');
  list.querySelectorAll('.game-card').forEach((btn) => {
    btn.addEventListener('click', () => selectGame(btn.dataset.id));
  });
  highlightSelectedGame();
}
loadGamesList();

function highlightSelectedGame() {
  document.querySelectorAll('.game-card').forEach((btn) => {
    btn.classList.toggle('selected', btn.dataset.id === selectedGameId);
  });
}

function selectGame(gameId) {
  selectedGameId = gameId;
  client.send('load_game', { gameId });
  document.getElementById('team-setup-block').style.display = 'block';
  highlightSelectedGame();
}

document.getElementById('add-team-btn').addEventListener('click', () => addTeamRow());

function addTeamRow(prefillName, prefillBulbId) {
  const container = document.getElementById('teams-setup');
  const row = document.createElement('div');
  row.className = 'team-row';
  row.innerHTML = `
    <input type="text" class="team-name" placeholder="Team name" value="${prefillName || ''}" />
    <select class="team-bulb">${bulbs.map((b) => `<option value="${b.id}" ${b.id === prefillBulbId ? 'selected' : ''}>${b.id}</option>`).join('')}</select>
    <button type="button" class="test-bulb-btn">Test Bulb</button>
  `;
  row.querySelector('.test-bulb-btn').addEventListener('click', () => {
    client.send('test_bulb', { bulbId: row.querySelector('.team-bulb').value });
  });
  container.appendChild(row);
}

document.getElementById('start-game-btn').addEventListener('click', () => {
  const rows = document.querySelectorAll('.team-row');
  const teams = Array.from(rows)
    .map((row) => ({
      name: row.querySelector('.team-name').value,
      bulbId: row.querySelector('.team-bulb').value
    }))
    .filter((t) => t.name);
  if (teams.length) {
    client.send('setup_teams', { teams });
  }
  uiMode = 'play';
  render(currentState);
});

document.getElementById('settings-btn').addEventListener('click', () => {
  uiMode = 'setup';
  const container = document.getElementById('teams-setup');
  container.innerHTML = '';
  if (currentState && currentState.teams.length) {
    currentState.teams.forEach((t) => addTeamRow(t.name, t.bulbId));
    document.getElementById('team-setup-block').style.display = 'block';
  }
  if (currentState && currentState.gameId) {
    selectedGameId = currentState.gameId;
  }
  highlightSelectedGame();
  render(currentState);
});

document.getElementById('start-intro-btn').addEventListener('click', () => client.send('start_intro'));
document.getElementById('next-category-btn').addEventListener('click', () => client.send('next_category'));
document.getElementById('end-intro-btn').addEventListener('click', () => client.send('end_intro'));
document.getElementById('reset-buzzer-btn').addEventListener('click', () => client.send('reset_buzzer'));
document.getElementById('close-question-btn').addEventListener('click', () => client.send('close_question'));
document.getElementById('reveal-answer-btn').addEventListener('click', () => client.send('reveal_answer'));

function render(state) {
  document.getElementById('setup-overlay').style.display = uiMode === 'setup' ? 'flex' : 'none';
  document.querySelector('.layout').style.display = uiMode === 'play' ? 'flex' : 'none';
  if (!state) return;
  renderBoardGrid(state);
  renderQuestionPanel(state);
  renderTeamScores(state);
}

function renderBoardGrid(state) {
  const root = document.getElementById('board-grid');
  if (!state.game) { root.innerHTML = ''; return; }
  let html = '';
  state.game.categories.forEach((category, cIdx) => {
    html += `<div class="column"><div class="header">${category.name}</div>`;
    category.questions.forEach((q, qIdx) => {
      const answered = state.board[cIdx][qIdx] === 'answered';
      html += `<button class="cell" data-c="${cIdx}" data-q="${qIdx}" ${answered ? 'disabled' : ''}>${q.value}</button>`;
    });
    html += '</div>';
  });
  root.innerHTML = html;
  root.querySelectorAll('.cell:not(:disabled)').forEach((btn) => {
    btn.addEventListener('click', () => {
      client.send('select_question', { categoryIdx: Number(btn.dataset.c), questionIdx: Number(btn.dataset.q) });
    });
  });
}

let timerInterval;
function renderQuestionPanel(state) {
  const root = document.getElementById('question-panel');
  if (!state.currentQuestion) {
    root.innerHTML = '<p style="color:#8a8da8;">No question selected — click a cell on the board.</p>';
    clearInterval(timerInterval);
    return;
  }
  const { categoryIdx, questionIdx, questionStartedAt } = state.currentQuestion;
  const question = state.game.categories[categoryIdx].questions[questionIdx];

  root.innerHTML = `
    ${state.phase === 'answer' ? '<div class="status-badge">Answer Revealed</div>' : ''}
    <div class="q-text">${question.question}</div>
    <div class="a-text">Answer: ${question.answer}</div>
    <div class="timer" id="host-timer">0s</div>
    <div class="buzz-winner">${state.buzzWinner ? teamName(state, state.buzzWinner) : 'No buzz yet'}</div>
    <div class="team-buttons">
      ${state.teams.map((t) => `
        <span>
          <span class="team-name">${t.name}</span>
          <button class="correct-btn" data-team="${t.id}" ${state.buzzWinner === t.id ? '' : 'disabled'}>Correct</button>
          <button class="wrong-btn" data-team="${t.id}" ${state.buzzWinner === t.id ? '' : 'disabled'}>Wrong</button>
        </span>`).join('')}
    </div>
  `;

  root.querySelectorAll('.correct-btn').forEach((btn) =>
    btn.addEventListener('click', () => client.send('mark_correct', { teamId: btn.dataset.team })));
  root.querySelectorAll('.wrong-btn').forEach((btn) =>
    btn.addEventListener('click', () => client.send('mark_wrong', { teamId: btn.dataset.team })));

  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const el = document.getElementById('host-timer');
    if (!el) { clearInterval(timerInterval); return; }
    const seconds = Math.floor((Date.now() - questionStartedAt) / 1000);
    el.textContent = `${seconds}s`;
    el.classList.toggle('late', seconds > 15);
  }, 250);
}

function teamName(state, teamId) {
  const team = state.teams.find((t) => t.id === teamId);
  return team ? team.name : teamId;
}

function renderTeamScores(state) {
  const root = document.getElementById('team-scores');
  root.innerHTML = state.teams.map((t) => `<div>${t.name}: ${t.score}</div>`).join('');
}
