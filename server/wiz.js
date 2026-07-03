const dgram = require('dgram');

const WIZ_PORT = 38899;

const socket = dgram.createSocket('udp4');

socket.on('error', (err) => {
  console.error('Wiz UDP socket error:', err.message);
});

socket.bind();

function sendCommand(bulb, params) {
  const message = Buffer.from(JSON.stringify({ method: 'setPilot', params }));
  socket.send(message, WIZ_PORT, bulb.ip, (err) => {
    if (err) console.error(`Failed to send command to bulb ${bulb.id}:`, err.message);
  });
}

function warmWhite(bulb) {
  sendCommand(bulb, { state: true, temp: 2700, dimming: 100 });
}

function red(bulb) {
  sendCommand(bulb, { state: true, r: 255, g: 0, b: 0, dimming: 100 });
}

function testFlash(bulb) {
  sendCommand(bulb, { state: true, r: 0, g: 0, b: 255, dimming: 100 });
}

module.exports = { warmWhite, red, testFlash, sendCommand };
