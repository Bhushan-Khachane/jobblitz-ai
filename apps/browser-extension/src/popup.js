async function refreshUI() {
  const data = await new Promise(r =>
    chrome.runtime.sendMessage({ type: 'get_status' }, r)
  );

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
document.getElementById('btn-login').addEventListener('click', () => {
  chrome.tabs.create({ url: 'http://localhost:3000/settings/extension' });
});

refreshUI();
setInterval(refreshUI, 3000);
