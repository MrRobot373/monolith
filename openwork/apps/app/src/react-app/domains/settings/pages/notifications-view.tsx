/** @jsxImportSource react */
import * as React from "react";

import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { t } from "@/i18n";
import {
  SettingsNotice,
  SettingsSection,
  SettingsSectionHeader,
  SettingsSectionHeaderContent,
  SettingsSectionHeaderDescription,
  SettingsSectionHeaderTitle,
  SettingsStack,
} from "../settings-section";
import {
  getNotificationPrefs,
  requestBrowserPushPermission,
  setNotificationPref,
  useNotificationPrefs,
  type NotificationPrefs,
} from "../notification-preferences";

function NotificationRow(props: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-dls-text">{props.title}</div>
        <div className="mt-0.5 max-w-[52ch] text-[12px] text-dls-secondary">{props.description}</div>
      </div>
      <Switch
        checked={props.checked}
        disabled={props.disabled}
        onCheckedChange={(checked) => props.onCheckedChange(checked === true)}
        className="mt-0.5 shrink-0"
      />
    </div>
  );
}

export function NotificationsView() {
  const prefs = useNotificationPrefs();
  const [pushPermission, setPushPermission] = React.useState<NotificationPermission | "unsupported">(
    () => (typeof Notification === "undefined" ? "unsupported" : Notification.permission),
  );

  const setPref = <K extends keyof NotificationPrefs>(key: K, value: NotificationPrefs[K]) => {
    setNotificationPref(key, value);
  };

  const handlePushToggle = async (checked: boolean) => {
    if (checked && pushPermission !== "granted") {
      const result = await requestBrowserPushPermission();
      setPushPermission(result);
      if (result !== "granted") return;
    }
    setPref("browserPush", checked);
  };

  return (
    <SettingsStack>
      <Separator />
      <SettingsSection>
        <SettingsSectionHeader>
          <SettingsSectionHeaderContent>
            <SettingsSectionHeaderTitle>{t("monolith.notifications.title")}</SettingsSectionHeaderTitle>
            <SettingsSectionHeaderDescription>
              {t("monolith.notifications.subtitle")}
            </SettingsSectionHeaderDescription>
          </SettingsSectionHeaderContent>
        </SettingsSectionHeader>

        <div className="divide-y divide-dls-border rounded-2xl border border-dls-border bg-dls-surface px-4">
          <NotificationRow
            title={t("monolith.notifications.task_completed_title")}
            description={t("monolith.notifications.task_completed_desc")}
            checked={prefs.taskCompleted}
            onCheckedChange={(checked) => setPref("taskCompleted", checked)}
          />
          <NotificationRow
            title={t("monolith.notifications.needs_input_title")}
            description={t("monolith.notifications.needs_input_desc")}
            checked={prefs.needsInput}
            onCheckedChange={(checked) => setPref("needsInput", checked)}
          />
          <NotificationRow
            title={t("monolith.notifications.scheduled_failures_title")}
            description={t("monolith.notifications.scheduled_failures_desc")}
            checked={prefs.scheduledFailures}
            onCheckedChange={(checked) => setPref("scheduledFailures", checked)}
          />
          <NotificationRow
            title={t("monolith.notifications.browser_push_title")}
            description={
              pushPermission === "denied"
                ? t("monolith.notifications.browser_push_blocked")
                : t("monolith.notifications.browser_push_desc")
            }
            checked={prefs.browserPush && pushPermission === "granted"}
            disabled={pushPermission === "denied" || pushPermission === "unsupported"}
            onCheckedChange={(checked) => void handlePushToggle(checked)}
          />
        </div>

        {pushPermission === "denied" ? (
          <SettingsNotice tone="error">{t("monolith.notifications.browser_push_blocked_hint")}</SettingsNotice>
        ) : null}
      </SettingsSection>
    </SettingsStack>
  );
}

// Re-exported so callers (e.g. session-page's background-task watcher) can
// check the current preference without subscribing to the store.
export { getNotificationPrefs };
