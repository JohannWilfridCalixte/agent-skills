import type { ComponentProps } from 'react';

import type { ConfigPreviewResponse, ConfigSaveResponse, EffectiveConfigResponse, Harness, RawConfigResponse } from '@agentic/contract-http/config';

import type { ConfigForm, ProfileForm, StepForm } from './edited-config';
import type { FieldMessage } from './form-fields';

import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useApi } from '@/lib/api-context';
import { describeApiError, unwrap } from '@/lib/api-error';
import { ConfigPreviewResponse as PreviewSchema, ConfigSaveResponse as SaveSchema } from '@agentic/contract-http/config';
import { ModelsResponse } from '@agentic/contract-http/install';
import { Button, Callout, DiffViewer, Input } from '@agentic/design-system';

import { configPath, formFromRaw, HARNESSES, toEditedConfig } from './edited-config';
import { Field, SELECT_CLASS, StringListField } from './form-fields';
import { StepsEditor } from './steps-editor';

interface ConfigEditorProps {
  readonly effective: EffectiveConfigResponse['config'];
  readonly raw: RawConfigResponse;
  readonly scope: string;
}

const EMPTY_MESSAGES = { issues: [], warnings: [] } as const;

const matches = (path: string) => (message: FieldMessage) => message.path === path || message.path.startsWith(`${path}.`);

