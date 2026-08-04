/** @jsxImportSource react */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Gauge, RefreshCw } from "lucide-react";

import { monolithJson } from "@/app/lib/monolith-api";
import { Button } from "@/components/ui/button";
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

type OrgUsageResponse = {
  available: boolean;
  error?: string;
  spend?: unknown;
};

async function fetchUsage(): Promise<OrgUsageResponse> {
  return monolithJson<OrgUsageResponse>("/__monolith/org/usage");
}

type SpendRow = { spend?: number; model?: string; api_key?: string };

function normalizeSpendRows(spend: unknown): SpendRow[] {
  if (Array.isArray(spend)) return spend as SpendRow[];
  if (spend && typeof spend === "object") return [spend as SpendRow];
  return [];
}

function ModelUsageBar(props: { label: string; spend: number; maxSpend: number }) {
  const pct = props.maxSpend > 0 ? Math.min(100, Math.round((props.spend / props.maxSpend) * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-32 shrink-0 truncate text-[12px] text-dls-text" title={props.label}>
        {props.label}
      </div>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-dls-surface-muted">
        <div className="h-full rounded-full bg-dls-accent" style={{ width: `${pct}%` }} />
      </div>
      <div className="w-16 shrink-0 text-right text-[12px] tabular-nums text-dls-secondary">
        ${props.spend.toFixed(2)}
      </div>
    </div>
  );
}

export function UsageView() {
  const usageQuery = useQuery({
    queryKey: ["monolith-settings-usage"],
    queryFn: fetchUsage,
    retry: false,
  });

  const rows = normalizeSpendRows(usageQuery.data?.spend);
  const total = rows.reduce((sum, row) => sum + (Number(row.spend) || 0), 0);
  const byModel = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) {
      const key = row.model?.trim() || t("monolith.usage.unlabeled_model");
      map.set(key, (map.get(key) ?? 0) + (Number(row.spend) || 0));
    }
    return [...map.entries()]
      .map(([label, spend]) => ({ label, spend }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 8);
  }, [rows]);
  const maxSpend = byModel.reduce((max, row) => Math.max(max, row.spend), 0);

  const gatewayAvailable = usageQuery.data?.available === true;

  return (
    <SettingsStack>
      <Separator />
      <SettingsSection>
        <SettingsSectionHeader>
          <SettingsSectionHeaderContent>
            <SettingsSectionHeaderTitle>{t("monolith.usage.title")}</SettingsSectionHeaderTitle>
            <SettingsSectionHeaderDescription>{t("monolith.usage.subtitle")}</SettingsSectionHeaderDescription>
          </SettingsSectionHeaderContent>
        </SettingsSectionHeader>

        {usageQuery.isLoading ? (
          <div className="text-sm text-dls-secondary">{t("monolith.usage.loading")}</div>
        ) : !gatewayAvailable ? (
          <SettingsNotice tone="error">
            {usageQuery.isError ? t("monolith.usage.sidecar_missing") : t("monolith.usage.gateway_unavailable")}
          </SettingsNotice>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between rounded-2xl border border-dls-border bg-dls-surface p-4">
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-dls-border bg-dls-hover">
                  <Gauge size={16} className="text-dls-secondary" />
                </span>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-dls-secondary">
                    {t("monolith.usage.total_spend")}
                  </div>
                  <div className="text-[20px] font-semibold text-dls-text">${total.toFixed(2)}</div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void usageQuery.refetch()}
                disabled={usageQuery.isFetching}
              >
                <RefreshCw size={13} className={usageQuery.isFetching ? "animate-spin" : undefined} />
                {t("monolith.usage.refresh")}
              </Button>
            </div>

            {byModel.length > 0 ? (
              <div className="rounded-2xl border border-dls-border bg-dls-surface p-4">
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-dls-secondary">
                  {t("monolith.usage.by_model")}
                </div>
                <div className="flex flex-col gap-2.5">
                  {byModel.map((row) => (
                    <ModelUsageBar key={row.label} label={row.label} spend={row.spend} maxSpend={maxSpend} />
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl border border-dls-border bg-dls-surface-muted/40 p-4 text-[12px] text-dls-secondary">
              {t("monolith.usage.local_note")}
            </div>
          </div>
        )}
      </SettingsSection>
    </SettingsStack>
  );
}
