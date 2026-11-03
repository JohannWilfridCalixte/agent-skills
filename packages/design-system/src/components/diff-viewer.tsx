import { cn } from '../lib/cn';

export interface DiffLine {
  readonly text: string;
  readonly type: 'added' | 'context' | 'removed';
}

/** Each line carries a visible `+`/`-` prefix and a screen-reader word, so the diff never relies on colour alone. */
const LINE_STYLES = {
  added: { className: 'bg-success/10 text-foreground', prefix: '+ ', spoken: 'Added:' },
  context: { className: 'text-muted-foreground', prefix: '  ', spoken: 'Unchanged:' },
  removed: { className: 'bg-danger/10 text-foreground', prefix: '- ', spoken: 'Removed:' },
} as const satisfies Record<DiffLine['type'], { readonly className: string; readonly prefix: string; readonly spoken: string }>;

interface DiffViewerProps {
  readonly className?: string;
  readonly label: string;
  readonly lines: readonly DiffLine[];
}

export function DiffViewer({ className, label, lines }: DiffViewerProps) {
  if (lines.length === 0) return <p className="text-sm text-muted-foreground">No changes.</p>;

  return (
    <ol aria-label={label} className={cn('overflow-x-auto rounded-lg border bg-card py-2 font-mono text-sm', className)}>
      {lines.map((line, index) => {
        const style = LINE_STYLES[line.type];
        return (
          // eslint-disable-next-line react/no-array-index-key -- diff lines have no identity beyond their position
          <li className={cn('px-3 whitespace-pre', style.className)} key={index}>
            <span className="sr-only">{style.spoken} </span>
            <span aria-hidden className="select-none">
              {style.prefix}
            </span>
            {line.text}
          </li>
        );
      })}
    </ol>
  );
}
