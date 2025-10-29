"use client";

import { useEffect, useState } from "react";
import { applyGameSettings } from "./FlappyBird";

type DevSettings = {
  BASE_WIDTH: number;
  BASE_HEIGHT: number;
  BASE_PIPE_WIDTH: number;
  BASE_GAP: number;
  PIPE_INTERVAL_MS: number;
  BASE_SPEED: number;
  BASE_GRAVITY: number;
  BASE_FLAP: number;
  MAX_LEVEL: number;
  SPEED_PER_LEVEL: number;
  GRAVITY_PER_LEVEL: number;
  GAP_REDUCTION_PER_LEVEL: number;
  INTERVAL_REDUCTION_MS_PER_LEVEL: number;
  PORTAL_EXTRA_SPACING: number;
};

const DEFAULT_SETTINGS: DevSettings = {
  BASE_WIDTH: 480,
  BASE_HEIGHT: 640,
  BASE_PIPE_WIDTH: 70,
  BASE_GAP: 160,
  PIPE_INTERVAL_MS: 1400,
  BASE_SPEED: 3.5,
  BASE_GRAVITY: 0.45,
  BASE_FLAP: -8.5,
  MAX_LEVEL: 8,
  SPEED_PER_LEVEL: 0.05,
  GRAVITY_PER_LEVEL: 0.04,
  GAP_REDUCTION_PER_LEVEL: 0.02,
  INTERVAL_REDUCTION_MS_PER_LEVEL: 50,
  PORTAL_EXTRA_SPACING: 800,
};

const DEV_PASSWORD = "mrdev123";

