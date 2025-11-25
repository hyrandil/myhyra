import { PasswordChangeCard } from './PasswordChangeCard';
import { PreferencesCard } from './PreferencesCard';
import { FlexBalanceCard } from './FlexBalanceCard';

export function SettingsPanel() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <PreferencesCard />
      <PasswordChangeCard />
      <FlexBalanceCard />
    </div>
  );
}
