import { json } from './fetch-stub';

export const oneProject = () => json({ projects: [{ createdAt: '2026-11-01T00:00:00.000Z', id: 'p1', path: '/work/agentic' }] });

export const vendoredSkills = () =>
  json({
    available: true,
    skills: [
      { name: 'tdd', ref: 'abc1234', source: 'github.com/acme/skills' },
      { name: 'grilling', ref: null, source: 'github.com/acme/other' },
    ],
  });

export const vendoringPreview = (display: string) => () => json({ command: { args: [], cli: 'node', cwd: '/work/agentic', display } });