/** Edit → review (preview diff, issues, warnings) → save (AC4); the browser writes only through the API. */
export function ConfigEditor({ effective, raw, scope }: ConfigEditorProps) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ConfigForm>(() => formFromRaw(raw.config));
  const scopePath = configPath(scope);

  const models = useQueries({
    queries: HARNESSES.map((harness) => ({
      queryFn: async ({ signal }: { readonly signal: AbortSignal }) => unwrap(await api.get(`/models?harness=${harness}`, ModelsResponse, { signal })),
      queryKey: ['models', harness],
      staleTime: Infinity,
    })),
  });
  const modelsByHarness: Partial<Record<Harness, ModelsResponse>> = {};
  for (const query of models) if (query.data !== undefined) modelsByHarness[query.data.harness] = query.data;

  const preview = useMutation({
    mutationFn: async (edited: Readonly<Record<string, unknown>>) => api.post(`${scopePath}/preview`, edited, PreviewSchema),
  });
  const save = useMutation({
    mutationFn: async (edited: Readonly<Record<string, unknown>>) => api.put(scopePath, edited, SaveSchema),
    onSuccess: async (result) => {
      if (result.ok) await queryClient.invalidateQueries({ queryKey: ['config', scope] });
    },
  });

  const reviewed = preview.data?.ok === true ? preview.data.value : undefined;
  const failure = [preview.data, save.data].find((result) => result !== undefined && !result.ok);

  const editForm = (update: (current: ConfigForm) => ConfigForm) => {
    setForm(update);
    preview.reset();
    save.reset();
  };
  const messagesFor = (path: string) =>
    reviewed === undefined ? EMPTY_MESSAGES : { issues: reviewed.issues.filter(matches(path)), warnings: reviewed.warnings.filter(matches(path)) };
  const setStep = (harness: Harness, key: string, step: StepForm) => {
    editForm((current) => ({ ...current, steps: { ...current.steps, [harness]: { ...current.steps[harness], [key]: step } } }));
  };
  const limitKeys = [...new Set([...Object.keys(effective.limits), ...Object.keys(form.limits)])].sort();

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        preview.mutate(toEditedConfig(raw.config, form));
      }}
    >
      {!raw.exists && <Callout tone="info">This config file does not exist yet; saving creates it.</Callout>}

      <section aria-label="General" className="grid gap-4 sm:grid-cols-2">
        <Field {...messagesFor('output')} label="Output folder">
          {(control) => (
            <TextInput
              {...control}
              onChange={(output) => {
                editForm((current) => ({ ...current, output }));
              }}
              placeholder={effective.output.value}
              value={form.output}
            />
          )}
        </Field>
        <Field {...messagesFor('worktrees')} label="Worktrees folder">
          {(control) => (
            <TextInput
              {...control}
              onChange={(worktrees) => {
                editForm((current) => ({ ...current, worktrees }));
              }}
              placeholder={effective.worktrees.value}
              value={form.worktrees}
            />
          )}
        </Field>
        <Field {...messagesFor('knowledge.root')} label="Knowledge root">
          {(control) => (
            <TextInput
              {...control}
              onChange={(knowledgeRoot) => {
                editForm((current) => ({ ...current, knowledgeRoot }));
              }}
              placeholder={effective.knowledge.root.value}
              value={form.knowledgeRoot}
            />
          )}
        </Field>
        <Field {...messagesFor('commitWork')} label="Commit work">
          {(control) => (
            <select
              {...control}
              className={SELECT_CLASS}
              onChange={(event) => {
                const commitWork = event.target.value === 'true' ? 'true' : event.target.value === 'false' ? 'false' : 'inherit';
                editForm((current) => ({ ...current, commitWork }));
              }}
              value={form.commitWork}
            >
              <option value="inherit">Inherit ({String(effective.commitWork.value)})</option>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          )}
        </Field>
      </section>

      <StringListField
        issues={messagesFor('selectedProfiles').issues}
        itemLabel="Selected profile"
        label="Selected profiles"
        onChange={(selectedProfiles) => {
          editForm((current) => ({ ...current, selectedProfiles }));
        }}
        values={form.selectedProfiles}
      />
      <StringListField
        issues={messagesFor('reviewers').issues}
        itemLabel="Reviewer"
        label="Reviewers"
        onChange={(reviewers) => {
          editForm((current) => ({ ...current, reviewers }));
        }}
        values={form.reviewers}
      />
      <ProfilesField
        issues={messagesFor('profiles').issues}
        onChange={(profiles) => {
          editForm((current) => ({ ...current, profiles }));
        }}
        profiles={form.profiles}
      />

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-medium">Limits</legend>
        {limitKeys.map((key) => (
          <Field key={key} {...messagesFor(`limits.${key}`)} label={`Limit ${key}`}>
            {(control) => (
              <Input
                {...control}
                inputMode="numeric"
                min={0}
                onChange={(event) => {
                  editForm((current) => ({ ...current, limits: { ...current.limits, [key]: event.target.value } }));
                }}
                placeholder={String(effective.limits[key]?.value ?? '')}
                type="number"
                value={form.limits[key] ?? ''}
              />
            )}
          </Field>
        ))}
      </fieldset>

      <section aria-label="Steps" className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Steps</h2>
        <StepsEditor effective={effective.steps} messagesFor={messagesFor} models={modelsByHarness} onChange={setStep} steps={form.steps} />
      </section>

      <div className="flex gap-2">
        <Button disabled={preview.isPending} type="submit" variant="outline">
          Review changes
        </Button>
        <Button
          disabled={reviewed === undefined || reviewed.issues.length > 0 || save.isPending}
          onClick={() => {
            save.mutate(toEditedConfig(raw.config, form));
          }}
          type="button"
        >
          Save
        </Button>
      </div>

      {failure?.ok === false && (
        <Callout title="Request failed" tone="error">
          {describeApiError(failure.error).message} {describeApiError(failure.error).nextStep}
        </Callout>
      )}
      {reviewed !== undefined && <ReviewPanel preview={reviewed} />}
      {save.data?.ok === true && <SavedNotice saved={save.data.value} />}
    </form>
  );
}

function MessageList({ label, messages }: { readonly label: string; readonly messages: readonly FieldMessage[] }) {
  return (
    <ul aria-label={label} className="list-disc pl-5">
      {messages.map((message) => (
        <li key={`${message.path}:${message.message}`}>
          <code>{message.path}</code>: {message.message}
        </li>
      ))}
    </ul>
  );
}

