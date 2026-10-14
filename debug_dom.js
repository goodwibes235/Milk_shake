const { spawn } = require('child_process');
const http = require('http');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = 9225;

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
    '--user-data-dir=C:\\Users\\Abdul Rehman\\AppData\\Local\\Temp\\edge_cdp_profile2'
  ]);

  let targets;
  for (let i = 0; i < 15; i++) {
    await sleep(500);
    try {
      targets = await httpGet(`http://127.0.0.1:${port}/json`);
      if (targets && targets.length) break;
    } catch(e) {}
  }

  const pageTarget = targets.find(t => t.type === 'page') || targets[0];
  console.log('Target picked:', pageTarget.type, pageTarget.url);
  const client = new (class {
    constructor(wsUrl) {
      this.ws = new globalThis.WebSocket(wsUrl);
      this.id = 1;
      this.cbs = new Map();
      this.ws.onmessage = (e) => {
        const m = JSON.parse(e.data);
        if (m.id && this.cbs.has(m.id)) {
          this.cbs.get(m.id)(m);
          this.cbs.delete(m.id);
        } else if (m.method === 'Runtime.exceptionThrown') {
          console.error('EXCEPTION IN BROWSER:', JSON.stringify(m.params.exceptionDetails));
        } else if (m.method === 'Runtime.consoleAPICalled') {
          console.log('CONSOLE:', m.params.args.map(a => a.value));
        }
      };
    }
    open() { return new Promise(r => this.ws.onopen = r); }
    send(method, params = {}) {
      return new Promise((res, rej) => {
        const id = this.id++;
        this.cbs.set(id, m => m.error ? rej(m.error) : res(m.result));
        this.ws.send(JSON.stringify({ id, method, params }));
      });
    }
    close() { this.ws.close(); }
  })(pageTarget.webSocketDebuggerUrl);

  await client.open();
  await client.send('Runtime.enable');
  await client.send('Page.enable');

  await client.send('Page.navigate', { url: 'http://localhost:8080/Optitech.html' });
  await sleep(3500);

  const res = await client.send('Runtime.evaluate', {
    expression: `({
      htmlLen: document.body.innerHTML.length,
      splashBack: !!document.getElementById('splashCanvasBack'),
      fruitsCount: document.querySelectorAll('.fruit').length,
      fruitCanvasCount: document.querySelectorAll('.fruit-canvas').length,
      loaderEl: !!document.getElementById('loader'),
      url: window.location.href
    })`,
    returnByValue: true
  });
  console.log('DOM status:', res.result.value);

  client.close();
  edgeProc.kill();
}
run();
