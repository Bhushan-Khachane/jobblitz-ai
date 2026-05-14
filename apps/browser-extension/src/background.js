// -- Config ---------------------------------------------------------------
const API_BASE = 'http://localhost:8000';
const WS_PATH  = '/ws/extension';
let ws = null;
let reconnectTimer = null;
let isRunning = false;
let dailyCounts = {};

// -- Rate limits (conservative safe defaults) ----------------------------
const LIMITS = {
  linkedin:    { daily: 8,  hourly: 2,  minGapMs: 300000  },
  naukri:      { daily: 15, hourly: 4,  minGapMs: 180000  },
  indeed:      { daily: 20, hourly: 5,  minGapMs: 120000  },
  internshala: { daily: 25, hourly: 6,  minGapMs:  60000  },
  shine:       { daily: 20, hourly: 5,  minGapMs:  90000  },
  unstop:      { daily: 25, hourly: 6,  minGapMs:  60000  },
};

// -- Human-like delay (log-normal distribution) ----------------------------
function humanDelay(minMs = 800, maxMs = 4000) {
  const u1 = Math.random(), u2 = Math.random();
  const z  = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const ms = Math.min(Math.max(minMs + (maxMs - minMs) / 2 + z * 600, minMs), maxMs);
  return new Promise(r => setTimeout(r, ms));
}

// -- Time-of-day gate (8am-10pm only) --------------------------------------
function isWorkingHour() {
  const h = new Date().getHours();
  return h >= 8 && h <= 22;
}

// -- Velocity governor -----------------------------------------------------
async function canApply(platform) {
  const now = Date.now();
  const key = `velocity_${platform}`;
  const data = await chrome.storage.local.get(key);
  const v = data[key] || { daily: 0, hourly: 0, lastApply: 0, dayStart: now };

  if (now - v.dayStart > 86400000) { v.daily = 0; v.dayStart = now; }
  if (now - v.lastApply > 3600000) { v.hourly = 0; }

  const lim = LIMITS[platform] || LIMITS.naukri;
  if (!isWorkingHour())      return { ok: false, reason: 'Outside working hours (8am-10pm)' };
  if (v.daily  >= lim.daily) return { ok: false, reason: `Daily limit (${lim.daily}) reached` };
  if (v.hourly >= lim.hourly)return { ok: false, reason: 'Hourly limit reached' };
  if (now - v.lastApply < lim.minGapMs) {
    const wait = Math.ceil((lim.minGapMs - (now - v.lastApply)) / 1000);
    return { ok: false, reason: `Too fast - wait ${wait}s` };
  }
  return { ok: true };
}

async function recordApply(platform) {
  const key = `velocity_${platform}`;
  const data = await chrome.storage.local.get(key);
  const v = data[key] || { daily: 0, hourly: 0, lastApply: 0, dayStart: Date.now() };
  v.daily++;
  v.hourly++;
  v.lastApply = Date.now();
  await chrome.storage.local.set({ [key]: v });
}

// -- WebSocket connection --------------------------------------------------
async function connectWebSocket() {
  const { authToken } = await chrome.storage.local.get('authToken');
  if (!authToken) { console.log('[JobBlitz] No auth token'); return; }
  if (ws && ws.readyState === WebSocket.OPEN) return;

  const wsUrl = API_BASE.replace('http', 'ws') + WS_PATH + `?token=${authToken}`;
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('[JobBlitz] WebSocket connected');
    chrome.storage.local.set({ wsStatus: 'connected' });
    ws.send(JSON.stringify({ type: 'extension_ready', version: '1.0.0' }));
  };

  ws.onmessage = async (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }
    console.log('[JobBlitz] Received:', msg.type);
    if (msg.type === 'apply_job') { await handleApplyJob(msg); }
    else if (msg.type === 'pause') { isRunning = false; chrome.storage.local.set({ automationStatus: 'paused' }); }
    else if (msg.type === 'resume') { isRunning = true; chrome.storage.local.set({ automationStatus: 'running' }); }
  };

  ws.onclose = () => {
    chrome.storage.local.set({ wsStatus: 'disconnected' });
    reconnectTimer = setTimeout(connectWebSocket, 5000);
  };

  ws.onerror = (e) => { console.error('[JobBlitz] WS error:', e); };
}

// -- Apply handler ---------------------------------------------------------
async function handleApplyJob(msg) {
  if (!isRunning) { sendStatus(msg.application_id, 'skipped', 'Automation is paused'); return; }
  const platform = detectPlatform(msg.job_url);
  const check = await canApply(platform);
  if (!check.ok) { sendStatus(msg.application_id, 'rate_limited', check.reason); return; }

  try {
    sendStatus(msg.application_id, 'starting', `Opening ${msg.job_url}`);
    await humanDelay(2000, 5000);

    const tab = await chrome.tabs.create({ url: msg.job_url, active: false });
    await new Promise((resolve) => {
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === tab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      });
    });

    await humanDelay(4000, 12000);

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id }, func: applyToJob, args: [msg.cover_letter, msg.form_data, platform]
    });

    const result = results?.[0]?.result;
    if (result?.success) {
      await recordApply(platform);
      sendStatus(msg.application_id, 'applied', result.message || 'Applied successfully');
      chrome.notifications.create({
        type: 'basic', iconUrl: 'icons/icon48.png',
        title: 'JobBlitz - Applied!',
        message: `Applied to ${msg.job_title || 'job'} on ${platform}`
      });
    } else {
      sendStatus(msg.application_id, 'failed', result?.error || 'Apply script failed');
    }

    await humanDelay(3000, 8000);
    chrome.tabs.remove(tab.id).catch(() => {});
  } catch (err) { sendStatus(msg.application_id, 'error', err.message); }
}