function ProfilesField({ issues, onChange, profiles }: { readonly issues: readonly FieldMessage[]; readonly onChange: (profiles: readonly ProfileForm[]) => void; readonly profiles: readonly ProfileForm[] }) {
  const update = (index: number, patch: Partial<ProfileForm>) => {
    onChange(profiles.map((profile, position) => (position === index ? { ...profile, ...patch } : profile)));
  };

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-medium">Profiles</legend>
      {profiles.map((profile, index) => {
        const number = String(index + 1);
        return (
          // eslint-disable-next-line react/no-array-index-key -- profiles are edited in place; position is their identity here
          <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-start" key={index}>
            <Field issues={issues.filter(matches(`profiles.${String(index)}.name`))} label={`Profile ${number} name`}>
              {(control) => (
                <TextInput
                  {...control}
                  onChange={(name) => {
                    update(index, { name });
                  }}
                  value={profile.name}
                />
              )}
            </Field>
            <StringListField
              issues={issues.filter(matches(`profiles.${String(index)}.detect`))}
              itemLabel={`Profile ${number} detect glob`}
              label={`Profile ${number} detect globs`}
              onChange={(detect) => {
                update(index, { detect });
              }}
              values={profile.detect}
            />
            <StringListField
              issues={issues.filter(matches(`profiles.${String(index)}.skills`))}
              itemLabel={`Profile ${number} skill`}
              label={`Profile ${number} skills`}
              onChange={(skills) => {
                update(index, { skills });
              }}
              values={profile.skills}
            />
            <Button
              aria-label={`Remove profile ${number}`}
              onClick={() => {
                onChange(profiles.filter((_, position) => position !== index));
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              Remove
            </Button>
          </div>
        );
      })}
      <div>
        <Button
          onClick={() => {
            onChange([...profiles, { detect: [], name: '', raw: {}, skills: [] }]);
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          Add profile
        </Button>
      </div>
      {issues
        .filter((issue) => issue.path === 'profiles')
        .map((issue) => (
          <p className="text-sm text-danger" key={issue.message}>
            {issue.message}
          </p>
        ))}
    </fieldset>
  );
}

function ReviewPanel({ preview }: { readonly preview: ConfigPreviewResponse }) {
  return (
    <section aria-label="Review" className="flex flex-col gap-3">
      {preview.issues.length > 0 && (
        <Callout title="Fix these issues before saving" tone="error">
          <MessageList label="Validation issues" messages={preview.issues} />
        </Callout>
      )}
      {preview.warnings.length > 0 && (
        <Callout title="Warnings" tone="warning">
          <MessageList label="Warnings" messages={preview.warnings} />
        </Callout>
      )}
      {preview.unknownKeys.length > 0 && (
        <Callout title="Unknown keys kept" tone="info">
          <ul aria-label="Unknown keys in this file" className="list-disc pl-5">
            {preview.unknownKeys.map((key) => (
              <li key={key}>
                <code>{key}</code>: possibly stale, kept as is.
              </li>
            ))}
          </ul>
        </Callout>
      )}
      {preview.issues.length === 0 && <DiffViewer label="Proposed changes" lines={preview.diff.map((line) => ({ text: line.text, type: line.kind }))} />}
    </section>
  );
}

function SavedNotice({ saved }: { readonly saved: ConfigSaveResponse }) {
  return (
    <Callout title={saved.changed ? 'Saved' : 'No change'} tone="info">
      <p>{saved.changed ? 'Config saved.' : 'Nothing changed: the file already holds this config.'}</p>
    </Callout>
  );
}

function TextInput({ onChange, ...props }: Omit<ComponentProps<typeof Input>, 'onChange'> & { readonly onChange: (value: string) => void }) {
  return (
    <Input
      {...props}
      className="font-mono"
      onChange={(event) => {
        onChange(event.target.value);
      }}
    />
  );
}
