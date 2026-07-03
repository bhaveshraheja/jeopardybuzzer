const state = require('./state');

function connectionRole(req) {
  const url = new URL(req.url, 'http://localhost');
  const role = url.searchParams.get('role');
  return role === 'host' || role === 'board' ? role : 'player';
}

function redactedState(role) {
  const snapshot = JSON.parse(JSON.stringify(state.getState()));
  if (role === 'host' || !snapshot.game) return snapshot;

  snapshot.game.categories.forEach((category, cIdx) => {
    category.questions.forEach((question, qIdx) => {
      const isRevealed = snapshot.phase === 'answer' &&
        snapshot.currentQuestion &&
        snapshot.currentQuestion.categoryIdx === cIdx &&
        snapshot.currentQuestion.questionIdx === qIdx;
      if (!isRevealed) question.answer = null;
    });
  });
  return snapshot;
}

function sendState(ws) {
  ws.send(JSON.stringify({ type: 'state_update', state: redactedState(ws.role) }));
}

function broadcast(wss) {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) sendState(client);
  });
}

function handleMessage(ws, msg, wss) {
  switch (msg.type) {
    case 'join_team':
      state.joinTeam(msg.teamId, msg.name);
      break;
    case 'buzz': {
      const result = state.buzz(msg.teamId);
      if (!result.accepted) {
        state.rejectBuzz();
        ws.send(JSON.stringify({ type: 'buzz_rejected', reason: result.reason }));
        return;
      }
      break;
    }
    case 'setup_teams':
      state.setupTeams(msg.teams);
      break;
    case 'test_bulb':
      state.testBulb(msg.bulbId);
      break;
    case 'load_game':
      state.loadGame(msg.gameId);
      break;
    case 'start_intro':
      state.startIntro();
      break;
    case 'next_category':
      state.nextCategory();
      break;
    case 'end_intro':
      state.endIntro();
      break;
    case 'select_question':
      state.selectQuestion(msg.categoryIdx, msg.questionIdx);
      break;
    case 'reveal_answer':
      state.revealAnswer();
      break;
    case 'mark_correct':
      state.markCorrect(msg.teamId);
      break;
    case 'mark_wrong':
      state.markWrong(msg.teamId);
      break;
    case 'close_question':
      state.closeQuestion();
      break;
    case 'reset_buzzer':
      state.resetBuzzer();
      break;
    default:
      return;
  }
  broadcast(wss);
}

function attach(wss) {
  wss.on('connection', (ws, req) => {
    ws.role = connectionRole(req);
    sendState(ws);

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch (e) {
        return;
      }
      if (typeof msg !== 'object' || msg === null) {
        return;
      }
      handleMessage(ws, msg, wss);
    });
  });
}

module.exports = { attach, broadcast, redactedState };
