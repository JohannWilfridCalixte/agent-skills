import type { ProjectRegistry, RunService } from '@agentic/domain-shared';

import type { VendorCommandError, VendorRequest } from '../model/commands.js';
import type { MalformedVendorFile } from '../model/manifest.js';
import type { VendorSource } from '../ports/vendor-source.js';

import { err, ok } from '@agentic/kernel-result';

import { runSummary, vendorCommand } from '../model/commands.js';
import { parseManifest } from '../model/manifest.js';
import { parseResults } from '../model/parse-results.js';

/** Why a vendoring request is refused: mapped to 404 / 409 / 422 by the route. */
export type VendoringError =
  | MalformedVendorFile
  | VendorCommandError
  | { readonly id: string; readonly type: 'run_not_found' }
  | { readonly issues: readonly string[]; readonly type: 'invalid_run' }
  | { readonly projectId: string; readonly type: 'no_vendor_file' }
  | { readonly projectId: string; readonly type: 'unknown_project' };

export type VendoringService = ReturnType<typeof createVendoringService>;

export interface VendoringServiceDependencies {
  readonly projects: ProjectRegistry;
  readonly runs: RunService;
  readonly source: VendorSource;
}

/** Vendored skills of a known project: list, and check/verify/update as on-demand runs (AC21, AC22). */
export function createVendoringService({ projects, runs, source }: VendoringServiceDependencies) {
  /** `undefined` skills: the project has no `vendor.json`. */
  const load = async (projectId: string) => {
    const project = await projects.get(projectId);
    if (project === undefined) return err({ projectId, type: 'unknown_project' } satisfies VendoringError);
    const manifest = await source.read(project.path, 'vendor.json');
    if (manifest === undefined) return ok({ project, skills: undefined });
    const skills = parseManifest(manifest, await source.read(project.path, 'vendor.lock.json'));
    return skills.ok ? ok({ project, skills: skills.value }) : skills;
  };

  const loadVendored = async (projectId: string) => {
    const loaded = await load(projectId);
    if (!loaded.ok) return loaded;
    const { project, skills } = loaded.value;
    return skills === undefined ? err({ projectId, type: 'no_vendor_file' } satisfies VendoringError) : ok({ project, skills });
  };

  const plan = async (projectId: string, request: VendorRequest) => {
    const loaded = await loadVendored(projectId);
    if (!loaded.ok) return loaded;
    const command = vendorCommand(request, loaded.value.skills, loaded.value.project.path);
    return command.ok ? ok({ command: command.value, project: loaded.value.project }) : command;
  };

  return {
    async preview(projectId: string, request: VendorRequest) {
      const planned = await plan(projectId, request);
      return planned.ok ? ok(planned.value.command) : planned;
    },

    /** Per-skill results parsed from a run's buffered output; partial while it is still running. */
    async results(projectId: string, runId: string) {
      const loaded = await loadVendored(projectId);
      if (!loaded.ok) return loaded;
      const run = runs.get(runId);
      if (!run.ok) return err({ id: runId, type: 'run_not_found' } satisfies VendoringError);
      return ok({ results: parseResults(run.value.output, loaded.value.skills), runId, status: run.value.status });
    },

    async start(projectId: string, request: VendorRequest) {
      const planned = await plan(projectId, request);
      if (!planned.ok) return planned;
      const started = runs.start({ ...planned.value.command, scope: `project:${planned.value.project.id}`, summary: runSummary(request) });
      return started.ok ? started : err({ issues: started.error.issues, type: 'invalid_run' } satisfies VendoringError);
    },

    async status(projectId: string) {
      const loaded = await load(projectId);
      if (!loaded.ok) return loaded;
      const { skills } = loaded.value;
      return ok(skills === undefined ? { available: false as const } : { available: true as const, skills });
    },
  };
}
