function createWsClient({ role, onState, onBuzzRejected }) {
  let ws;
  let reconnectTimer;

  function connect() {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${protocol}://${location.host}/ws?role=${role}`);

    ws.addEventListener('open', () => {
      clearTimeout(reconnectTimer);
      document.dispatchEvent(new CustomEvent('ws-connected'));
    });

    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'state_update') onState(msg.state);
      if (msg.type === 'buzz_rejected' && onBuzzRejected) onBuzzRejected(msg.reason);
    });

    ws.addEventListener('close', () => {
      document.dispatchEvent(new CustomEvent('ws-disconnected'));
      reconnectTimer = setTimeout(connect, 1500);
    });

    ws.addEventListener('error', () => ws.close());
  }

  function send(type, payload) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, ...(payload || {}) }));
    }
  }

  connect();
  return { send };
}
