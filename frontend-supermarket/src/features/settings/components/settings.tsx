'use client'

import { useEffect, useState } from 'react'
import {
  CheckCircle,
  ChevronRight,
  Clock,
  Database,
  Globe,
  Info,
  Loader2,
  Monitor,
  Moon,
  Package,
  Palette,
  Save,
  Settings,
  Shield,
  Sun,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { healthApi } from '@/lib/api'
import { showSuccess } from '@/lib/errors'

type TabId = 'general' | 'preferences' | 'system'

const TABS: Array<{
  id: TabId
  label: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'preferences', label: 'Preferences', icon: Palette },
  { id: 'system', label: 'System Info', icon: Info },
]

export function SettingsSection() {
  const [activeTab, setActiveTab] = useState<TabId>('general')
  const [health, setHealth] = useState<{
    status: string
    uptime: number
    timestamp: string
  } | null>(null)

  useEffect(() => {
    healthApi
      .check()
      .then(setHealth)
      .catch(() => {})
  }, [])

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-foreground">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure your inventory management system
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto scrollbar-thin pb-px">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
                isActive
                  ? 'bg-emerald-100 text-emerald-700 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          )
        })}
      </div>

      <div className="min-h-[50vh]">
        {activeTab === 'general' && <GeneralSettings />}
        {activeTab === 'preferences' && <PreferencesSettings />}
        {activeTab === 'system' && <SystemInfo health={health} />}
      </div>
    </div>
  )
}

// ── General Settings ──────────────────────────────────────────

const SETTINGS_KEY = 'supermarket-settings'
const NOTIF_PREFS_KEY = 'supermarket-notification-prefs'

interface GeneralSettingsData {
  appName: string
  currency: string
  timezone: string
}

const NOTIFICATION_ITEMS = [
  {
    key: 'lowStock',
    label: 'Low Stock Alerts',
    desc: 'Notify when products fall below minimum stock level',
    default: true,
  },
  {
    key: 'outOfStock',
    label: 'Out of Stock Alerts',
    desc: 'Notify when products run out of stock entirely',
    default: true,
  },
  {
    key: 'overstock',
    label: 'Overstock Warnings',
    desc: 'Notify when products exceed maximum stock level',
    default: false,
  },
  {
    key: 'expiry',
    label: 'Expiry Alerts',
    desc: 'Notify when tracked products are nearing expiry',
    default: true,
  },
] as const

type NotifKey = (typeof NOTIFICATION_ITEMS)[number]['key']

function loadSettings(): GeneralSettingsData {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw)
      return {
        ...{
          appName: 'SuperMarket Inventory ERP',
          currency: 'INR',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        ...JSON.parse(raw),
      }
  } catch {
    /* ignore */
  }
  return {
    appName: 'SuperMarket Inventory ERP',
    currency: 'INR',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }
}

function loadNotifPrefs(): Record<NotifKey, boolean> {
  try {
    const raw = localStorage.getItem(NOTIF_PREFS_KEY)
    if (raw)
      return {
        ...{ lowStock: true, outOfStock: true, overstock: false, expiry: true },
        ...JSON.parse(raw),
      }
  } catch {
    /* ignore */
  }
  return { lowStock: true, outOfStock: true, overstock: false, expiry: true }
}

