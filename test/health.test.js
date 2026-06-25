const assert = require('node:assert/strict');
const test = require('node:test');

process.env.GITHUB_CLIENT_ID = '';

const { app } = require('../src/server');

function listen(appInstance) {
  return new Promise((resolve, reject) => {
    const server = appInstance.listen(0, () => resolve(server));
    server.on('error', reject);
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function requestJson(server, path, options = {}) {
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}${path}`, options);
  const body = await response.json();
  return { response, body };
}

test('GET /api/health returns ok', async () => {
  const server = await listen(app);
  try {
    const { response, body } = await requestJson(server, '/api/health');
    assert.equal(response.status, 200);
    assert.deepEqual(body, { ok: true });
  } finally {
    await close(server);
  }
});

test('POST /api/auth/device/start explains missing client id', async () => {
  const server = await listen(app);
  try {
    const { response, body } = await requestJson(server, '/api/auth/device/start', {
      method: 'POST'
    });
    assert.equal(response.status, 400);
    assert.deepEqual(body, { error: 'GITHUB_CLIENT_ID is required' });
  } finally {
    await close(server);
  }
});
