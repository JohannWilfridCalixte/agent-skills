import type { ConfigOrigin, EffectiveConfigResponse } from '@agentic/contract-http/config';

import { Badge, Callout, Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@agentic/design-system';

import { HARNESSES } from './edited-config';

interface EffectiveRow {
  readonly origin: ConfigOrigin;
  readonly path: string;
  readonly value: string;
}

const ORIGIN_VARIANTS = {
  default: 'neutral',
  global: 'info',
  project: 'purple',
} as const satisfies Record<ConfigOrigin, 'info' | 'neutral' | 'purple'>;

const showList = (values: readonly string[]) => (values.length === 0 ? '(none)' : values.join(', '));

/** Every effective field with where its value comes from (AC3); unknown keys flagged as possibly stale (AC6). */
export function EffectiveView({ effective, scopeLabel }: { readonly effective: EffectiveConfigResponse; readonly scopeLabel: string }) {
  return (
    <div className="flex flex-col gap-4">
      {effective.unknownKeys.length > 0 && (
        <Callout title="Unknown keys" tone="warning">
          <ul aria-label="Unknown keys" className="list-disc pl-5">
            {effective.unknownKeys.map((key) => (
              <li key={`${key.scope}:${key.path}`}>
                <code>{key.path}</code> in the {key.scope} file: possibly stale, kept as is.
              </li>
            ))}
          </ul>
        </Callout>
      )}
      <Table>
        <TableCaption>Effective config for {scopeLabel}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Field</TableHead>
            <TableHead scope="col">Value</TableHead>
            <TableHead scope="col">Origin</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {toRows(effective).map((row) => (
            <TableRow key={row.path}>
              <TableHead className="font-mono" scope="row">
                {row.path}
              </TableHead>
              <TableCell className="font-mono break-all whitespace-normal">{row.value}</TableCell>
              <TableCell>
                <OriginBadge origin={row.origin} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function OriginBadge({ origin }: { readonly origin: ConfigOrigin }) {
  return (
    <Badge aria-label={`Origin: ${origin}`} variant={ORIGIN_VARIANTS[origin]}>
      {origin}
    </Badge>
  );
}

function toRows({ config }: EffectiveConfigResponse) {
  const rows: EffectiveRow[] = [
    { origin: config.output.origin, path: 'output', value: config.output.value },
    { origin: config.commitWork.origin, path: 'commitWork', value: String(config.commitWork.value) },
    { origin: config.worktrees.origin, path: 'worktrees', value: config.worktrees.value },
    { origin: config.knowledge.root.origin, path: 'knowledge.root', value: config.knowledge.root.value },
    { origin: config.selectedProfiles.origin, path: 'selectedProfiles', value: showList(config.selectedProfiles.value) },
    { origin: config.reviewers.origin, path: 'reviewers', value: showList(config.reviewers.value) },
    { origin: config.profiles.origin, path: 'profiles', value: showList(config.profiles.value.map((profile) => profile.name)) },
  ];
  for (const [key, limit] of Object.entries(config.limits)) rows.push({ origin: limit.origin, path: `limits.${key}`, value: String(limit.value) });
  for (const harness of HARNESSES) {
    for (const [key, step] of Object.entries(config.steps[harness])) {
      const prefix = `steps.${harness}.${key}`;
      if (step.harness !== undefined) rows.push({ origin: step.harness.origin, path: `${prefix}.harness`, value: step.harness.value });
      if (step.model !== undefined) rows.push({ origin: step.model.origin, path: `${prefix}.model`, value: step.model.value });
      if (step.effort !== undefined) rows.push({ origin: step.effort.origin, path: `${prefix}.effort`, value: step.effort.value });
    }
  }
  return rows;
}
