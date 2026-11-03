import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { json, stubFetch } from '@/test/fetch-stub';
import { renderApp } from '@/test/render-app';
import { oneProject, vendoredSkills } from '@/test/vendoring-fixtures';

describe('vendoring page (AC21)', () => {
  it('explains that a project without vendor.json has nothing to vendor', async () => {
    renderApp('/vendoring', stubFetch({ 'GET /projects': oneProject, 'GET /vendoring/p1/status': () => json({ available: false }) }).fetch);

    expect(await screen.findByText('This project has no vendor.json')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Check' })).not.toBeInTheDocument();
  });

  it('lists vendored skills with source and pinned ref', async () => {
    renderApp('/vendoring', stubFetch({ 'GET /projects': oneProject, 'GET /vendoring/p1/status': vendoredSkills }).fetch);

    const row = await screen.findByRole('row', { name: 'tdd' });
    expect(row).toHaveTextContent('github.com/acme/skills');
    expect(row).toHaveTextContent('abc1234');
    expect(screen.getByRole('row', { name: 'grilling' })).toHaveTextContent('Not pinned');
  });

  it('requires a selection before updating selected skills', async () => {
    renderApp('/vendoring', stubFetch({ 'GET /projects': oneProject, 'GET /vendoring/p1/status': vendoredSkills }).fetch);

    const update = await screen.findByRole('button', { name: 'Update selected' });
    expect(update).toBeDisabled();

    fireEvent.click(within(screen.getByRole('row', { name: 'tdd' })).getByRole('checkbox', { name: 'Select tdd' }));

    expect(update).toBeEnabled();
  });

  it('asks to add a project when none is known', async () => {
    renderApp('/vendoring', stubFetch({ 'GET /projects': () => json({ projects: [] }) }).fetch);

    expect(await screen.findByText('No projects yet')).toBeInTheDocument();
  });
});
