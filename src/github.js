const BASE_HEADERS = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28'
};

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const message = data.error_description || data.message || `GitHub API request failed: ${response.status}`;
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }
  return data;
}

function authHeaders(token) {
  return {
    ...BASE_HEADERS,
    Authorization: 'Bearer ' + token
  };
}

async function startDeviceFlow(clientId) {
  const body = new URLSearchParams({ client_id: clientId, scope: 'repo read:user' });
  const response = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || 'Unable to start device flow');
  }
  return data;
}

async function pollDeviceFlow(clientId, deviceCode) {
  const body = new URLSearchParams({
    client_id: clientId,
    device_code: deviceCode,
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
  });

  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  const data = await response.json();
  if (data.error) {
    return { pending: true, error: data.error };
  }

  return { pending: false, token: data.access_token };
}

async function revokeToken(clientId, clientSecret, token) {
  if (!clientId || !clientSecret || !token) {
    return;
  }

  await requestJson(`https://api.github.com/applications/${clientId}/token`, {
    method: 'DELETE',
    headers: {
      ...BASE_HEADERS,
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ access_token: token })
  });
}

async function getUser(token) {
  return requestJson('https://api.github.com/user', {
    headers: authHeaders(token)
  });
}

async function getFile(owner, repo, path, ref, token) {
  try {
    const normalizedPath = String(path).split('/').map(encodeURIComponent).join('/');
    return await requestJson(`https://api.github.com/repos/${owner}/${repo}/contents/${normalizedPath}?ref=${encodeURIComponent(ref)}`, {
      headers: authHeaders(token)
    });
  } catch (err) {
    if (err.status === 404) {
      return null;
    }
    throw err;
  }
}

async function getBranchHead(owner, repo, branch, token) {
  return requestJson(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`, {
    headers: authHeaders(token)
  });
}

async function getCommit(owner, repo, commitSha, token) {
  return requestJson(`https://api.github.com/repos/${owner}/${repo}/git/commits/${commitSha}`, {
    headers: authHeaders(token)
  });
}

async function getTree(owner, repo, treeSha, token) {
  return requestJson(`https://api.github.com/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`, {
    headers: authHeaders(token)
  });
}

async function createBlob(owner, repo, contentBase64, token) {
  const data = await requestJson(`https://api.github.com/repos/${owner}/${repo}/git/blobs`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ content: contentBase64, encoding: 'base64' })
  });
  return data.sha;
}

async function createTree(owner, repo, baseTree, treeEntries, token) {
  const data = await requestJson(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ base_tree: baseTree, tree: treeEntries })
  });

  return data.sha;
}

async function createCommit(owner, repo, message, treeSha, parentSha, token) {
  const data = await requestJson(`https://api.github.com/repos/${owner}/${repo}/git/commits`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ message, tree: treeSha, parents: [parentSha] })
  });
  return data.sha;
}

async function updateRef(owner, repo, branch, commitSha, token) {
  await requestJson(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: 'PATCH',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sha: commitSha, force: false })
  });
}

module.exports = {
  startDeviceFlow,
  pollDeviceFlow,
  revokeToken,
  getUser,
  getFile,
  getBranchHead,
  getCommit,
  getTree,
  createBlob,
  createTree,
  createCommit,
  updateRef
};
