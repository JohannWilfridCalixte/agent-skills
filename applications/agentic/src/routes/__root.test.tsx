import { screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderApp } from '@/test/render-app';

describe('root layout', () => {
  it('renders the main navigation', async () => {
    renderApp('/#token=abc');

    const nav = await screen.findByRole('navigation', { name: 'Main' });

    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Projects',
      'Config',
      'Install',
      'Work items',
      'History',
      'Vendoring',
    ]);
  });

  it('starts with a skip link to the main landmark', async () => {
    const user = userEvent.setup();
    renderApp('/#token=abc');
    await screen.findByRole('main');

    await user.tab();

    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveFocus();
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main');
  });

  it('asks to open the serve URL when there is no token', async () => {
    renderApp('/');

    const callout = await screen.findByRole('alert', { name: 'No access token' });

    expect(callout).toHaveTextContent('Open the URL printed by `agentic serve`');
  });

  it('shows no token warning once the URL carried a token', async () => {
    renderApp('/#token=abc');
    await screen.findByRole('main');

    expect(screen.queryByRole('alert', { name: 'No access token' })).not.toBeInTheDocument();
  });
});
