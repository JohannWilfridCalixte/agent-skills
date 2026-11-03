import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  Button,
  Callout,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  DiffViewer,
  EmptyState,
  Input,
  Label,
  ListState,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from './index';

describe('Dialog', () => {
  it('opens from the keyboard and closes on Escape, returning focus to the trigger', async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Restore</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Restore config</DialogTitle>
          <DialogDescription>This replaces the current file.</DialogDescription>
        </DialogContent>
      </Dialog>,
    );

    await user.tab();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('dialog', { name: 'Restore config' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore' })).toHaveFocus();
  });
});

describe('Tabs', () => {
  it('moves between tabs with the arrow keys', async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="global">
        <TabsList aria-label="Config scope">
          <TabsTrigger value="global">Global</TabsTrigger>
          <TabsTrigger value="project">Project</TabsTrigger>
        </TabsList>
        <TabsContent value="global">Global settings</TabsContent>
        <TabsContent value="project">Project settings</TabsContent>
      </Tabs>,
    );

    await user.tab();
    await user.keyboard('{ArrowRight}');

    expect(screen.getByRole('tab', { name: 'Project' })).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Project settings');
  });
});

describe('Select', () => {
  it('is reachable by keyboard and named by its label', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Label htmlFor="harness">Harness</Label>
        <Select defaultValue="claude">
          <SelectTrigger id="harness">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="claude">Claude</SelectItem>
            <SelectItem value="codex">Codex</SelectItem>
          </SelectContent>
        </Select>
      </>,
    );

    await user.tab();

    expect(screen.getByRole('combobox', { name: 'Harness' })).toHaveFocus();
  });
});

describe('Label', () => {
  it('names the input it is associated with', () => {
    render(
      <>
        <Label htmlFor="model">Model</Label>
        <Input id="model" />
      </>,
    );

    expect(screen.getByRole('textbox', { name: 'Model' })).toBeInTheDocument();
  });
});

describe('DiffViewer', () => {
  it('marks added and removed lines with a text prefix, not colour only', () => {
    render(
      <DiffViewer
        label="Changes to config.json"
        lines={[
          { text: '{', type: 'context' },
          { text: '"model": "old"', type: 'removed' },
          { text: '"model": "new"', type: 'added' },
        ]}
      />,
    );

    const items = within(screen.getByRole('list', { name: 'Changes to config.json' })).getAllByRole('listitem');

    expect(items.map((item) => item.textContent)).toEqual(['Unchanged:   {', 'Removed: - "model": "old"', 'Added: + "model": "new"']);
  });

  it('says when there is nothing to compare', () => {
    render(<DiffViewer label="Changes" lines={[]} />);

    expect(screen.getByText('No changes.')).toBeInTheDocument();
  });
});

describe('ListState', () => {
  it('announces loading', () => {
    render(<ListState label="Loading projects" status="loading" />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading projects');
  });

  it('shows the empty title and its next step', () => {
    render(<ListState description="Add a project to edit its config." status="empty" title="No projects yet" />);

    expect(screen.getByRole('heading', { name: 'No projects yet' })).toBeInTheDocument();
    expect(screen.getByText('Add a project to edit its config.')).toBeInTheDocument();
  });

  it('shows the error with a next step and retries on demand', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ListState message="Cannot reach the server." nextStep="Start it with `agentic serve`." onRetry={onRetry} status="error" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Cannot reach the server.');
    expect(screen.getByRole('alert')).toHaveTextContent('Start it with `agentic serve`.');

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe('Callout', () => {
  it('renders an error callout as an alert with its title', () => {
    render(
      <Callout title="Missing token" tone="error">
        Open the URL printed by agentic serve.
      </Callout>,
    );

    expect(screen.getByRole('alert', { name: 'Missing token' })).toHaveTextContent('Open the URL printed by agentic serve.');
  });

  it('renders info as a note', () => {
    render(<Callout tone="info">Heads up</Callout>);

    expect(screen.getByRole('note')).toHaveTextContent('Heads up');
  });
});

describe('PageHeader and EmptyState', () => {
  it('render their headings', () => {
    render(
      <>
        <PageHeader description="Known projects" title="Projects" />
        <EmptyState description="Nothing here." title="Empty" />
      </>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Projects' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Empty' })).toBeInTheDocument();
  });
});
