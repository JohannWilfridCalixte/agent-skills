import type { Project } from '@agentic/contract-http/projects';

import { useId } from 'react';

import { SELECT_CLASS } from '@/features/config/form-fields';
import { Label } from '@agentic/design-system';

interface ProjectSelectProps {
  /** Adds a `Global` option whose value is `global`; project options are then `project:<id>`. */
  readonly includeGlobal?: boolean;
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly projects: readonly Project[];
  readonly value: string;
}

/** A labelled native select over the known projects (keyboard operable as is, AC27). */
export function ProjectSelect({ includeGlobal = false, label, onChange, projects, value }: ProjectSelectProps) {
  const selectId = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={selectId}>{label}</Label>
      <select
        className={`${SELECT_CLASS} max-w-md`}
        id={selectId}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        value={value}
      >
        {includeGlobal && <option value="global">Global</option>}
        {projects.map((project) => (
          <option key={project.id} value={includeGlobal ? `project:${project.id}` : project.id}>
            {project.path}
          </option>
        ))}
      </select>
    </div>
  );
}
