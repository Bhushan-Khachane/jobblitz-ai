const ENV_MAP = {
  local:   { apiBase: 'http://localhost:8000',       frontendBase: 'http://localhost:3000' },
  staging: { apiBase: 'https://api-staging.jobblitz.ai', frontendBase: 'https://app-staging.jobblitz.ai' },
  prod:    { apiBase: 'https://api.jobblitz.ai',     frontendBase: 'https://app.jobblitz.ai' },
};

async function refreshUI() {
  const data = await new Promise(r =>
    chrome.runtime.sendMessage({ type: 'get_status' }, r)
  );

  // Load saved env or infer from current apiBase
  const envData = await new Promise(r => chrome.runtime.sendMessage({ type: 'get_env' }, r));
  const select = document.getElementById('env-select');
  let matched = false;
  for (const [key, cfg] of Object.entries(ENV_MAP)) {
    if (cfg.apiBase === envData.apiBase) { select.value = key; matched = true; break; }
  }
  if (!matched) select.value = 'local';

  const dot = document.getElementById('ws-dot');
  const statusText = document.getElementById('ws-status');

  if (data.wsStatus === 'connected') {
    dot.className = 'dot green';
    statusText.textContent = 'Connected to JobBlitz';
  } else {
    dot.className = data.authToken ? 'dot yellow' : 'dot red';
    statusText.textContent = data.authToken ? 'Reconnecting...' : 'Not logged in';
  }

  const isRunning = data.automationStatus === 'running';
  document.getElementById('btn-start').style.display = isRunning ? 'none'  : 'block';
  document.getElementById('btn-stop').style.display  = isRunning ? 'block' : 'none';

  // Load velocity counts
  for (const platform of ['naukri', 'linkedin', 'indeed']) {
    const key = `velocity_${platform}`;
    const vData = await new Promise(r => chrome.storage.local.get(key, r));
    const v = vData[key] || { daily: 0 };
    const limits = { naukri: 15, linkedin: 8, indeed: 20 };
    const el = document.getElementById(`count-${platform}`);
    if (el) el.textContent = `${v.daily} / ${limits[platform]}`;
  }
}

document.getElementById('btn-start').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'start_automation' }, () => refreshUI());
});
document.getElementById('btn-stop').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'stop_automation' }, () => refreshUI());
});
document.getElementById('btn-login').addEventListener('click', async () => {
  const data = await new Promise(r => chrome.storage.local.get('frontendBase', r));
  const base = data.frontendBase || 'http://localhost:3000';
  chrome.tabs.create({ url: `${base}/settings/extension` });
});

document.getElementById('env-select').addEventListener('change', async (e) => {
  const cfg = ENV_MAP[e.target.value];
  if (cfg) {
    await new Promise(r => chrome.runtime.sendMessage({ type: 'set_env', ...cfg }, r));
    // Reconnect WS with new base
    chrome.runtime.sendMessage({ type: 'stop_automation' });
    setTimeout(() => chrome.runtime.sendMessage({ type: 'start_automation' }), 500);
  }
});

refreshUI();
setInterval(refreshUI, 3000);
