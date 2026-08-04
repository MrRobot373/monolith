/** @jsxImportSource react */
import * as React from "react";
import { AlertTriangle, LogOut, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
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
import { useMonolithAuth } from "../cloud/monolith-auth";

/** MONOLITH's account page: plain email/password sign-in and sign-up backed
 * by Supabase (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). Replaces
 * OpenWork's "Den" cloud-account flow. */
export function MonolithAccountView() {
  const auth = useMonolithAuth();
  const [mode, setMode] = React.useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);

  if (!auth.isConfigured) {
    return (
      <SettingsStack>
        <Separator />
        <SettingsSection>
          <SettingsSectionHeader>
            <SettingsSectionHeaderContent>
              <SettingsSectionHeaderTitle>{t("monolith.account.title")}</SettingsSectionHeaderTitle>
              <SettingsSectionHeaderDescription>
                {t("monolith.account.not_configured_desc")}
              </SettingsSectionHeaderDescription>
            </SettingsSectionHeaderContent>
          </SettingsSectionHeader>
          <SettingsNotice tone="error">
            <div className="flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <div>
                {t("monolith.account.not_configured_body")}
                <div className="mt-2 font-mono text-[11px]">
                  VITE_SUPABASE_URL=…
                  <br />
                  VITE_SUPABASE_PUBLISHABLE_KEY=…
                </div>
              </div>
            </div>
          </SettingsNotice>
        </SettingsSection>
      </SettingsStack>
    );
  }

  if (auth.status === "loading") {
    return (
      <SettingsStack>
        <Separator />
        <SettingsSection>
          <div className="text-sm text-dls-secondary">{t("monolith.account.loading")}</div>
        </SettingsSection>
      </SettingsStack>
    );
  }

  if (auth.isSignedIn && auth.user) {
    return (
      <SettingsStack>
        <Separator />
        <SettingsSection>
          <SettingsSectionHeader>
            <SettingsSectionHeaderContent>
              <SettingsSectionHeaderTitle>{t("monolith.account.title")}</SettingsSectionHeaderTitle>
              <SettingsSectionHeaderDescription>
                {t("monolith.account.signed_in_desc")}
              </SettingsSectionHeaderDescription>
            </SettingsSectionHeaderContent>
          </SettingsSectionHeader>

          <div className="flex items-center gap-3 rounded-2xl border border-dls-border bg-dls-surface p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-dls-accent/15 text-[14px] font-semibold uppercase text-dls-accent">
              {(auth.user.email ?? "?").charAt(0)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium text-dls-text">{auth.user.email}</div>
              <div className="text-[11px] text-dls-secondary">{t("monolith.account.signed_in_label")}</div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void auth.signOut()}
            >
              <LogOut size={13} />
              {t("monolith.account.sign_out")}
            </Button>
          </div>
        </SettingsSection>
      </SettingsStack>
    );
  }

  const submit = async () => {
    setError(null);
    setInfo(null);
    if (!email.trim() || !password) {
      setError(t("monolith.account.error_required"));
      return;
    }
    setBusy(true);
    try {
      const result =
        mode === "sign-in"
          ? await auth.signInWithPassword(email.trim(), password)
          : await auth.signUpWithPassword(email.trim(), password);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (mode === "sign-up") {
        setInfo(t("monolith.account.signup_check_email"));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsStack>
      <Separator />
      <SettingsSection>
        <SettingsSectionHeader>
          <SettingsSectionHeaderContent>
            <SettingsSectionHeaderTitle>
              {mode === "sign-in" ? t("monolith.account.signin_title") : t("monolith.account.signup_title")}
            </SettingsSectionHeaderTitle>
            <SettingsSectionHeaderDescription>
              {t("monolith.account.signed_out_desc")}
            </SettingsSectionHeaderDescription>
          </SettingsSectionHeaderContent>
        </SettingsSectionHeader>

        <form
          className="flex max-w-sm flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <Field>
            <FieldLabel htmlFor="monolith-account-email">{t("monolith.account.email_label")}</FieldLabel>
            <Input
              id="monolith-account-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
              placeholder="you@company.com"
              disabled={busy}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="monolith-account-password">{t("monolith.account.password_label")}</FieldLabel>
            <Input
              id="monolith-account-password"
              type="password"
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
              disabled={busy}
            />
            {mode === "sign-up" ? (
              <FieldDescription className="text-xs">{t("monolith.account.password_hint")}</FieldDescription>
            ) : null}
          </Field>

          {error ? <SettingsNotice tone="error">{error}</SettingsNotice> : null}
          {info ? (
            <SettingsNotice>
              <div className="flex items-start gap-2">
                <Mail size={14} className="mt-0.5 shrink-0" />
                {info}
              </div>
            </SettingsNotice>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={busy}>
              {busy
                ? t("monolith.account.working")
                : mode === "sign-in"
                  ? t("monolith.account.sign_in")
                  : t("monolith.account.sign_up")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => {
                setMode((current) => (current === "sign-in" ? "sign-up" : "sign-in"));
                setError(null);
                setInfo(null);
              }}
            >
              {mode === "sign-in" ? t("monolith.account.switch_to_signup") : t("monolith.account.switch_to_signin")}
            </Button>
          </div>
        </form>
      </SettingsSection>
    </SettingsStack>
  );
}
