import type { ReactNode } from 'react';

import { useId } from 'react';

import { Button, Input, Label } from '@agentic/design-system';

export interface FieldMessage {
  readonly message: string;
  readonly path: string;
}

/** Native select styled with the design-system tokens: keyboard operable and labelled like any input. */
export const SELECT_CLASS =
  'h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive';

interface ControlProps {
  readonly 'aria-describedby': string | undefined;
  readonly 'aria-invalid': boolean;
  readonly 'id': string;
}

interface FieldProps {
  readonly children: (control: ControlProps) => ReactNode;
  readonly hint?: ReactNode;
  readonly issues: readonly FieldMessage[];
  readonly label: string;
  readonly warnings?: readonly FieldMessage[];
}

interface StringListFieldProps {
  readonly issues: readonly FieldMessage[];
  readonly itemLabel: string;
  readonly label: string;
  readonly onChange: (values: readonly string[]) => void;
  readonly values: readonly string[];
}

/** A labelled control with its validation issues (AC7) and warnings (AC8) right under it, wired as its description. */
export function Field({ children, hint, issues, label, warnings = [] }: FieldProps) {
  const id = useId();
  const messagesId = useId();
  const hasMessages = issues.length > 0 || warnings.length > 0;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children({ 'aria-describedby': hasMessages ? messagesId : undefined, 'aria-invalid': issues.length > 0, id })}
      {hint !== undefined && <p className="text-xs text-muted-foreground">{hint}</p>}
      {hasMessages && (
        <div className="text-sm" id={messagesId}>
          {issues.map((issue) => (
            <p className="text-danger" key={`issue:${issue.path}:${issue.message}`}>
              {issue.message}
            </p>
          ))}
          {warnings.map((warning) => (
            <p className="text-warning" key={`warning:${warning.path}:${warning.message}`}>
              {warning.message}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/** An editable list of strings: one labelled input per item, with add and remove buttons. */
export function StringListField({ issues, itemLabel, label, onChange, values }: StringListFieldProps) {
  const legendId = useId();
  const replaceAt = (index: number, value: string) => {
    onChange(values.map((item, position) => (position === index ? value : item)));
  };

  return (
    <fieldset aria-labelledby={legendId} className="flex flex-col gap-2">
      <legend className="text-sm font-medium" id={legendId}>
        {label}
      </legend>
      {values.map((value, index) => (
        // eslint-disable-next-line react/no-array-index-key -- list items have no identity beyond their position
        <div className="flex gap-2" key={index}>
          <Input
            aria-invalid={issues.length > 0}
            aria-label={`${itemLabel} ${String(index + 1)}`}
            className="font-mono"
            onChange={(event) => {
              replaceAt(index, event.target.value);
            }}
            value={value}
          />
          <Button
            aria-label={`Remove ${itemLabel.toLowerCase()} ${String(index + 1)}`}
            onClick={() => {
              onChange(values.filter((_, position) => position !== index));
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            Remove
          </Button>
        </div>
      ))}
      <div>
        <Button
          onClick={() => {
            onChange([...values, '']);
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          Add {itemLabel.toLowerCase()}
        </Button>
      </div>
      {issues.map((issue) => (
        <p className="text-sm text-danger" key={`${issue.path}:${issue.message}`}>
          {issue.message}
        </p>
      ))}
    </fieldset>
  );
}
