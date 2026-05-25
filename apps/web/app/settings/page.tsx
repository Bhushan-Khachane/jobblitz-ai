"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    fullName: "John Doe",
    email: "john@example.com",
    dailyLimit: 50,
    autoApply: false,
    notifications: true,
  });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={settings.fullName}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, fullName: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={settings.email}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, email: e.target.value }))
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Application Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="limit">Daily Application Limit</Label>
              <Input
                id="limit"
                type="number"
                value={settings.dailyLimit}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    dailyLimit: parseInt(e.target.value) || 0,
                  }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="auto">Auto-Apply High Matches</Label>
              <Switch
                id="auto"
                checked={settings.autoApply}
                onCheckedChange={(checked) =>
                  setSettings((s) => ({ ...s, autoApply: checked }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="notifications">Email Notifications</Label>
              <Switch
                id="notifications"
                checked={settings.notifications}
                onCheckedChange={(checked) =>
                  setSettings((s) => ({ ...s, notifications: checked }))
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>
      <Button className="mt-4">Save Changes</Button>
    </div>
  );
}
