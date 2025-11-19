import { PasswordChangeCard } from './PasswordChangeCard';
import { PreferencesCard } from './PreferencesCard';

export function SettingsPanel() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <PreferencesCard />
      <PasswordChangeCard />
    </div>
  );
}
