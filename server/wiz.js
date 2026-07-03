const dgram = require('dgram');

const WIZ_PORT = 38899;
const ACK_WINDOW = 10;
const ACK_TIMEOUT_MS = 500;
const UNREACHABLE_THRESHOLD = 0.5;

const socket = dgram.createSocket('udp4');
const ackHistory = new Map(); // bulbId -> boolean[]
const pendingByIp = new Map(); // ip -> Array<() => void>

socket.on('message', (msg, rinfo) => {
  const pending = pendingByIp.get(rinfo.address);
  if (pending && pending.length) {
    pending.forEach((resolveAcked) => resolveAcked());
    pendingByIp.delete(rinfo.address);
  }
});
socket.bind();

function recordAck(bulbId, acked) {
  const history = ackHistory.get(bulbId) || [];
  history.push(acked);
  if (history.length > ACK_WINDOW) history.shift();
  ackHistory.set(bulbId, history);
}

function isUnreachable(bulbId) {
  const history = ackHistory.get(bulbId) || [];
  if (history.length < ACK_WINDOW) return false;
  const ackedCount = history.filter(Boolean).length;
  return ackedCount / history.length < UNREACHABLE_THRESHOLD;
}

function sendCommand(bulb, params) {
  const message = Buffer.from(JSON.stringify({ method: 'setPilot', params }));

  return new Promise((resolve) => {
    let settled = false;
    const finish = (acked) => {
      if (settled) return;
      settled = true;
      recordAck(bulb.id, acked);
      resolve(acked);
    };

    const existing = pendingByIp.get(bulb.ip) || [];
    existing.push(() => finish(true));
    pendingByIp.set(bulb.ip, existing);

    socket.send(message, WIZ_PORT, bulb.ip, (err) => {
      if (err) finish(false);
    });

    setTimeout(() => finish(false), ACK_TIMEOUT_MS);
  });
}

function warmWhite(bulb) {
  return sendCommand(bulb, { state: true, temp: 2700, dimming: 100 });
}

function red(bulb) {
  return sendCommand(bulb, { state: true, r: 255, g: 0, b: 0, dimming: 100 });
}

function testFlash(bulb) {
  return sendCommand(bulb, { state: true, r: 0, g: 0, b: 255, dimming: 100 });
}

module.exports = { warmWhite, red, testFlash, isUnreachable, sendCommand };
