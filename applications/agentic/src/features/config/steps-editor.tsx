import type { EffectiveConfigResponse, EffectiveStep, Harness } from '@agentic/contract-http/config';
import type { ModelsResponse } from '@agentic/contract-http/install';

import type { ConfigForm, StepForm } from './edited-config';
import type { FieldMessage } from './form-fields';

import { useId } from 'react';

import { Input } from '@agentic/design-system';

import { HARNESSES } from './edited-config';
import { Field, SELECT_CLASS } from './form-fields';

const EFFORTS = ['low', 'medium', 'high'] as const;

interface HarnessStepsProps {
  readonly effective: Readonly<Record<string, EffectiveStep>>;
  readonly harness: Harness;
  readonly messagesFor: StepsEditorProps['messagesFor'];
  readonly models: ModelsResponse | undefined;
  readonly onChange: (key: string, step: StepForm) => void;
  readonly steps: Readonly<Record<string, StepForm>>;
}

interface StepsEditorProps {
  readonly effective: EffectiveConfigResponse['config']['steps'];
  readonly messagesFor: (path: string) => { readonly issues: readonly FieldMessage[]; readonly warnings: readonly FieldMessage[] };
  readonly models: Readonly<Partial<Record<Harness, ModelsResponse>>>;
  readonly onChange: (harness: Harness, key: string, step: StepForm) => void;
  readonly steps: ConfigForm['steps'];
}

/** Model and effort per harness × step key; blank inherits the value shown as placeholder. */
export function StepsEditor({ effective, messagesFor, models, onChange, steps }: StepsEditorProps) {
  return (
    <div className="flex flex-col gap-6">
      {HARNESSES.map((harness) => (
        <HarnessSteps
          effective={effective[harness]}
          harness={harness}
          key={harness}
          messagesFor={messagesFor}
          models={models[harness]}
          onChange={(key, step) => {
            onChange(harness, key, step);
          }}
          steps={steps[harness] ?? {}}
        />
      ))}
    </div>
  );
}

function HarnessSteps({ effective, harness, messagesFor, models, onChange, steps }: HarnessStepsProps) {
  const listId = useId();
  const keys = [...new Set([...Object.keys(effective), ...Object.keys(steps)])].sort();
  const ids = models?.available === true ? models.ids : undefined;

  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border p-4">
      <legend className="px-1 text-sm font-semibold">{harness}</legend>
      {models?.available === false && (
        <p className="text-sm text-muted-foreground">
          Model list unavailable for {harness}: {models.reason}. Type a model id.
        </p>
      )}
      {ids !== undefined && (
        <datalist id={listId}>
          {ids.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </datalist>
      )}
      {keys.length === 0 && <p className="text-sm text-muted-foreground">No steps for {harness}.</p>}
      {keys.map((key) => {
        const step = steps[key] ?? { effort: '', model: '' };
        const modelPath = `steps.${harness}.${key}.model`;
        const effortPath = `steps.${harness}.${key}.effort`;
        const efforts = step.effort === '' || (EFFORTS as readonly string[]).includes(step.effort) ? EFFORTS : [...EFFORTS, step.effort];
        return (
          <div className="grid gap-3 sm:grid-cols-[10rem_1fr_10rem] sm:items-start" key={key}>
            <span className="pt-7 font-mono text-sm">{key}</span>
            <Field {...messagesFor(modelPath)} label={`Model for ${harness} ${key}`}>
              {(control) => (
                <Input
                  {...control}
                  className="font-mono"
                  list={ids === undefined ? undefined : listId}
                  onChange={(event) => {
                    onChange(key, { ...step, model: event.target.value });
                  }}
                  placeholder={effective[key]?.model?.value ?? 'inherit'}
                  value={step.model}
                />
              )}
            </Field>
            <Field {...messagesFor(effortPath)} label={`Effort for ${harness} ${key}`}>
              {(control) => (
                <select
                  {...control}
                  className={SELECT_CLASS}
                  onChange={(event) => {
                    onChange(key, { ...step, effort: event.target.value });
                  }}
                  value={step.effort}
                >
                  <option value="">Inherit ({effective[key]?.effort?.value ?? 'none'})</option>
                  {efforts.map((effort) => (
                    <option key={effort} value={effort}>
                      {effort}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
        );
      })}
    </fieldset>
  );
}