function detectPlatform(url) {
  if (url.includes('naukri.com'))      return 'naukri';
  if (url.includes('linkedin.com'))    return 'linkedin';
  if (url.includes('indeed.co.in'))    return 'indeed';
  if (url.includes('internshala.com')) return 'internshala';
  if (url.includes('shine.com'))       return 'shine';
  if (url.includes('unstop.com'))      return 'unstop';
  return 'unknown';
}

function sendStatus(applicationId, status, message) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'apply_status', application_id: applicationId, status, message, timestamp: new Date().toISOString() }));
  }
}

// -- Apply script (runs INSIDE job portal tab) -----------------------------
function applyToJob(coverLetter, formData, platform) {
  function simulateScroll() {
    return new Promise(r => {
      let scrolled = 0;
      const interval = setInterval(() => {
        const step = Math.floor(Math.random() * 80 + 20);
        window.scrollBy(0, step);
        scrolled += step;
        if (scrolled > window.innerHeight * 1.5) { clearInterval(interval); setTimeout(r, 800); }
      }, Math.random() * 100 + 50);
    });
  }

  function humanClick(element) {
    return new Promise(r => {
      const rect = element.getBoundingClientRect();
      const targetX = rect.left + rect.width  / 2 + (Math.random() - 0.5) * 4;
      const targetY = rect.top  + rect.height / 2 + (Math.random() - 0.5) * 4;
      const evt = new MouseEvent('click', { bubbles: true, cancelable: true, clientX: targetX, clientY: targetY });
      setTimeout(() => { element.dispatchEvent(evt); r(); }, 100 + Math.random() * 200);
    });
  }

  async function humanType(element, text) {
    element.focus();
    element.value = '';
    for (const char of text) {
      element.value += char;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 30 + Math.random() * 100));
    }
  }

  const SELECTORS = {
    naukri: {
      applyBtn:    'button[class*="apply"], a[class*="apply-button"], #apply-button',
      coverLetter: 'textarea[name*="cover"], textarea[placeholder*="cover"], textarea[class*="cover"]',
      submit:      'button[type="submit"], button[class*="submit-btn"]'
    },
    linkedin: {
      applyBtn:    'button.jobs-apply-button, button[aria-label*="Easy Apply"]',
      coverLetter: 'textarea[id*="cover"], div[data-test-text-entity-list-form-component] textarea',
      submit:      'button[aria-label*="Submit application"], footer button[class*="artdeco-button--primary"]'
    },
    indeed: {
      applyBtn:    'a[id*="indeedApplyButton"], button[class*="ia-IndeedApplyButton"]',
      coverLetter: 'textarea[id*="cover"], textarea[name*="cover"]',
      submit:      'button[type="submit"]'
    },
    internshala: {
      applyBtn:    'button#apply_now_btn, button.btn-primary[onclick*="apply"]',
      coverLetter: 'textarea#cover_letter_html, textarea[name="cover_letter"]',
      submit:      'button#submit_application_btn'
    }
  };

  const sel = SELECTORS[platform] || SELECTORS.naukri;

  return (async () => {
    try {
      await simulateScroll();
      await new Promise(r => setTimeout(r, 1500 + Math.random() * 2000));

      const applyBtn = document.querySelector(sel.applyBtn);
      if (!applyBtn) return { success: false, error: `Apply button not found for ${platform}` };
      await humanClick(applyBtn);
      await new Promise(r => setTimeout(r, 2000 + Math.random() * 1000));

      if (coverLetter) {
        const clField = document.querySelector(sel.coverLetter);
        if (clField) { await humanType(clField, coverLetter); await new Promise(r => setTimeout(r, 800 + Math.random() * 500)); }
      }

      if (formData) {
        for (const [fieldName, value] of Object.entries(formData)) {
          const field = document.querySelector(`input[name="${fieldName}"], textarea[name="${fieldName}"], select[name="${fieldName}"]`);
          if (field) {
            if (field.tagName === 'SELECT') { field.value = value; field.dispatchEvent(new Event('change', { bubbles: true })); }
            else { await humanType(field, String(value)); }
            await new Promise(r => setTimeout(r, 300 + Math.random() * 400));
          }
        }
      }

      const submitBtn = document.querySelector(sel.submit);
      if (!submitBtn) return { success: false, error: 'Submit button not found' };
      await humanClick(submitBtn);
      await new Promise(r => setTimeout(r, 2000));
      return { success: true, message: 'Application submitted' };
    } catch (err) { return { success: false, error: err.message }; }
  })();
}

// -- Init ------------------------------------------------------------------
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ automationStatus: 'stopped', wsStatus: 'disconnected', isRunning: false });
  console.log('[JobBlitz] Extension installed');
});

chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  if (msg.type === 'start_automation') {
    isRunning = true; chrome.storage.local.set({ automationStatus: 'running' }); connectWebSocket(); respond({ ok: true });
  } else if (msg.type === 'stop_automation') {
    isRunning = false; chrome.storage.local.set({ automationStatus: 'stopped' }); if (ws) ws.close(); respond({ ok: true });
  } else if (msg.type === 'set_token') {
    chrome.storage.local.set({ authToken: msg.token }); connectWebSocket(); respond({ ok: true });
  } else if (msg.type === 'get_status') {
    chrome.storage.local.get(['automationStatus', 'wsStatus', 'authToken'], data => respond(data));
    return true;
  }
});
