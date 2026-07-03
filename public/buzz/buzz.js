let myTeamId = null;
let currentState = null;

const client = createWsClient({
  role: 'player',
  onState: (state) => { currentState = state; render(state); },
  onBuzzRejected: (reason) => showFeedback(reason)
});

function render(state) {
  if (!myTeamId) {
    renderTeamPicker(state);
  } else {
    renderBuzzer(state);
  }
}

function renderTeamPicker(state) {
  const root = document.getElementById('root');
  if (!state.teams.length) {
    root.innerHTML = '<p>Waiting for host to set up teams...</p>';
    return;
  }
  root.innerHTML = `
    <h1>Pick your team</h1>
    <input type="text" id="player-name" placeholder="Your name" />
    ${state.teams.map((t) => `<button class="team-pick" data-team="${t.id}">${t.name}</button>`).join('')}
  `;
  root.querySelectorAll('.team-pick').forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = document.getElementById('player-name').value.trim();
      if (!name) return;
      myTeamId = btn.dataset.team;
      client.send('join_team', { teamId: myTeamId, name });
      render(currentState);
    });
  });
}

function renderBuzzer(state) {
  const root = document.getElementById('root');
  const team = state.teams.find((t) => t.id === myTeamId);
  root.innerHTML = `
    <div class="score">${team ? team.name : ''}: ${team ? team.score : 0}</div>
    <button id="buzz-btn" class="buzz-button">BUZZ</button>
    <div id="feedback"></div>
  `;
  document.getElementById('buzz-btn').addEventListener('click', () => {
    client.send('buzz', { teamId: myTeamId });
  });
}

function showFeedback(reason) {
  const el = document.getElementById('feedback');
  if (!el) return;
  el.textContent = reason === 'too_late' ? 'Too late!' : 'Already tried!';
  setTimeout(() => { if (el) el.textContent = ''; }, 1000);
}

document.addEventListener('ws-disconnected', () => {
  document.getElementById('disconnect-banner').style.display = 'block';
});
document.addEventListener('ws-connected', () => {
  document.getElementById('disconnect-banner').style.display = 'none';
});
