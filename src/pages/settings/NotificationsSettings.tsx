import { useState } from 'react';
import { getSettings, updateSettings } from '../../api/api';
import { Button, Tabs, useAction } from '../../components/ui';
import { SettingsShell } from './SettingsShell';

export function NotificationsSettings() {
  const init = getSettings().notifications;
  const [n, setN] = useState(init);
  const { run, busy } = useAction();
  const toggle = (on: boolean, onChange: (v: boolean) => void, label: string) => (
    <input type="checkbox" aria-label={label} className="h-5 w-5 accent-[#E31E43]" checked={on} onChange={(e) => onChange(e.target.checked)} />
  );
  return (
    <SettingsShell>
      <Tabs active="n" onChange={() => {}} tabs={[{ id: 'n', label: 'Notification Preferences' }]} />
      <h3 className="mb-3 text-lg font-semibold text-navy">Channels</h3>
      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        {(['email', 'sms', 'portal'] as const).map((c) => (
          <label key={c} className="flex cursor-pointer items-center justify-between rounded-card border border-line-100 px-5 py-4 text-lg text-navy">
            {c === 'sms' ? 'SMS' : c === 'portal' ? 'In-portal' : 'Email'}
            {toggle(n[c], (v) => setN({ ...n, [c]: v }), c)}
          </label>
        ))}
      </div>
      <h3 className="mb-3 text-lg font-semibold text-navy">Events</h3>
      <div className="rounded-card border border-line-100">
        {Object.entries(n.events).map(([k, v]) => (
          <label key={k} className="flex cursor-pointer items-center justify-between border-b border-line-100 px-6 py-4 last:border-0">
            <span className="text-[17px] text-navy">{k}</span>
            {toggle(v, (x) => setN({ ...n, events: { ...n.events, [k]: x } }), k)}
          </label>
        ))}
      </div>
      <Button className="mt-6" loading={busy} onClick={() => run(() => updateSettings({ notifications: n }), 'Notification preferences saved')}>
        Save preferences
      </Button>
    </SettingsShell>
  );
}
