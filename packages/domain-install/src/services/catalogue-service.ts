import type { Command, ProjectRegistry, RunService } from '@agentic/domain-shared';

import type { CatalogueRequest, InstallAction, InstallMethod, InstallScope } from '../model/catalogue.js';
import type { Harness } from '../model/harness.js';
import type { ParsedStatus } from '../model/parse-status.js';
import type { HarnessEnvironment } from '../ports/harness-environment.js';

import { err, ok } from '@agentic/kernel-result';

import { catalogueCommands, CURSOR_CLONE_FOLDER, cursorCloneDirectory, displayCommand } from '../model/catalogue.js';
import { HARNESS_FOLDER } from '../model/harness.js';
import { parseClaudePluginList, parseCodexPluginList, parseGitHead, parseSkillsList } from '../model/parse-status.js';

export type CatalogueService = ReturnType<typeof createCatalogueService>;

export interface CatalogueServiceDependencies {
  readonly environment: HarnessEnvironment;
  readonly projects: ProjectRegistry;
  readonly runs: RunService;
  /** Server-known home; the Cursor clone lives under it (never a client-supplied path). */
  readonly userHome: string;
}

/** Why an install request is refused: mapped to 404 / 409 / 422 by the route. */
export type InstallError =
  | { readonly issues: readonly string[]; readonly type: 'invalid_run' }
  | { readonly projectId: string; readonly type: 'unknown_project' }
  | { readonly reason: string; readonly type: 'method_unavailable' }
  | { readonly reason: string; readonly type: 'unsupported' };

export interface InstallRequest extends CatalogueRequest {
  /** A known project id; required for project scope. */
  readonly projectId?: string;
}

export interface InstallStatusEntry {
  /** False when the method is not offered on this machine (cursor clone without `~/.cursor`). */
  readonly available: boolean;
  readonly harness?: Harness;
  readonly method: InstallMethod;
  readonly reason?: string;
  readonly scope?: InstallScope;
  readonly state: ParsedStatus['state'];
  /** Only when the tool itself reports it (AC12). */
  readonly updateAvailable?: boolean;
  readonly version?: string;
}

export interface StatusQuery {
  readonly projectId?: string;
  readonly scope: InstallScope;
}

const ACTION_LABEL = { 'install': 'Install', 'marketplace-add': 'Add marketplace for', 'update': 'Update' } as const satisfies Record<InstallAction, string>;

/** Preview, run and status for the closed install catalogue (D34). Status runs only when asked (AC11). */
export function createCatalogueService({ environment, projects, runs, userHome }: CatalogueServiceDependencies) {
  const resolveProject = async (scope: InstallScope, projectId: string | undefined) => {
    if (scope === 'global') return ok(undefined);
    if (projectId === undefined) return err({ reason: 'project scope needs a projectId', type: 'unsupported' } satisfies InstallError);
    const project = await projects.get(projectId);
    return project === undefined ? err({ projectId, type: 'unknown_project' } satisfies InstallError) : ok(project);
  };

  const plan = async (request: InstallRequest) => {
    const project = await resolveProject(request.scope, request.projectId);
    if (!project.ok) return project;
    if (request.method === 'clone' && !(await environment.homeFolderExists(HARNESS_FOLDER.cursor))) {
      return err({ reason: '~/.cursor missing: the cursor clone is not offered on this machine', type: 'method_unavailable' } satisfies InstallError);
    }
    const commands = catalogueCommands(request, { userHome, ...(project.value === undefined ? {} : { projectPath: project.value.path }) });
    if (!commands.ok) return commands;
    return ok({ commands: commands.value, project: project.value });
  };

  const statusOf = async (command: Command, parse: (stdout: string) => ParsedStatus) => {
    const output = await environment.exec(command);
    return output.ok ? parse(output.value) : ({ reason: `${displayCommand(command)} failed: ${output.error.reason}`, state: 'unknown' } satisfies ParsedStatus);
  };

  const cursorStatus = async () => {
    if (!(await environment.homeFolderExists(HARNESS_FOLDER.cursor))) return { available: false, reason: '~/.cursor missing', state: 'not_installed' } as const;
    if (!(await environment.homeFolderExists(CURSOR_CLONE_FOLDER))) return { available: true, state: 'not_installed' } as const;
    return { available: true, ...(await statusOf({ args: ['-C', cursorCloneDirectory(userHome), 'rev-parse', '--short', 'HEAD'], cli: 'git' }, parseGitHead)) };
  };

  return {
    async preview(request: InstallRequest) {
      const planned = await plan(request);
      return planned.ok ? ok(planned.value.commands) : planned;
    },

    async start(request: InstallRequest, { correlationId }: { readonly correlationId?: string } = {}) {
      const planned = await plan(request);
      if (!planned.ok) return planned;
      const [first, ...next] = planned.value.commands;
      if (first === undefined) return err({ reason: 'no command', type: 'unsupported' } satisfies InstallError);
      const project = planned.value.project;
      const started = runs.start({
        ...first,
        ...(correlationId === undefined ? {} : { correlationId }),
        ...(next.length === 0 ? {} : { next }),
        scope: project === undefined ? 'global' : `project:${project.id}`,
        summary: `${ACTION_LABEL[request.action]} ${targetLabel(request, project?.path)}`,
      });
      return started.ok ? started : err({ issues: started.error.issues, type: 'invalid_run' } satisfies InstallError);
    },

    /** Runs every status command once, now; callers refresh by asking again. */
    async status({ projectId, scope }: StatusQuery) {
      const project = await resolveProject(scope, projectId);
      if (!project.ok) return project;
      const skillsCommand: Command =
        project.value === undefined ? { args: ['skills', 'list', '-g', '--json'], cli: 'npx' } : { args: ['skills', 'list', '--json'], cli: 'npx', cwd: project.value.path };
      const [claude, codex, cursor, skills] = await Promise.all([
        statusOf({ args: ['plugin', 'list', '--json'], cli: 'claude' }, parseClaudePluginList),
        statusOf({ args: ['plugin', 'list'], cli: 'codex' }, parseCodexPluginList),
        cursorStatus(),
        statusOf(skillsCommand, parseSkillsList),
      ]);
      const entries: readonly InstallStatusEntry[] = [
        { available: true, harness: 'claude', method: 'plugin', ...claude },
        { available: true, harness: 'codex', method: 'plugin', ...codex },
        { harness: 'cursor', method: 'clone', ...cursor },
        { available: true, method: 'skills', scope, ...skills },
      ];
      return ok(entries);
    },
  };
}

function targetLabel({ harness, method, scope }: CatalogueRequest, projectPath: string | undefined) {
  if (method === 'skills') return scope === 'project' && projectPath !== undefined ? `skills CLI (project ${projectPath})` : 'skills CLI (global)';
  return `${harness ?? ''} ${method}`.trim();
}
