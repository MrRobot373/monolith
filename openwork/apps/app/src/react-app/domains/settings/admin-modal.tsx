/** @jsxImportSource react */
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Users, Wallet } from "lucide-react";

import { monolithJson } from "@/app/lib/monolith-api";
import { t } from "@/i18n";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * MONOLITH: config-driven org administration (v1). Backed by the sidecar's
 * org.json — capability toggles are recorded here and applied at workspace
 * provisioning time; usage proxies LiteLLM spend when the gateway is present
 * (Docker stack). Single-user native deployments simply see themselves.
 */
type OrgConfig = {
  productName: string;
  capabilities: { webSearch: boolean; approvalMode: string };
  members: Array<{ name: string; role?: string }>;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  return monolithJson<T>("/__monolith/org" + path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
  });
}

type AdminModalProps = {
  open: boolean;
  onClose: () => void;
};

function SectionTitle({ icon: Icon, children }: { icon: typeof Users; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-dls-secondary">
      <Icon className="size-3.5" aria-hidden />
      {children}
    </div>
  );
}

export function AdminModal(props: AdminModalProps) {
  const queryClient = useQueryClient();
  const orgQuery = useQuery({
    queryKey: ["monolith-org"],
    enabled: props.open,
    retry: false,
    queryFn: () => api<{ org: OrgConfig }>(""),
  });
  const usageQuery = useQuery({
    queryKey: ["monolith-org-usage"],
    enabled: props.open,
    retry: false,
    queryFn: () => api<{ available: boolean; spend?: unknown; error?: string }>("/usage"),
  });

  const patch = useMutation({
    mutationFn: (payload: Partial<OrgConfig>) => api("", { method: "PATCH", body: JSON.stringify(payload) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["monolith-org"] }),
  });

  const org = orgQuery.data?.org;
  const spendTotal = (() => {
    const spend = usageQuery.data?.spend as Array<{ spend?: number }> | { spend?: number } | undefined;
    if (Array.isArray(spend)) return spend.reduce((sum, row) => sum + (Number(row?.spend) || 0), 0);
    if (spend && typeof spend === "object") return Number(spend.spend) || 0;
    return null;
  })();

  return (
    <Dialog open={props.open} onOpenChange={(open) => { if (!open) props.onClose(); }}>
      <DialogContent className="flex max-h-[80vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("monolith.admin.title")}</DialogTitle>
          <DialogDescription>{t("monolith.admin.subtitle")}</DialogDescription>
        </DialogHeader>
        {orgQuery.isError ? (
          <div className="rounded-xl border border-amber-7/40 bg-amber-2/40 px-3 py-3 text-[12px] text-amber-11">
            {t("monolith.sched.sidecar_missing")}
          </div>
        ) : org ? (
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pr-1">
            <section className="flex flex-col gap-2.5">
              <SectionTitle icon={ShieldCheck}>{t("monolith.admin.capabilities")}</SectionTitle>
              <label className="flex items-center justify-between gap-3 rounded-xl border border-dls-border bg-dls-surface px-3 py-2.5">
                <span>
                  <span className="block text-[13px] font-medium text-dls-text">{t("monolith.admin.web_search")}</span>
                  <span className="block text-[11px] text-dls-secondary">{t("monolith.admin.web_search_hint")}</span>
                </span>
                <input
                  type="checkbox"
                  checked={org.capabilities.webSearch}
                  onChange={(event) => patch.mutate({ capabilities: { ...org.capabilities, webSearch: event.target.checked } })}
                  className="size-4 accent-[var(--dls-accent)]"
                />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-xl border border-dls-border bg-dls-surface px-3 py-2.5">
                <span>
                  <span className="block text-[13px] font-medium text-dls-text">{t("monolith.admin.approval_mode")}</span>
                  <span className="block text-[11px] text-dls-secondary">{t("monolith.admin.approval_mode_hint")}</span>
                </span>
                <select
                  value={org.capabilities.approvalMode}
                  onChange={(event) => patch.mutate({ capabilities: { ...org.capabilities, approvalMode: event.target.value } })}
                  className="rounded-lg border border-dls-border bg-dls-surface px-2 py-1 text-[13px] text-dls-text"
                >
                  <option value="manual">{t("monolith.admin.approval_manual")}</option>
                  <option value="auto">{t("monolith.admin.approval_auto")}</option>
                </select>
              </label>
              <p className="text-[11px] text-dls-secondary">{t("monolith.admin.capabilities_note")}</p>
            </section>

            <section className="flex flex-col gap-2.5">
              <SectionTitle icon={Users}>{t("monolith.admin.members")}</SectionTitle>
              {org.members.length === 0 ? (
                <p className="text-[12px] text-dls-secondary">{t("monolith.admin.members_empty")}</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {org.members.map((member, index) => (
                    <li key={`${member.name}-${index}`} className="flex items-center justify-between rounded-lg border border-dls-border px-3 py-1.5 text-[13px]">
                      <span className="text-dls-text">{member.name}</span>
                      <span className="text-[11px] uppercase tracking-wide text-dls-secondary">{member.role || "member"}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[11px] text-dls-secondary">{t("monolith.admin.members_note")}</p>
            </section>

            <section className="flex flex-col gap-2.5">
              <SectionTitle icon={Wallet}>{t("monolith.admin.usage")}</SectionTitle>
              {usageQuery.data?.available && spendTotal !== null ? (
                <div className="rounded-xl border border-dls-border bg-dls-surface-muted/50 px-3 py-2.5">
                  <div className="text-[11px] uppercase tracking-wide text-dls-secondary">{t("monolith.admin.total_spend")}</div>
                  <div className="text-[18px] font-semibold text-dls-text">${spendTotal.toFixed(2)}</div>
                </div>
              ) : (
                <p className="text-[12px] text-dls-secondary">{t("monolith.admin.usage_unavailable")}</p>
              )}
            </section>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
