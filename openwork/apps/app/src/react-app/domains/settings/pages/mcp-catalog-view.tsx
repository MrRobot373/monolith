/** @jsxImportSource react */
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ExternalLink, Plug } from "lucide-react";

import { monolithJson } from "@/app/lib/monolith-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

type CatalogConfigField = { key: string; label: string; secret: boolean; required: boolean };

type CatalogItem = {
  id: string;
  name: string;
  category: string;
  description: string;
  docsUrl: string | null;
  notes: string | null;
  builtin: boolean;
  kind: "builtin" | "remote" | "local";
  config: CatalogConfigField[];
  enabled: boolean;
};

const CATEGORY_ORDER = [
  "office",
  "communication",
  "productivity",
  "development",
  "web",
  "cloud",
  "data",
  "business",
  "research",
  "utilities",
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  office: "Office & documents",
  communication: "Communication",
  productivity: "Projects & notes",
  development: "Development",
  web: "Web & browser",
  cloud: "Cloud & infrastructure",
  data: "Databases",
  business: "Business",
  research: "Research & search",
  utilities: "Utilities",
};

async function fetchCatalog(): Promise<CatalogItem[]> {
  const body = await monolithJson<{ ok: boolean; catalog: CatalogItem[] }>("/__monolith/mcp/catalog");
  return body.catalog;
}

function ServerCard(props: { item: CatalogItem }) {
  const { item } = props;
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["monolith-mcp-catalog"] });

  const enable = useMutation({
    mutationFn: () =>
      monolithJson("/__monolith/mcp/servers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: item.id, config: values }),
      }),
    onSuccess: () => {
      setOpen(false);
      setValues({});
      setError(null);
      invalidate();
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  const disable = useMutation({
    mutationFn: () => monolithJson(`/__monolith/mcp/servers/${item.id}`, { method: "DELETE" }),
    onSuccess: invalidate,
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  const missingRequired = item.config.some(
    (field) => field.required && !(values[field.key] ?? "").trim(),
  );

  const handleEnableClick = () => {
    if (item.config.length === 0) {
      enable.mutate();
      return;
    }
    setOpen((current) => !current);
  };

  return (
    <div className="rounded-2xl border border-dls-border bg-dls-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-dls-border bg-dls-hover">
            <Plug size={14} className="text-dls-secondary" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-semibold text-dls-text">{item.name}</span>
              <Badge variant="outline" className="text-[10px] uppercase">
                {item.kind}
              </Badge>
              {item.enabled ? (
                <Badge className="gap-1 text-[10px]">
                  <Check size={10} />
                  {t("monolith.mcp.enabled")}
                </Badge>
              ) : null}
            </div>
            <div className="mt-0.5 text-[12px] leading-relaxed text-dls-secondary">{item.description}</div>
            {item.notes ? (
              <div className="mt-1 text-[11px] text-dls-secondary/80">{item.notes}</div>
            ) : null}
            {item.docsUrl ? (
              <a
                href={item.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-[11px] text-dls-accent hover:underline"
              >
                {t("monolith.mcp.docs")}
                <ExternalLink size={10} />
              </a>
            ) : null}
          </div>
        </div>
        <div className="shrink-0">
          {item.builtin ? (
            <Badge variant="secondary" className="text-[10px]">
              {t("monolith.mcp.always_on")}
            </Badge>
          ) : item.enabled ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => disable.mutate()}
              disabled={disable.isPending}
            >
              {t("monolith.mcp.disable")}
            </Button>
          ) : (
            <Button size="sm" onClick={handleEnableClick} disabled={enable.isPending}>
              {open ? t("monolith.mcp.cancel") : t("monolith.mcp.enable")}
            </Button>
          )}
        </div>
      </div>

      {open && !item.enabled ? (
        <div className="mt-3 flex flex-col gap-2 rounded-xl border border-dls-border bg-dls-surface-muted/40 p-3">
          {item.config.map((field) => (
            <label key={field.key} className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-dls-secondary">
                {field.label}
                {field.required ? " *" : ""}
              </span>
              <Input
                type={field.secret ? "password" : "text"}
                autoComplete="off"
                value={values[field.key] ?? ""}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [field.key]: event.target.value }))
                }
              />
            </label>
          ))}
          <div className="mt-1 flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => enable.mutate()}
              disabled={enable.isPending || missingRequired}
            >
              {enable.isPending ? t("monolith.mcp.enabling") : t("monolith.mcp.enable")}
            </Button>
            <span className="text-[11px] text-dls-secondary">{t("monolith.mcp.secret_note")}</span>
          </div>
        </div>
      ) : null}

      {error ? <div className="mt-2 text-[12px] text-red-500">{error}</div> : null}
    </div>
  );
}

export function McpCatalogView() {
  const catalogQuery = useQuery({
    queryKey: ["monolith-mcp-catalog"],
    queryFn: fetchCatalog,
    retry: false,
  });

  const grouped = React.useMemo(() => {
    const byCategory = new Map<string, CatalogItem[]>();
    for (const item of catalogQuery.data ?? []) {
      const bucket = byCategory.get(item.category) ?? [];
      bucket.push(item);
      byCategory.set(item.category, bucket);
    }
    const known = CATEGORY_ORDER.filter((category) => byCategory.has(category));
    const unknown = [...byCategory.keys()].filter(
      (category) => !CATEGORY_ORDER.includes(category as (typeof CATEGORY_ORDER)[number]),
    );
    return [...known, ...unknown].map((category) => ({
      category,
      label: CATEGORY_LABELS[category] ?? category,
      items: byCategory.get(category) ?? [],
    }));
  }, [catalogQuery.data]);

  const enabledCount = (catalogQuery.data ?? []).filter((item) => item.enabled && !item.builtin).length;

  return (
    <SettingsStack>
      <Separator />
      <SettingsSection>
        <SettingsSectionHeader>
          <SettingsSectionHeaderContent>
            <SettingsSectionHeaderTitle>{t("monolith.mcp.title")}</SettingsSectionHeaderTitle>
            <SettingsSectionHeaderDescription>
              {t("monolith.mcp.subtitle")}
              {enabledCount > 0 ? ` ${t("monolith.mcp.enabled_count").replace("{count}", String(enabledCount))}` : ""}
            </SettingsSectionHeaderDescription>
          </SettingsSectionHeaderContent>
        </SettingsSectionHeader>

        {catalogQuery.isLoading ? (
          <div className="text-sm text-dls-secondary">{t("monolith.mcp.loading")}</div>
        ) : catalogQuery.isError ? (
          <SettingsNotice tone="error">{t("monolith.mcp.sidecar_missing")}</SettingsNotice>
        ) : (
          <div className="flex flex-col gap-6">
            {grouped.map((group) => (
              <div key={group.category}>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-dls-secondary">
                  {group.label}
                </div>
                <div className="flex flex-col gap-2.5">
                  {group.items.map((item) => (
                    <ServerCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            ))}
            <div className="rounded-2xl border border-dls-border bg-dls-surface-muted/40 p-4 text-[12px] text-dls-secondary">
              {t("monolith.mcp.apply_note")}
            </div>
          </div>
        )}
      </SettingsSection>
    </SettingsStack>
  );
}
