'use client';

import { useEffect, useState } from 'react';

export default function ExtensionSettingsPage() {
  const [token, setToken] = useState('');
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState<Record<string, { used: number; limit: number }>>({});

  useEffect(() => {
    // Try to get token from localStorage (set by auth flow)
    const stored = localStorage.getItem('access_token');
    if (stored) {
      setToken(stored);
      // Pass token to extension via postMessage (extension content script listens)
      window.postMessage({ type: 'JOBBLITZ_SET_TOKEN', token: stored }, '*');
    }
    // Load apply stats
    if (stored) {
      fetch('/api/v1/users/me/apply-stats', {
        headers: { Authorization: `Bearer ${stored}` },
      })
        .then((r) => r.json())
        .then(setStats)
        .catch(() => {});
    }
  }, []);

  const copyToken = () => {
    navigator.clipboard.writeText(token || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const platforms = ['naukri', 'linkedin', 'indeed', 'internshala', 'shine', 'unstop'];

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">Browser Extension</h1>
      <p className="text-slate-400 mb-6">
        Connect the JobBlitz Chrome extension to apply from your own browser.
        This drastically reduces the risk of account bans.
      </p>

      <div className="bg-slate-800 rounded-xl p-4 mb-6">
        <h2 className="font-semibold mb-3">Connection Token</h2>
        <p className="text-sm text-slate-400 mb-3">
          The extension auto-connects when you visit this page.
          Or manually copy your token into the extension popup.
        </p>
        <div className="flex gap-2">
          <code className="flex-1 bg-slate-900 rounded p-2 text-xs text-slate-300 truncate">
            {token ? token.slice(0, 40) + '...' : 'Not logged in'}
          </code>
          <button
            onClick={copyToken}
            className="px-3 py-2 bg-indigo-600 rounded text-sm font-medium"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl p-4 mb-6">
        <h2 className="font-semibold mb-3">Today&apos;s Apply Stats</h2>
        <div className="space-y-2">
          {platforms.map((p) => {
            const s = stats[p] || { used: 0, limit: 15 };
            const pct = Math.min((s.used / s.limit) * 100, 100);
            return (
              <div key={p}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="capitalize text-slate-300">{p}</span>
                  <span className="text-slate-400">{s.used} / {s.limit}</span>
                </div>
                <div className="h-1.5 bg-slate-700 rounded-full">
                  <div
                    className="h-1.5 bg-indigo-500 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-amber-950 border border-amber-800 rounded-xl p-4 text-sm">
        <h3 className="font-semibold text-amber-400 mb-1">Terms of Service Notice</h3>
        <p className="text-amber-200/80">
          Job portals including LinkedIn and Naukri prohibit automated applications
          in their Terms of Service. By using JobBlitz automation, you acknowledge
          this risk. We enforce conservative daily limits to minimize detection.
          JobBlitz is not responsible for account restrictions by third-party platforms.
        </p>
      </div>
    </div>
  );
}