function GeneralSettings() {
  const [initial] = useState(loadSettings)
  const [appName, setAppName] = useState(initial.appName)
  const [currency, setCurrency] = useState(initial.currency)
  const [timezone, setTimezone] = useState(initial.timezone)
  const [saving, setSaving] = useState(false)
  const [notifPrefs, setNotifPrefs] =
    useState<Record<NotifKey, boolean>>(loadNotifPrefs)

  const toggleNotif = (key: NotifKey) => {
    setNotifPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      try {
        localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const handleSave = () => {
    setSaving(true)
    const data: GeneralSettingsData = { appName, currency, timezone }
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(data))
    } catch {
      /* ignore */
    }
    setSaving(false)
    showSuccess(
      'Settings saved',
      'General settings have been saved and will persist on reload.',
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Business Info */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-1 h-5 rounded-full bg-emerald-500" />
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Business Information
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Business Name
            </label>
            <input
              type="text"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              className="w-full h-9 px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Currency
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full h-9 px-3 border border-input rounded-md text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
            >
              <option value="INR">₹ INR (Indian Rupee)</option>
              <option value="USD">$ USD (US Dollar)</option>
              <option value="EUR">€ EUR (Euro)</option>
              <option value="GBP">£ GBP (British Pound)</option>
              <option value="AED">د.إ AED (UAE Dirham)</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full h-9 px-3 border border-input rounded-md text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
            >
              {Intl.supportedValuesOf('timeZone').map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Notification Preferences */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-1 h-5 rounded-full bg-blue-500" />
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Notifications
          </h3>
        </div>
        <div className="space-y-3">
          {NOTIFICATION_ITEMS.map((item) => (
            <label
              key={item.key}
              className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-muted-foreground/30 transition-all cursor-pointer group"
            >
              <input
                type="checkbox"
                checked={notifPrefs[item.key]}
                onChange={() => toggleNotif(item.key)}
                className="mt-0.5 rounded border-input text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <p className="text-xs font-medium text-foreground group-hover:text-emerald-700 transition-colors">
                  {item.label}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {item.desc}
                </p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white px-5 py-2 rounded-lg text-sm font-medium hover:from-emerald-700 hover:to-emerald-600 transition-all disabled:opacity-50 shadow-sm"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          <Save className="w-4 h-4" />
          Save Settings
        </button>
      </div>
    </div>
  )
}

// ── Preferences ────────────────────────────────────────────────

function PreferencesSettings() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="max-w-2xl space-y-6">
      {/* Theme */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-1 h-5 rounded-full bg-purple-500" />
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Appearance
          </h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Choose how the application looks. Changes apply immediately.
        </p>

        <div className="grid grid-cols-3 gap-3">
          {[
            {
              value: 'light' as const,
              icon: Sun,
              label: 'Light',
              desc: 'Light mode for daytime use',
            },
            {
              value: 'dark' as const,
              icon: Moon,
              label: 'Dark',
              desc: 'Dark mode for reduced eye strain',
            },
            {
              value: 'system' as const,
              icon: Monitor,
              label: 'System',
              desc: 'Follow your system preference',
            },
          ].map((opt) => {
            const Icon = opt.icon
            const isActive = theme === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                  isActive
                    ? 'bg-emerald-50 border-emerald-300 shadow-sm'
                    : 'bg-card border-border hover:border-muted-foreground/30 hover:bg-muted/20'
                }`}
              >
                <Icon
                  className={`w-6 h-6 ${isActive ? 'text-emerald-600' : 'text-muted-foreground'}`}
                />
                <div className="text-center">
                  <p
                    className={`text-xs font-medium ${isActive ? 'text-emerald-700' : 'text-foreground'}`}
                  >
                    {opt.label}
                  </p>
                  <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">
                    {opt.desc}
                  </p>
                </div>
                {isActive && (
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Layout Defaults */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-1 h-5 rounded-full bg-sky-500" />
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Default Form Layout
          </h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Choose how forms open by default. You can change this anytime from the
          header dropdown.
        </p>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
          <Palette className="w-4 h-4 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Use the <strong>Form Layout</strong> dropdown in the header (next to
            the search bar) to switch between Modal, Inline, and Side Panel
            modes.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── System Info ────────────────────────────────────────────────

function SystemInfo({
  health,
}: {
  health: { status: string; uptime: number; timestamp: string } | null
}) {
  const rows = [
    { label: 'Application', value: 'SuperMarket Inventory ERP', icon: Package },
    { label: 'Version', value: '1.0.0', icon: Info },
    { label: 'Frontend', value: 'React 19 + TanStack Router', icon: Globe },
    { label: 'Backend', value: 'Node.js + Express + SQLite', icon: Database },
    {
      label: 'API Status',
      value: health?.status ?? 'Checking...',
      icon: Shield,
    },
    {
      label: 'Server Uptime',
      value: health?.uptime ? `${Math.round(health.uptime / 60)} min` : '—',
      icon: Clock,
    },
    {
      label: 'Last Check',
      value: health?.timestamp
        ? new Date(health.timestamp).toLocaleString()
        : '—',
      icon: Clock,
    },
  ]

  return (
    <div className="max-w-2xl">
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-1 h-5 rounded-full bg-slate-500" />
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            System Information
          </h3>
        </div>

        <div className="space-y-1">
          {rows.map((row) => {
            const Icon = row.icon
            return (
              <div
                key={row.label}
                className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/30 transition-colors"
              >
                <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground min-w-[120px]">
                  {row.label}
                </span>
                <ChevronRight className="w-3 h-3 text-muted-foreground/30" />
                <span className="text-xs font-medium text-foreground">
                  {row.value}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
