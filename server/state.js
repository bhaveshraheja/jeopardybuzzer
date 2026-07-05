const wiz = require('./wiz');
const sound = require('./sound');
const { readGame } = require('./gameStore');

let bulbs = [];

function loadBulbs(bulbList) {
  bulbs = bulbList;
}

function getBulb(bulbId) {
  return bulbs.find((b) => b.id === bulbId);
}

function createEmptyState() {
  return {
    gameId: null,
    game: null,
    teams: [],
    board: [],
    phase: 'board',
    introCategoryIdx: 0,
    currentQuestion: null,
    buzzWinner: null,
    answeredBy: [],
    showQr: false
  };
}

let state = createEmptyState();

function getState() {
  return state;
}

function loadGame(gameId) {
  const game = readGame(gameId);
  state = createEmptyState();
  state.gameId = gameId;
  state.game = game;
  state.board = game.categories.map((cat) => cat.questions.map(() => 'unanswered'));
  return state;
}

function slugifyTeamId(name) {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

function setupTeams(teamConfigs) {
  const previousTeams = state.teams;
  state.teams = teamConfigs.map(({ name, bulbId }) => {
    const existing = previousTeams.find((t) => t.name === name);
    return {
      id: existing ? existing.id : slugifyTeamId(name),
      name,
      members: existing ? existing.members : [],
      score: existing ? existing.score : 0,
      bulbId
    };
  });
  state.teams.forEach((team) => {
    const bulb = getBulb(team.bulbId);
    if (bulb) wiz.warmWhite(bulb);
  });
  return state;
}

function joinTeam(teamId, name) {
  const team = state.teams.find((t) => t.id === teamId);
  if (team && !team.members.includes(name)) {
    team.members.push(name);
  }
  return state;
}

function testBulb(bulbId) {
  const bulb = getBulb(bulbId);
  if (!bulb) return state;
  wiz.testFlash(bulb);
  setTimeout(() => wiz.warmWhite(bulb), 1000);
  return state;
}

function toggleQr() {
  state.showQr = !state.showQr;
  return state;
}

function startIntro() {
  state.phase = 'intro';
  state.introCategoryIdx = 0;
  return state;
}

function nextCategory() {
  if (state.introCategoryIdx < state.game.categories.length - 1) {
    state.introCategoryIdx += 1;
  } else {
    state.phase = 'board';
  }
  return state;
}

function endIntro() {
  state.phase = 'board';
  return state;
}

function selectQuestion(categoryIdx, questionIdx) {
  state.phase = 'question';
  state.currentQuestion = { categoryIdx, questionIdx, questionStartedAt: Date.now() };
  state.buzzWinner = null;
  state.answeredBy = [];
  return state;
}

function getCurrentQuestion() {
  if (!state.currentQuestion) return null;
  const { categoryIdx, questionIdx } = state.currentQuestion;
  return state.game.categories[categoryIdx].questions[questionIdx];
}

function buzz(teamId) {
  if (state.phase !== 'question') return { accepted: false, reason: 'not_open' };
  if (state.buzzWinner) return { accepted: false, reason: 'already_tried' };
  if (state.answeredBy.includes(teamId)) return { accepted: false, reason: 'already_tried' };

  state.buzzWinner = teamId;
  const team = state.teams.find((t) => t.id === teamId);
  if (team) {
    const bulb = getBulb(team.bulbId);
    if (bulb) wiz.red(bulb);
  }
  sound.play('buzz');
  return { accepted: true };
}

function rejectBuzz() {
  sound.play('miss');
}

function markCorrect(teamId) {
  const team = state.teams.find((t) => t.id === teamId);
  const question = getCurrentQuestion();
  if (team && question) team.score += question.value;
  revealAnswer();
  return state;
}

function markWrong(teamId) {
  const team = state.teams.find((t) => t.id === teamId);
  const question = getCurrentQuestion();
  if (team && question) team.score -= question.value;
  state.answeredBy.push(teamId);
  resetBuzzer();
  // Even once every team has had a wrong attempt, stay on the question —
  // don't auto-close. The host decides when to reveal the answer or move on.
  return state;
}

function markAnswered() {
  if (state.currentQuestion) {
    const { categoryIdx, questionIdx } = state.currentQuestion;
    state.board[categoryIdx][questionIdx] = 'answered';
  }
}

function revealAnswer() {
  if (!state.currentQuestion) return state;
  markAnswered();
  state.phase = 'answer';
  state.buzzWinner = null;
  state.answeredBy = [];
  return state;
}

function closeQuestion() {
  markAnswered();
  state.phase = 'board';
  state.currentQuestion = null;
  state.buzzWinner = null;
  state.answeredBy = [];
  return state;
}

function resetBuzzer() {
  state.buzzWinner = null;
  sound.play('reset');
  state.teams.forEach((team) => {
    const bulb = getBulb(team.bulbId);
    if (bulb) wiz.warmWhite(bulb);
  });
  return state;
}

module.exports = {
  loadBulbs, getState, loadGame, setupTeams, joinTeam, testBulb,
  startIntro, nextCategory, endIntro, selectQuestion, buzz, rejectBuzz,
  markCorrect, markWrong, revealAnswer, closeQuestion, resetBuzzer, getCurrentQuestion,
  toggleQr
};
