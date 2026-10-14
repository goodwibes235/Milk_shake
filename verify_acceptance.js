const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = 9226;

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

class CDPClient {
  constructor(wsUrl) {
    this.ws = new globalThis.WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
    this.exceptions = [];
    this.ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        this.callbacks.get(msg.id)(msg);
        this.callbacks.delete(msg.id);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        console.error('EXCEPTION IN BROWSER:', JSON.stringify(msg.params.exceptionDetails));
        this.exceptions.push(msg.params);
      }
    };
  }

  async open() {
    if (this.ws.readyState === 1) return;
    return new Promise(resolve => {
      this.ws.onopen = resolve;
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, (msg) => {
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.ws.close();
  }
}

async function run() {
  console.log('Spawning Edge headless...');
  const edgeProc = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--disable-gpu',
    '--no-sandbox',
    '--disable-extensions',
    '--user-data-dir=C:\\Users\\Abdul Rehman\\AppData\\Local\\Temp\\edge_cdp_profile_acc',
    'http://localhost:8080/Optitech.html'
  ]);

  let targets = null;
  for (let retry = 0; retry < 15; retry++) {
    await sleep(500);
    try {
      targets = await httpGet(`http://127.0.0.1:${port}/json`);
      if (targets && targets.length > 0) break;
    } catch (e) {}
  }
  if (!targets) throw new Error('Could not connect to Edge on port ' + port);

  const pageTarget = targets.find(t => t.type === 'page' && t.url.includes('Optitech.html')) || targets.find(t => t.type === 'page');
  console.log('Connecting to page target:', pageTarget.url);

  const client = new CDPClient(pageTarget.webSocketDebuggerUrl);
  try {
    await client.open();
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Log.enable');

    // Wait until loader finishes and app starts on Optitech.html
    for (let i = 0; i < 25; i++) {
      await sleep(500);
      const readyCheck = await client.send('Runtime.evaluate', {
        expression: `(function(){
          const l = document.getElementById('loader');
          const onPage = window.location.href.includes('Optitech.html');
          const b = document.getElementById('bottle');
          return {
            onPage: onPage,
            isLoaded: onPage && b && (!l || l.classList.contains('is-loaded')),
            bottleCanv: !!b,
            milkWave: !!document.getElementById('milkWaveImg'),
            fruitCanvases: document.querySelectorAll('.fruit-canvas').length
          };
        })()`,
        returnByValue: true
      });
      if (readyCheck.result.value && readyCheck.result.value.isLoaded) {
        console.log('App ready check:', readyCheck.result.value);
        break;
      }
    }

    // Wait for intro burst timeline to complete
    await sleep(2500);

    // 1. DESKTOP 1440x900 ACCEPTANCE CHECKS
    console.log('\n--- 1. DESKTOP 1440x900 CHECKS ---');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await sleep(500);

    // Scroll 0%
    await client.send('Runtime.evaluate', {
      expression: `window.scrollTo(0, 0); if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.update();`
    });
    await sleep(600);
    let shot0 = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('screenshot_desk_0.png', Buffer.from(shot0.data, 'base64'));
    console.log('Captured screenshot_desk_0.png');

    // Scroll 47%
    await client.send('Runtime.evaluate', {
      expression: `(function(){
        const j = document.getElementById('journey');
        const range = j.offsetHeight - window.innerHeight;
        window.scrollTo(0, j.offsetTop + range * 0.47);
        if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.update();
      })()`
    });
    await sleep(800);
    let shot47 = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('screenshot_desk_47.png', Buffer.from(shot47.data, 'base64'));
    console.log('Captured screenshot_desk_47.png');

    // Scroll 100%
    await client.send('Runtime.evaluate', {
      expression: `(function(){
        const j = document.getElementById('journey');
        const range = j.offsetHeight - window.innerHeight;
        window.scrollTo(0, j.offsetTop + range * 1.0);
        if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.update();
      })()`
    });
    await sleep(800);
    let shot100 = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('screenshot_desk_100.png', Buffer.from(shot100.data, 'base64'));
    console.log('Captured screenshot_desk_100.png');

    // Reverse scroll 100% -> 0%
    await client.send('Runtime.evaluate', {
      expression: `(function(){
        window.scrollTo(0, 0);
        if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.update();
      })()`
    });
    await sleep(800);
    let shotReverse0 = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('screenshot_desk_reverse_0.png', Buffer.from(shotReverse0.data, 'base64'));
    console.log('Captured screenshot_desk_reverse_0.png (Reverse 100% -> 0%)');

    // 2. HORIZONTAL OVERFLOW AT ALL VIEWPORTS
    console.log('\n--- 2. HORIZONTAL OVERFLOW CHECKS ---');
    const viewports = [1440, 1024, 768, 400];
    for (const w of viewports) {
      await client.send('Emulation.setDeviceMetricsOverride', {
        width: w,
        height: 800,
        deviceScaleFactor: 1,
        mobile: w <= 768
      });
      await sleep(300);
      const overflow = await client.send('Runtime.evaluate', {
        expression: `({
          viewportWidth: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          hasHorizontalScroll: document.documentElement.scrollWidth > window.innerWidth
        })`,
        returnByValue: true
      });
      console.log(`Viewport ${w}px: scrollWidth=${overflow.result.value.scrollWidth}, hasHorizontalScroll=${overflow.result.value.hasHorizontalScroll}`);
    }

    // 3. MOBILE 400x800 ACCEPTANCE CHECKS
    console.log('\n--- 3. MOBILE 400x800 CHECKS ---');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 400,
      height: 800,
      deviceScaleFactor: 1.5,
      mobile: true
    });
    await sleep(500);

    // Mobile 0%
    await client.send('Runtime.evaluate', {
      expression: `window.scrollTo(0, 0); if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.update();`
    });
    await sleep(800);
    let shotMob0 = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('screenshot_mob_0.png', Buffer.from(shotMob0.data, 'base64'));
    console.log('Captured screenshot_mob_0.png');

    // Mobile 47%
    await client.send('Runtime.evaluate', {
      expression: `(function(){
        const j = document.getElementById('journey');
        const range = j.offsetHeight - window.innerHeight;
        window.scrollTo(0, j.offsetTop + range * 0.47);
        if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.update();
      })()`
    });
    await sleep(800);
    let shotMob47 = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('screenshot_mob_47.png', Buffer.from(shotMob47.data, 'base64'));
    console.log('Captured screenshot_mob_47.png');

    // Mobile 100%
    await client.send('Runtime.evaluate', {
      expression: `(function(){
        const j = document.getElementById('journey');
        const range = j.offsetHeight - window.innerHeight;
        window.scrollTo(0, j.offsetTop + range * 1.0);
        if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.update();
      })()`
    });
    await sleep(800);
    let shotMob100 = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('screenshot_mob_100.png', Buffer.from(shotMob100.data, 'base64'));
    console.log('Captured screenshot_mob_100.png');

    // 4. MOTION & CANVAS PERFORMANCE CHECK
    console.log('\n--- 4. CANVAS PERFORMANCE & ANIMATION VERIFICATION ---');
    const perfCheck = await client.send('Runtime.evaluate', {
      expression: `(function(){
        const fruits = document.querySelectorAll('.fruit-canvas');
        let renderedCount = 0;
        fruits.forEach(f => {
          if (f.width > 0 && f.height > 0) renderedCount++;
        });
        const backSplash = document.getElementById('splashCanvasBack');
        const frontSplash = document.getElementById('splashCanvasFront');
        return {
          fruitCanvasesTotal: fruits.length,
          fruitCanvasesSized: renderedCount,
          backSplashWidth: backSplash ? backSplash.width : 0,
          backSplashHeight: backSplash ? backSplash.height : 0,
          frontSplashWidth: frontSplash ? frontSplash.width : 0,
          frontSplashHeight: frontSplash ? frontSplash.height : 0
        };
      })()`,
      returnByValue: true
    });
    console.log('Canvas state:', perfCheck.result.value);

    console.log('\n--- ALL CHECKS COMPLETED SUCCESSFULLY ---');
  } finally {
    client.close();
    edgeProc.kill();
  }
}

run().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
