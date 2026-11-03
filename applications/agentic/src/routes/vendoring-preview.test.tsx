import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { stubFetch } from '@/test/fetch-stub';
import { renderApp } from '@/test/render-app';
import { oneProject, vendoredSkills, vendoringPreview } from '@/test/vendoring-fixtures';

/* One Radix dialog scenario per file and fireEvent inside it: happy-dom limits (see projects-remove.test.tsx). */
describe('vendoring update preview (AC22)', () => {
  it('shows the exact command for the selected skills and posts no run before confirm', async () => {
    const stub = stubFetch({
      'GET /projects': oneProject,
      'GET /vendoring/p1/status': vendoredSkills,
      'POST /vendoring/p1/preview': vendoringPreview('node scripts/vendor-skills.mjs update tdd'),
    });
    renderApp('/vendoring#token=abc', stub.fetch);

    fireEvent.click(await screen.findByRole('checkbox', { name: 'Select tdd' }));
    fireEvent.click(screen.getByRole('button', { name: 'Update selected' }));

    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByRole('code')).toHaveTextContent('node scripts/vendor-skills.mjs update tdd');
    const writes = stub.calls.filter((call) => call.method === 'POST');
    expect(writes.map((call) => [call.url, call.body])).toEqual([['/vendoring/p1/preview', { action: 'update', skills: ['tdd'] }]]);
  });
});
