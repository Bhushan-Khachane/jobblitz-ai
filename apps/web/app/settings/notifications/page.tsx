"use client";

import { useEffect, useState } from "react";
import { Bell, Mail, Sparkles, MessageSquare, Megaphone, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { notificationsAPI } from "@/lib/api";

export default function NotificationSettingsPage() {
  const [prefs, setPrefs] = useState({
    emailNotifications: true,
    digestFrequency: "daily",
    followUpEnabled: true,
    applicationUpdates: true,
    marketing: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    notificationsAPI
      .preferences()
      .then((data) => {
        if (data) {
          setPrefs({
            emailNotifications: data.emailNotifications ?? true,
            digestFrequency: data.digestFrequency ?? "daily",
            followUpEnabled: data.followUpEnabled ?? true,
            applicationUpdates: data.applicationUpdates ?? true,
            marketing: data.marketing ?? false,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await notificationsAPI.updatePreferences({
        email_notifications: prefs.emailNotifications,
        digest_frequency: prefs.digestFrequency,
        follow_up_enabled: prefs.followUpEnabled,
        application_updates: prefs.applicationUpdates,
        marketing: prefs.marketing,
      } as Record<string, unknown>);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      alert("Failed to save preferences.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Notification Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            Email Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="emailNotifications">Enable email notifications</Label>
              <p className="text-sm text-muted-foreground">Receive emails about your applications and jobs.</p>
            </div>
            <Switch
              id="emailNotifications"
              checked={prefs.emailNotifications}
              onCheckedChange={(checked) => setPrefs((p) => ({ ...p, emailNotifications: checked }))}
            />
          </div>

          <div className="space-y-3">
            <Label>Digest frequency</Label>
            <div className="flex gap-3">
              {(["daily", "weekly", "none"] as const).map((freq) => (
                <button
                  key={freq}
                  onClick={() => setPrefs((p) => ({ ...p, digestFrequency: freq }))}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    prefs.digestFrequency === freq
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-muted-foreground"
                  }`}
                >
                  {freq.charAt(0).toUpperCase() + freq.slice(1)}
                </button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">How often we send you a summary of new jobs and application updates.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            Application Updates
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="applicationUpdates">Application status updates</Label>
              <p className="text-sm text-muted-foreground">Get notified when an application status changes.</p>
            </div>
            <Switch
              id="applicationUpdates"
              checked={prefs.applicationUpdates}
              onCheckedChange={(checked) => setPrefs((p) => ({ ...p, applicationUpdates: checked }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="followUpEnabled">Follow-up reminders</Label>
              <p className="text-sm text-muted-foreground">Remind me to follow up on applications with no response after 7 days.</p>
            </div>
            <Switch
              id="followUpEnabled"
              checked={prefs.followUpEnabled}
              onCheckedChange={(checked) => setPrefs((p) => ({ ...p, followUpEnabled: checked }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-primary" />
            Marketing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="marketing">Product updates and offers</Label>
              <p className="text-sm text-muted-foreground">Occasional emails about new features and special offers.</p>
            </div>
            <Switch
              id="marketing"
              checked={prefs.marketing}
              onCheckedChange={(checked) => setPrefs((p) => ({ ...p, marketing: checked }))}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Saving...
            </>
          ) : (
            "Save Preferences"
          )}
        </Button>
        {saved && (
          <span className="text-sm text-green-600 font-medium">Saved!</span>
        )}
      </div>
    </div>
  );
}
