"use client";

import { useState } from "react";
import { LeftRail } from "./left-rail";
import { DispatchView } from "./dispatch-view";
import { TaskRail } from "./task-rail";
import { ProjectsView } from "./projects-view";
import { ScheduledView } from "./scheduled-view";
import { CustomizeView } from "./customize-view";
import { AdminView } from "./admin-view";

export type AppView = "dispatch" | "projects" | "scheduled" | "customize" | "admin";

export function AppShell() {
  const [view, setView] = useState<AppView>("dispatch");

  return (
    <div className="flex h-[85vh] min-h-[620px] flex-col overflow-hidden rounded-[22px] border border-border-soft bg-bg-primary shadow-[0_40px_90px_-40px_rgba(23,21,18,0.4)] md:grid md:h-[78vh] md:min-h-[560px] md:grid-cols-[220px_1fr] lg:grid-cols-[220px_1fr_260px]">
      <LeftRail active={view} onChange={setView} />

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 sm:p-5 md:p-6">
        {view === "dispatch" ? <DispatchView /> : null}
        {view === "projects" ? <ProjectsView /> : null}
        {view === "scheduled" ? <ScheduledView /> : null}
        {view === "customize" ? <CustomizeView /> : null}
        {view === "admin" ? <AdminView /> : null}
      </div>

      {view === "dispatch" ? (
        <div className="hidden border-l border-border-soft p-5 lg:block">
          <TaskRail />
        </div>
      ) : (
        <div className="hidden border-l border-border-soft p-5 text-[12.5px] text-text-muted lg:block">
          Task rail (Progress / Artifacts / Context) appears alongside an active session.
        </div>
      )}
    </div>
  );
}
