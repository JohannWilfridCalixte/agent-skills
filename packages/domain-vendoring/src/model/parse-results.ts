import type { VendoredSkill } from './manifest.js';

export interface SkillResult {
  readonly detail: string;
  readonly name: string;
  readonly status: SkillStatus;
}

export type SkillStatus = 'drift' | 'error' | 'ok';

const VERIFY_OK = /^ok (\S+)$/;
const VERIFY_FAIL = /^FAIL (\S+): (.*)$/;
const CHECK_SKILL = /^ {2}(\S+): (.*)$/;
const CHECK_UP_TO_DATE = /^(\S+): (up to date .*)$/;
const SCRIPT_ERROR = /^error: (.*)$/;

const checkStatus = (detail: string): SkillStatus => {
  if (detail === 'unchanged') return 'ok';
  return detail === 'missing upstream' ? 'error' : 'drift';
};

/**
 * Per-skill results from the output lines of `vendor-skills.mjs check` or `verify`. When the script aborted
 * (`error: …`), every skill it did not report gets that error.
 */
export function parseResults(lines: readonly string[], skills: readonly VendoredSkill[]) {
  const results = lines.flatMap((line) => lineResults(line, skills));
  const failure = lines.map((line) => SCRIPT_ERROR.exec(line)?.[1]).find((message) => message !== undefined);
  if (failure === undefined) return results;
  const unreported = skills.filter((skill) => !results.some((result) => result.name === skill.name));
  return [...results, ...unreported.map((skill): SkillResult => ({ detail: failure, name: skill.name, status: 'error' }))];
}

function lineResults(line: string, skills: readonly VendoredSkill[]): readonly SkillResult[] {
  const verifyOk = VERIFY_OK.exec(line);
  if (verifyOk?.[1] !== undefined) return [{ detail: '', name: verifyOk[1], status: 'ok' }];
  const verifyFail = VERIFY_FAIL.exec(line);
  if (verifyFail?.[1] !== undefined) return [{ detail: verifyFail[2] ?? '', name: verifyFail[1], status: 'drift' }];
  const checked = CHECK_SKILL.exec(line);
  if (checked?.[1] !== undefined) {
    const detail = checked[2] ?? '';
    return [{ detail, name: checked[1], status: checkStatus(detail) }];
  }
  const upToDate = CHECK_UP_TO_DATE.exec(line);
  if (upToDate?.[1] !== undefined) {
    const detail = upToDate[2] ?? '';
    return skills.filter((skill) => skill.source === upToDate[1]).map((skill) => ({ detail, name: skill.name, status: 'ok' as const }));
  }
  return [];
}
