let currentGame = null;

async function loadGamesList() {
  const games = await fetch('/api/games').then((r) => r.json());
  const list = document.getElementById('games-list');
  list.innerHTML = games.map((g) => `<button class="game-item" data-id="${g.id}">${g.name}</button>`).join('');
  list.querySelectorAll('.game-item').forEach((btn) => {
    btn.addEventListener('click', () => openGame(btn.dataset.id));
  });
}
loadGamesList();

document.getElementById('create-game-btn').addEventListener('click', async () => {
  const name = document.getElementById('new-game-name').value.trim();
  const categoryCount = Number(document.getElementById('new-game-categories').value);
  const questionCount = Number(document.getElementById('new-game-questions').value);
  if (!name || !categoryCount || !questionCount) return;
  const game = await fetch('/api/games', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, categoryCount, questionCount })
  }).then((r) => r.json());
  await loadGamesList();
  openGame(game.id);
});

async function openGame(id) {
  currentGame = await fetch(`/api/games/${id}`).then((r) => r.json());
  renderGrid();
}

function renderGrid() {
  const root = document.getElementById('editor-grid');
  if (!currentGame) { root.innerHTML = ''; return; }
  let html = '<div class="grid">';
  currentGame.categories.forEach((category, cIdx) => {
    html += `<div class="column"><input class="category-name" data-c="${cIdx}" value="${category.name}" />`;
    category.questions.forEach((q, qIdx) => {
      html += `<button class="cell" data-c="${cIdx}" data-q="${qIdx}">${q.value}</button>`;
    });
    html += '</div>';
  });
  html += '</div>';
  root.innerHTML = html;

  root.querySelectorAll('.category-name').forEach((input) => {
    input.addEventListener('change', () => {
      currentGame.categories[Number(input.dataset.c)].name = input.value;
      saveGame();
    });
  });
  root.querySelectorAll('.cell').forEach((btn) => {
    btn.addEventListener('click', () => openQuestionEditor(Number(btn.dataset.c), Number(btn.dataset.q)));
  });
}

function openQuestionEditor(cIdx, qIdx) {
  const question = currentGame.categories[cIdx].questions[qIdx];
  const modal = document.getElementById('question-modal');
  modal.style.display = 'block';
  modal.innerHTML = `
    <textarea id="q-text" placeholder="Question">${question.question}</textarea>
    <textarea id="a-text" placeholder="Answer">${question.answer}</textarea>
    <input type="file" id="q-image" accept="image/*" />
    ${question.image ? `<img src="/games/${currentGame.id}/${question.image}" width="200" />` : ''}
    <button id="save-question-btn">Save</button>
    <button id="close-modal-btn">Close</button>
  `;

  document.getElementById('save-question-btn').addEventListener('click', async () => {
    question.question = document.getElementById('q-text').value;
    question.answer = document.getElementById('a-text').value;

    const fileInput = document.getElementById('q-image');
    if (fileInput.files[0]) {
      const formData = new FormData();
      formData.append('image', fileInput.files[0]);
      const result = await fetch(`/api/games/${currentGame.id}/images`, {
        method: 'POST', body: formData
      }).then((r) => r.json());
      question.image = result.path;
    }

    await saveGame();
    modal.style.display = 'none';
    renderGrid();
  });

  document.getElementById('close-modal-btn').addEventListener('click', () => {
    modal.style.display = 'none';
  });
}

async function saveGame() {
  await fetch(`/api/games/${currentGame.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(currentGame)
  });
}
