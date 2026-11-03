// Real Chromium / Cache Storage / service-worker events, not a mocked fetch().
// The authentic public files are served on loopback. A test-only CSP prevents
// app/kiosk scripts from running: this suite validates the worker, not accounts
// or the complete employee journey. No real API, user, or payroll data is used.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {execFileSync} = require('node:child_process');

const root = path.resolve(__dirname, '../../web/live');
const output = path.resolve(process.env.PUNCH_PWA_OUTPUT || 'pwa-captures');
const scope = '/Punch360/web/live/';
const worker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const fileList = worker.match(/\bconst FILES\s*=\s*\[([\s\S]*?)\];/);
assert.ok(fileList, 'The authentic worker must declare its precache list');
const files = [...fileList[1].matchAll(/(['"])(\.\/[^'"]*)\1/g)].map(match => match[2]);
assert.ok(files.length > 20, 'A real application precache is required');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const hashFile = name => sha256(fs.readFileSync(path.join(root, name)));
const revision = execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
const report = {
  coverage: 'REAL CHROMIUM SERVICE WORKER; SYNTHETIC HTTP FAILURES; NO APP SCRIPTS OR REAL ACCOUNTS',
  limitations: ['Employee IN/OUT journey is separate', 'No Supabase or physical-device validation',
    'HTML uses a test-only restrictive CSP; visual appearance is not evaluated'],
  revision, pullRequestHead: process.env.PUNCH_PR_HEAD || null,
  serviceWorkerSha256: sha256(worker), startedAt: new Date().toISOString(),
  scenarios: [], blockedExternalRequests: []
};
const overrides = new Map();
const requests = [];
let extraConnectOrigin = '';
const mime = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml'};

function handler(request, response) {
  const url = new URL(request.url, 'http://127.0.0.1');
  const observation = {method: request.method, path: url.pathname, url: url.pathname + url.search};
  requests.push(observation);
  response.once('finish', () => { observation.status = response.statusCode; });
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('X-Punch-QA', 'synthetic-server-no-real-accounts');
  // These headers are only emitted by this test server. The worker may fetch
  // its local assets, while application HTML cannot start authenticated code.
  response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'none'; worker-src 'self'; connect-src 'self'" + (extraConnectOrigin ? ' ' + extraConnectOrigin : ''));
  if (request.method !== 'GET') {
    response.writeHead(202, {'Content-Type': 'text/plain'});
    response.end('FIXTURE-ONLY non-GET response');
    return;
  }
  if (url.pathname === scope + '__qa_bootstrap.html') {
    response.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
    response.end('<!doctype html><title>FIXTURE-ONLY PWA control page</title><p>Local service-worker test.</p>');
    return;
  }
  const status = overrides.get(url.pathname);
  if (status) {
    response.writeHead(status, {'Content-Type': 'text/plain'});
    response.end('FIXTURE-ONLY HTTP ' + status + ' ' + url.pathname);
    return;
  }
  if (!url.pathname.startsWith(scope)) {
    response.writeHead(404); response.end('FIXTURE-ONLY outside application scope'); return;
  }
  let relative;
  try { relative = decodeURIComponent(url.pathname.slice(scope.length)) || 'index.html'; }
  catch { response.writeHead(400); response.end('Invalid test path'); return; }
  const filename = path.resolve(root, relative);
  if (!filename.startsWith(root + path.sep) || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) {
    response.writeHead(404, {'Content-Type': 'text/plain'});
    response.end('FIXTURE-ONLY unknown route ' + url.pathname); return;
  }
  response.writeHead(200, {'Content-Type': mime[path.extname(filename)] || 'application/octet-stream'});
  response.end(fs.readFileSync(filename));
}

function listen(server, port = 0) {
  return new Promise((resolve, reject) => {
    const onError = error => { server.off('listening', onListening); reject(error); };
    const onListening = () => {
      server.off('error', onError);
      resolve('http://127.0.0.1:' + server.address().port);
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, '127.0.0.1');
  });
}
async function closeServer(server) {
  if (!server.listening) return;
  const closed = new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  // Stop accepting first, then close even keep-alive connections. Offline mode
  // alone did not interrupt the worker's network in the first Chromium run.
  server.closeAllConnections();
  await closed;
}
function assertConnectionRefused(origin) {
  return new Promise((resolve, reject) => {
    const request = http.get(origin + scope + '__qa_bootstrap.html', {agent: false, timeout: 3000}, response => {
      response.resume();
      reject(Error('Disconnected origin unexpectedly returned HTTP ' + response.statusCode));
    });
    request.once('timeout', () => request.destroy(Error('Connection refusal probe timed out')));
    request.once('error', error => {
      if (error.code === 'ECONNREFUSED') resolve({probeError: error.code, serverListening: false});
      else reject(error);
    });
  });
}
async function scenario(name, run) {
  const start = Date.now();
  try {
    const details = await run();
    report.scenarios.push({name, status: 'passed', durationMs: Date.now() - start, ...details});
    console.log('PASS ' + name);
  } catch (error) {
    report.scenarios.push({name, status: 'failed', durationMs: Date.now() - start, error: String(error.stack || error)});
    throw error;
  }
}

async function main() {
  fs.mkdirSync(output, {recursive: true});
  const server = http.createServer(handler);
  let otherServer, browser, context;
  try {
    const origin = await listen(server);
    report.origin = origin;
    const base = origin + scope;
    const port = Number(new URL(origin).port);
    async function disconnectOrigin() {
      await closeServer(server);
      assert.equal(server.listening, false, 'Offline origin must not be listening');
      return assertConnectionRefused(origin);
    }
    async function reconnectOrigin() {
      assert.equal(await listen(server, port), origin, 'Restart must preserve the installed worker origin');
      const response = await fetch(base + '__qa_bootstrap.html');
      assert.equal(response.status, 200, 'The same origin must recover before HTTP failure injection');
      await response.arrayBuffer();
      return {sameOrigin: true, status: response.status};
    }
    const expectedURLs = files.map(file => new URL(file, base).href).sort();
    const expectedHashes = Object.fromEntries(expectedURLs.map(url => {
      const relative = new URL(url).pathname.slice(scope.length) || 'index.html';
      return [url, hashFile(relative)];
    }));
    await scenario('authentic worker and every precache URL are served locally', async () => {
      const workerResponse = await fetch(base + 'sw.js');
      assert.equal(workerResponse.status, 200);
      assert.equal(sha256(await workerResponse.text()), report.serviceWorkerSha256);
      for (const url of expectedURLs) {
        const response = await fetch(url);
        assert.equal(response.status, 200, 'Missing precache resource: ' + url);
        await response.arrayBuffer();
      }
      return {precacheEntries: expectedURLs.length, workerUnmodified: true};
    });
    if (process.argv.includes('--server-check')) {
      await scenario('fixture transport closes completely and reopens on the same origin', async () => {
        const disconnected = await disconnectOrigin();
        const reconnected = await reconnectOrigin();
        return {disconnected, reconnected};
      });
      report.mode = 'SERVER CHECK ONLY — no browser validation';
      return;
    }
    const {chromium} = require('playwright');
    browser = await chromium.launch({headless: true});
    report.browser = browser.version();
    context = await browser.newContext({serviceWorkers: 'allow'});
    otherServer = http.createServer((_request, response) => {
      response.writeHead(200, {'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/plain'});
      response.end('FIXTURE-ONLY second local origin');
    });
    const otherOrigin = await listen(otherServer);
    extraConnectOrigin = otherOrigin;
    const allowedOrigins = new Set([origin, otherOrigin]);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (allowedOrigins.has(url.origin)) return route.continue();
      report.blockedExternalRequests.push(url.origin + url.pathname);
      return route.abort('blockedbyclient');
    });
    await context.tracing.start({screenshots: false, snapshots: true, sources: true});
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.setDefaultNavigationTimeout(15000);
    await page.goto(base + '__qa_bootstrap.html');
    await scenario('real service-worker install, activation, control and full precache', async () => {
      await page.evaluate(async () => {
        await navigator.serviceWorker.register('./sw.js', {updateViaCache: 'none'});
      });
      // Unlike ready, this wait is bounded even when precache installation fails.
      await page.waitForFunction(() => navigator.serviceWorker.controller?.state === 'activated');
      const cache = await page.evaluate(async () => {
        const names = await caches.keys();
        const current = names.filter(name => name.startsWith('punch-360-'));
        if (current.length !== 1) throw Error('Expected exactly one Punch cache');
        const storage = await caches.open(current[0]);
        return {name: current[0], urls: (await storage.keys()).map(request => request.url).sort()};
      });
      assert.deepEqual(cache.urls, expectedURLs);
      report.cacheName = cache.name;
      return {cacheName: cache.name, installedEntries: cache.urls.length};
    });

    async function navigate(file, query = '') {
      const response = await page.goto(base + file + query, {waitUntil: 'domcontentloaded'});
      assert.ok(response, 'Navigation must return a response');
      return {status: response.status(), fromServiceWorker: response.fromServiceWorker(),
        hash: sha256(await response.body())};
    }
    async function fetchProbe(url, method = 'GET') {
      const observed = page.waitForResponse(response => response.url() === url && response.request().method() === method);
      const evaluation = page.evaluate(async ({url, method}) => {
        const response = await fetch(url, {method, cache: 'no-store', credentials: 'omit'});
        return {status: response.status, body: await response.text()};
      }, {url, method});
      // Both rejections are observed even if a failed fetch yields no response.
      const [response, result] = await Promise.all([observed, evaluation]);
      return {...result, fromServiceWorker: response.fromServiceWorker(), hash: sha256(result.body)};
    }
    function servedStatuses(since, urls, status) {
      return urls.map(url => {
        const match = requests.slice(since).find(request => request.method === 'GET' && request.url === url && request.status === status);
        assert.ok(match, 'Server did not actually serve HTTP ' + status + ' for ' + url);
        return {url: match.url, status: match.status};
      });
    }
    async function assertCacheUnchanged() {
      const entries = await page.evaluate(async ({name}) => {
        const cache = await caches.open(name);
        const result = [];
        for (const request of await cache.keys()) {
          const response = await cache.match(request);
          const digest = await crypto.subtle.digest('SHA-256', await response.arrayBuffer());
          const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
          result.push({url: request.url, status: response.status, hash});
        }
        return result;
      }, {name: report.cacheName});
      assert.deepEqual(entries.map(entry => entry.url).sort(), expectedURLs);
      assert.ok(entries.every(entry => entry.status === 200), 'Error responses must never enter the cache');
      assert.deepEqual(Object.fromEntries(entries.map(entry => [entry.url, entry.hash])), expectedHashes,
        'Every cached response body must retain the authentic installed bytes');
    }

    async function whileDisconnected(run) {
      await context.setOffline(true);
      const disconnected = await disconnectOrigin();
      const before = requests.length;
      try {
        assert.equal(await page.evaluate(() => navigator.onLine), false, 'The page must observe offline state');
        const details = await run();
        assert.equal(requests.length, before, 'Offline responses must not reach the server');
        return {...details, transport: disconnected, receivedRequests: requests.length - before};
      } finally {
        await reconnectOrigin();
        await context.setOffline(false);
        assert.equal(await page.evaluate(() => navigator.onLine), true, 'The page must observe recovery');
      }
    }
    await scenario('installed home, kiosk and JavaScript work during a real offline transition', () => whileDisconnected(async () => {
      const scopeRoot = await navigate('', '?qa=offline-root');
      assert.deepEqual(scopeRoot, {status: 200, fromServiceWorker: true, hash: hashFile('index.html')});
      const home = await navigate('index.html', '?qa=offline');
      assert.deepEqual(home, {status: 200, fromServiceWorker: true, hash: hashFile('index.html')});
      const kiosk = await navigate('kiosk.html', '?qa=offline');
      assert.deepEqual(kiosk, {status: 200, fromServiceWorker: true, hash: hashFile('kiosk.html')});
      const asset = await fetchProbe(base + 'essential.js');
      assert.equal(asset.status, 200); assert.equal(asset.fromServiceWorker, true);
      assert.equal(asset.hash, hashFile('essential.js'));
      return {scopeRoot, home, kiosk, asset: {status: asset.status, fromServiceWorker: asset.fromServiceWorker, hash: asset.hash}};
    }));

    for (const status of [502, 503, 504]) {
      await scenario('HTTP ' + status + ' returns installed public files without caching the outage', async () => {
        for (const file of ['', 'index.html', 'kiosk.html', 'essential.js']) overrides.set(scope + file, status);
        const before = requests.length;
        const scopeRoot = await navigate('', '?qa=' + status);
        const home = await navigate('index.html', '?qa=' + status);
        const kiosk = await navigate('kiosk.html', '?qa=' + status);
        const asset = await fetchProbe(base + 'essential.js');
        assert.deepEqual(scopeRoot, {status: 200, fromServiceWorker: true, hash: hashFile('index.html')});
        assert.deepEqual(home, {status: 200, fromServiceWorker: true, hash: hashFile('index.html')});
        assert.deepEqual(kiosk, {status: 200, fromServiceWorker: true, hash: hashFile('kiosk.html')});
        assert.equal(asset.status, 200); assert.equal(asset.fromServiceWorker, true);
        assert.equal(asset.hash, hashFile('essential.js'));
        const network = servedStatuses(before, [scope + '?qa=' + status, scope + 'index.html?qa=' + status,
          scope + 'kiosk.html?qa=' + status, scope + 'essential.js'], status);
        await assertCacheUnchanged();
        overrides.clear();
        return {injectedStatus: status, network, rootStatus: scopeRoot.status, homeStatus: home.status, kioskStatus: kiosk.status, assetStatus: asset.status};
      });
    }
    for (const status of [401, 403, 404, 500, 501, 505]) {
      await scenario('HTTP ' + status + ' remains visible and never becomes a cached success', async () => {
        overrides.set(scope + 'index.html', status);
        overrides.set(scope + 'essential.js', status);
        const before = requests.length;
        const home = await navigate('index.html', '?qa=' + status);
        assert.equal(home.status, status); assert.equal(home.fromServiceWorker, true);
        const asset = await fetchProbe(base + 'essential.js');
        assert.equal(asset.status, status); assert.equal(asset.fromServiceWorker, true);
        assert.match(asset.body, /FIXTURE-ONLY HTTP/);
        const network = servedStatuses(before, [scope + 'index.html?qa=' + status, scope + 'essential.js'], status);
        await assertCacheUnchanged();
        overrides.clear();
        return {injectedStatus: status, network, homeStatus: home.status, assetStatus: asset.status};
      });
    }
    await scenario('offline reread after HTTP failures still returns the original installed bytes', () => whileDisconnected(async () => {
      const home = await navigate('index.html', '?qa=after-errors');
      const kiosk = await navigate('kiosk.html', '?qa=after-errors');
      const asset = await fetchProbe(base + 'essential.js');
      assert.deepEqual(home, {status: 200, fromServiceWorker: true, hash: hashFile('index.html')});
      assert.deepEqual(kiosk, {status: 200, fromServiceWorker: true, hash: hashFile('kiosk.html')});
      assert.equal(asset.hash, hashFile('essential.js'));
      assert.equal(asset.status, 200); assert.equal(asset.fromServiceWorker, true);
      await assertCacheUnchanged();
      return {home, kiosk, assetHash: asset.hash};
    }));
    await scenario('private paths, JSON, non-GET requests and other origins bypass the worker', async () => {
      for (const route of ['private/reports', 'api/attendance.json']) {
        overrides.set(scope + route, 503);
        const response = await fetchProbe(base + route);
        assert.equal(response.status, 503); assert.equal(response.fromServiceWorker, false);
        assert.match(response.body, /FIXTURE-ONLY HTTP 503/);
      }
      const navigation = await navigate('private/reports');
      assert.equal(navigation.status, 503); assert.equal(navigation.fromServiceWorker, false);
      const post = await fetchProbe(base + 'index.html', 'POST');
      assert.equal(post.status, 202); assert.equal(post.fromServiceWorker, false);
      const foreign = await fetchProbe(otherOrigin + scope + 'index.html');
      assert.equal(foreign.status, 200); assert.equal(foreign.fromServiceWorker, false);
      assert.equal(foreign.body, 'FIXTURE-ONLY second local origin');
      overrides.clear();
      await assertCacheUnchanged();
      return {privateNavigationStatus: navigation.status, postStatus: post.status, foreignOrigin: otherOrigin};
    });
    await scenario('an empty cache preserves the original gateway error', async () => {
      await page.evaluate(async () => { for (const name of await caches.keys()) await caches.delete(name); });
      overrides.set(scope + 'index.html', 503);
      const result = await navigate('index.html', '?qa=empty-cache');
      assert.equal(result.status, 503); assert.equal(result.fromServiceWorker, true);
      assert.equal(result.hash, sha256('FIXTURE-ONLY HTTP 503 ' + scope + 'index.html'));
      return {injectedStatus: 503, observedStatus: result.status};
    });
    assert.deepEqual(report.blockedExternalRequests, [], 'No application script or external request should start in this isolated worker suite');
  } finally {
    if (context) await context.tracing.stop({path: path.join(output, 'pwa-browser-trace.zip')}).catch(() => {});
    if (browser) await browser.close();
    if (otherServer) await closeServer(otherServer);
    await closeServer(server);
  }
}

main().catch(error => {
  report.error = String(error.stack || error);
  process.exitCode = 1;
  console.error('PWA BROWSER FAILED:', error);
}).finally(() => {
  report.finishedAt = new Date().toISOString();
  report.passed = report.scenarios.filter(item => item.status === 'passed').length;
  report.failed = report.scenarios.filter(item => item.status === 'failed').length;
  report.success = !report.error;
  fs.mkdirSync(output, {recursive: true});
  fs.writeFileSync(path.join(output, 'pwa-browser-results.json'), JSON.stringify(report, null, 2) + '\n');
});
