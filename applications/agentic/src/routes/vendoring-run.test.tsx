import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { json, stubFetch } from '@/test/fetch-stub';
import { runSummary, sseResponse } from '@/test/install-fixtures';
import { renderApp } from '@/test/render-app';
import { oneProject, vendoredSkills, vendoringPreview } from '@/test/vendoring-fixtures';

/* One Radix dialog scenario per file and fireEvent inside it: happy-dom limits (see projects-remove.test.tsx). */
describe('vendoring verify run (AC22)', () => {
  it('confirms, streams the run and then shows per-skill results', async () => {
    const stub = stubFetch({
      'GET /projects': oneProject,
      'GET /runs/run-1/events': () =>
        sseResponse([
          { line: 'verifying tdd', type: 'stdout' },
          { exitCode: 0, type: 'exit' },
          { status: 'succeeded', type: 'status' },
        ]),
      'GET /vendoring/p1/runs/run-1/results': () =>
        json({
          results: [
            { detail: 'matches pin', name: 'tdd', status: 'ok' },
            { detail: 'SKILL.md differs', name: 'grilling', status: 'drift' },
          ],
          runId: 'run-1',
          status: 'succeeded',
        }),
      'GET /vendoring/p1/status': vendoredSkills,
      'POST /vendoring/p1/preview': vendoringPreview('node scripts/vendor-skills.mjs verify'),
      'POST /vendoring/p1/runs': () => json(runSummary('running'), 201),
    });
    renderApp('/vendoring#token=abc', stub.fetch);

    fireEvent.click(await screen.findByRole('button', { name: 'Verify' }));
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByRole('code');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Run on this machine' }));

    const results = await screen.findByRole('table', { name: 'Skill results' });
    expect(within(results).getByRole('row', { name: 'grilling' })).toHaveTextContent('drift');
    expect(within(results).getByRole('row', { name: 'grilling' })).toHaveTextContent('SKILL.md differs');
    expect(within(results).getByRole('row', { name: 'tdd' })).toHaveTextContent('ok');
    expect(screen.getByRole('log', { name: 'Run output' })).toHaveTextContent('verifying tdd');
    expect(stub.calls.find((call) => call.url === '/vendoring/p1/runs')?.body).toEqual({ action: 'verify', confirm: true });
  });
});
