import type { ProjectRegistry } from '@agentic/domain-shared';
import type { Result } from '@agentic/kernel-result';

import type { ConfigFile } from '../model/config-file.js';
import type { ReadConfigError } from '../model/errors.js';
import type { ConfigScope } from '../model/scope.js';
import type { ConfigLocation, ConfigStore } from '../ports/config-store.js';

import { err, ok } from '@agentic/kernel-result';

import { EMPTY_CONFIG_FILE, parseConfigFile } from '../model/config-file.js';
import { effective } from '../model/effective.js';
import { formatScope, parseScope } from '../model/scope.js';

export type ConfigService = ReturnType<typeof createConfigService>;

export interface ConfigServiceDependencies {
  readonly projects: ProjectRegistry;
  readonly store: ConfigStore;
}

/** One config file as read: its text (`null` when missing) and the parsed file (empty when missing). */
export interface RawConfig {
  readonly exists: boolean;
  readonly file: ConfigFile;
  readonly scope: string;
  readonly text: null | string;
}

export function createConfigService({ projects, store }: ConfigServiceDependencies) {
  const locate = async (scope: ConfigScope): Promise<Result<ConfigLocation, ReadConfigError>> => {
    if (scope.kind === 'global') return ok({ kind: 'global' });
    const project = await projects.get(scope.projectId);
    if (project === undefined) return err({ projectId: scope.projectId, type: 'project_not_found' });
    return ok({ kind: 'project', projectPath: project.path });
  };

  const readScope = async (scope: ConfigScope): Promise<Result<RawConfig, ReadConfigError>> => {
    const location = await locate(scope);
    if (!location.ok) return location;
    const scopeText = formatScope(scope);
    const read = await store.read(location.value);
    if (!read.exists) return ok({ exists: false, file: EMPTY_CONFIG_FILE, scope: scopeText, text: null });

    let json: unknown;
    try {
      json = JSON.parse(read.text);
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : 'Invalid JSON';
      return err({ detail, issues: [], reason: 'invalid_json', scope: scopeText, type: 'config_unreadable' });
    }
    const parsed = parseConfigFile(json);
    if (!parsed.ok) {
      const detail = 'The file does not match the config schema.';
      return err({ detail, issues: parsed.error, reason: 'invalid_schema', scope: scopeText, type: 'config_unreadable' });
    }
    return ok({ exists: true, file: parsed.value, scope: scopeText, text: read.text });
  };

  /** `global` or `project:<id>`. */
  const raw = async (scopeText: string) => {
    const scope = parseScope(scopeText);
    return scope.ok ? readScope(scope.value) : scope;
  };

  /** The global file alone for `global`; global under the project file for `project:<id>`. */
  const effectiveView = async (scopeText: string) => {
    const scope = parseScope(scopeText);
    if (!scope.ok) return scope;
    const project = scope.value.kind === 'project' ? await readScope(scope.value) : undefined;
    if (project?.ok === false) return project;
    const global = await readScope({ kind: 'global' });
    if (!global.ok) return global;
    return ok(effective(global.value.file, project?.value.file));
  };

  return { effective: effectiveView, raw };
}
