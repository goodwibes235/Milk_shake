const { spawn } = require('child_process');
const http = require('http');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = 9231;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function run() {
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--user-data-dir=C:\\Users\\Abdul Rehman\\AppData\\Local\\Temp\\edge_cdp_profile_wave',
    'http://localhost:8080/Optitech.html'
  ]);

  let targets;
  for (let i = 0; i < 15; i++) {
    await sleep(500);
    try {
      targets = await httpGet(`http://127.0.0.1:${port}/json`);
      if (targets && targets.length) break;
    } catch(e) {}
  }

  const pageTarget = targets.find(t => t.type === 'page' && t.url.includes('Optitech.html')) || targets[0];
  const ws = new globalThis.WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let id = 1;
  const cbs = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && cbs.has(m.id)) {
      cbs.get(m.id)(m);
      cbs.delete(m.id);
    }
  };
  function send(method, params = {}) {
    return new Promise(res => {
      const msgId = id++;
      cbs.set(msgId, m => res(m.result));
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await send('Runtime.enable');
  await sleep(3000);

  const res = await send('Runtime.evaluate', {
    expression: `({
      bottlePosRect: document.getElementById('bottlePos').getBoundingClientRect(),
      splashBackRect: document.getElementById('splashBack').getBoundingClientRect(),
      milkImgRect: document.getElementById('milkWaveImg').getBoundingClientRect(),
      milkNaturalWidth: document.getElementById('milkWaveImg').naturalWidth,
      milkNaturalHeight: document.getElementById('milkWaveImg').naturalHeight,
      splashOpacity: window.getComputedStyle(document.getElementById('splashBack')).opacity,
      splashTransform: window.getComputedStyle(document.getElementById('splashBack')).transform,
      pulseTransform: window.getComputedStyle(document.querySelector('.pulse')).transform
    })`,
    returnByValue: true
  });
  console.log('Wave inspection:', res.result.value);

  ws.close();
  edgeProc.kill();
}
run();