export default function DevMenu({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<DevSettings>(DEFAULT_SETTINGS);
  const [hasChanges, setHasChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load settings from API on mount
  useEffect(() => {
    async function fetchSettings() {
      try {
        const response = await fetch("/api/settings");
        if (response.ok) {
          const data = await response.json();
          setSettings({ ...DEFAULT_SETTINGS, ...data });
        }
      } catch (error) {
        console.error("Failed to fetch settings:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchSettings();
  }, []);

  const handleChange = (key: keyof DevSettings, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      setSettings((prev) => ({ ...prev, [key]: numValue }));
      setHasChanges(true);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...settings, devPassword: DEV_PASSWORD }),
      });

      if (response.ok) {
        setHasChanges(false);
        alert("✅ Settings saved globally! All players will see the changes on their next game.");
        // Reload to apply changes
        window.location.reload();
      } else {
        const data = await response.json();
        alert(`❌ Failed to save: ${data.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Save error:", error);
      alert("❌ Network error while saving settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Reset all settings to defaults? This will affect all players globally.")) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...DEFAULT_SETTINGS, devPassword: DEV_PASSWORD }),
      });

      if (response.ok) {
        setSettings(DEFAULT_SETTINGS);
        setHasChanges(false);
        alert("✅ Settings reset to defaults globally!");
        window.location.reload();
      } else {
        const data = await response.json();
        alert(`❌ Failed to reset: ${data.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Reset error:", error);
      alert("❌ Network error while resetting settings");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-8">
          <p className="text-lg font-semibold">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b-2 border-blue-200 dark:border-blue-800 p-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
            🔧 Admin Settings
          </h2>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border-2 border-zinc-300 dark:border-zinc-600 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
          >
            Close
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Base Settings */}
          <section>
            <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400 mb-3">Base Settings</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Canvas Width</label>
                <input
                  type="number"
                  value={settings.BASE_WIDTH}
                  onChange={(e) => handleChange("BASE_WIDTH", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border-2 border-blue-200 dark:border-blue-800 bg-transparent"
                  disabled={isSaving}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Canvas Height</label>
                <input
                  type="number"
                  value={settings.BASE_HEIGHT}
                  onChange={(e) => handleChange("BASE_HEIGHT", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border-2 border-blue-200 dark:border-blue-800 bg-transparent"
                  disabled={isSaving}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Pipe Width</label>
                <input
                  type="number"
                  value={settings.BASE_PIPE_WIDTH}
                  onChange={(e) => handleChange("BASE_PIPE_WIDTH", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border-2 border-blue-200 dark:border-blue-800 bg-transparent"
                  disabled={isSaving}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Gap Height</label>
                <input
                  type="number"
                  value={settings.BASE_GAP}
                  onChange={(e) => handleChange("BASE_GAP", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border-2 border-blue-200 dark:border-blue-800 bg-transparent"
                  disabled={isSaving}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Pipe Interval (ms)</label>
                <input
                  type="number"
                  value={settings.PIPE_INTERVAL_MS}
                  onChange={(e) => handleChange("PIPE_INTERVAL_MS", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border-2 border-blue-200 dark:border-blue-800 bg-transparent"
                  disabled={isSaving}
                />
              </div>
            </div>
          </section>

          {/* Physics Settings */}
          <section>
            <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400 mb-3">Physics</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Speed</label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.BASE_SPEED}
                  onChange={(e) => handleChange("BASE_SPEED", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border-2 border-blue-200 dark:border-blue-800 bg-transparent"
                  disabled={isSaving}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Gravity</label>
                <input
                  type="number"
                  step="0.01"
                  value={settings.BASE_GRAVITY}
                  onChange={(e) => handleChange("BASE_GRAVITY", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border-2 border-blue-200 dark:border-blue-800 bg-transparent"
                  disabled={isSaving}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Flap Power (negative)</label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.BASE_FLAP}
                  onChange={(e) => handleChange("BASE_FLAP", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border-2 border-blue-200 dark:border-blue-800 bg-transparent"
                  disabled={isSaving}
                />
              </div>
            </div>
          </section>

          {/* Difficulty Scaling */}
          <section>
            <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400 mb-3">Difficulty Scaling</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Max Level</label>
                <input
                  type="number"
                  value={settings.MAX_LEVEL}
                  onChange={(e) => handleChange("MAX_LEVEL", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border-2 border-blue-200 dark:border-blue-800 bg-transparent"
                  disabled={isSaving}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Speed Per Level</label>
                <input
                  type="number"
                  step="0.01"
                  value={settings.SPEED_PER_LEVEL}
                  onChange={(e) => handleChange("SPEED_PER_LEVEL", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border-2 border-blue-200 dark:border-blue-800 bg-transparent"
                  disabled={isSaving}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Gravity Per Level</label>
                <input
                  type="number"
                  step="0.01"
                  value={settings.GRAVITY_PER_LEVEL}
                  onChange={(e) => handleChange("GRAVITY_PER_LEVEL", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border-2 border-blue-200 dark:border-blue-800 bg-transparent"
                  disabled={isSaving}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Gap Reduction Per Level</label>
                <input
                  type="number"
                  step="0.01"
                  value={settings.GAP_REDUCTION_PER_LEVEL}
                  onChange={(e) => handleChange("GAP_REDUCTION_PER_LEVEL", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border-2 border-blue-200 dark:border-blue-800 bg-transparent"
                  disabled={isSaving}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Interval Reduction (ms)</label>
                <input
                  type="number"
                  value={settings.INTERVAL_REDUCTION_MS_PER_LEVEL}
                  onChange={(e) => handleChange("INTERVAL_REDUCTION_MS_PER_LEVEL", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border-2 border-blue-200 dark:border-blue-800 bg-transparent"
                  disabled={isSaving}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Portal Extra Spacing (ms)</label>
                <input
                  type="number"
                  value={settings.PORTAL_EXTRA_SPACING}
                  onChange={(e) => handleChange("PORTAL_EXTRA_SPACING", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border-2 border-blue-200 dark:border-blue-800 bg-transparent"
                  disabled={isSaving}
                />
                <p className="text-xs text-zinc-500 mt-1">Extra time gap after every 10th pipe</p>
              </div>
            </div>
          </section>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t-2 border-blue-200 dark:border-blue-800">
            <button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold disabled:opacity-50 hover:shadow-lg transition-all"
            >
              {isSaving ? "⏳ Saving..." : "💾 Save Settings Globally"}
            </button>
            <button
              onClick={handleReset}
              disabled={isSaving}
              className="px-4 py-2.5 rounded-lg border-2 border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 font-medium hover:bg-red-50 dark:hover:bg-red-950 transition-all disabled:opacity-50"
            >
              🔄 Reset to Defaults
            </button>
          </div>

          <p className="text-xs text-zinc-500 text-center bg-yellow-50 dark:bg-yellow-950 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800">
            ⚠️ <strong>Global Admin Settings:</strong> Changes affect all players immediately. Page will reload after saving.
          </p>
        </div>
      </div>
    </div>
  );
}

// Export function to load settings from API
export async function loadDevSettings() {
  if (typeof window === "undefined") return;
  
  try {
    const response = await fetch("/api/settings");
    if (!response.ok) {
      console.error("Failed to load settings, using defaults");
      return;
    }
    const settings = await response.json() as DevSettings;
    
    // Apply settings using the setter function from FlappyBird
    applyGameSettings(settings);
  } catch (e) {
    console.error("Failed to load dev settings:", e);
  }
}
