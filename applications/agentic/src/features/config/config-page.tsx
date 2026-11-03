import { useId, useState } from 'react';

import { useApi } from '@/lib/api-context';
import { startScope } from '@/lib/start-scope';
import { useListQuery } from '@/lib/use-list-query';
import { EffectiveConfigResponse, RawConfigResponse } from '@agentic/contract-http/config';
import { ProjectList } from '@agentic/contract-http/projects';
import { Label, ListState, PageHeader, Tabs, TabsContent, TabsList, TabsTrigger } from '@agentic/design-system';

import { ConfigEditor } from './config-editor';
import { configPath } from './edited-config';
import { EffectiveView } from './effective-view';
import { SELECT_CLASS } from './form-fields';

const GLOBAL_SCOPE = 'global';

export function ConfigPage() {
  const api = useApi();
  const scopeId = useId();
  const [scope, setScope] = useState(startScope);
  const [tab, setTab] = useState('effective');
  const projects = useListQuery(['projects'], async (signal) => api.get('/projects', ProjectList, { signal }));
  const scopePath = configPath(scope);
  const effective = useListQuery(['config', scope, 'effective'], async (signal) => api.get(`${scopePath}/effective`, EffectiveConfigResponse, { signal }));
  const raw = useListQuery(['config', scope, 'raw'], async (signal) => api.get(scopePath, RawConfigResponse, { signal }));

  const projectList = projects.query.data?.projects ?? [];
  const scopeLabel = scope === GLOBAL_SCOPE ? 'Global' : (projectList.find((project) => `project:${project.id}` === scope)?.path ?? scope);

  return (
    <>
      <PageHeader description="Global and project configuration: where each value comes from, and a reviewed editor." title="Config" />
      <div className="mb-4 flex flex-col gap-1.5">
        <Label htmlFor={scopeId}>Scope</Label>
        <select
          className={`${SELECT_CLASS} max-w-md`}
          id={scopeId}
          onChange={(event) => {
            setScope(event.target.value);
          }}
          value={scope}
        >
          <option value={GLOBAL_SCOPE}>Global</option>
          {projectList.map((project) => (
            <option key={project.id} value={`project:${project.id}`}>
              {project.path}
            </option>
          ))}
        </select>
      </div>
      <Tabs onValueChange={setTab} value={tab}>
        <TabsList aria-label="Config views">
          <TabsTrigger value="effective">Effective</TabsTrigger>
          <TabsTrigger value="edit">Edit</TabsTrigger>
        </TabsList>
        <TabsContent value="effective">
          {effective.query.isPending && <ListState label="Loading effective config" status="loading" />}
          {effective.failure !== undefined && (
            <ListState message={effective.failure.message} nextStep={effective.failure.nextStep} onRetry={() => void effective.query.refetch()} status="error" />
          )}
          {effective.query.data !== undefined && <EffectiveView effective={effective.query.data} scopeLabel={scopeLabel} />}
        </TabsContent>
        {/* Kept mounted so switching tabs never drops unsaved edits. */}
        <TabsContent forceMount hidden={tab !== 'edit'} value="edit">
          {(raw.query.isPending || effective.query.isPending) && <ListState label="Loading config file" status="loading" />}
          {raw.failure !== undefined && <ListState message={raw.failure.message} nextStep={raw.failure.nextStep} onRetry={() => void raw.query.refetch()} status="error" />}
          {raw.query.data !== undefined && effective.query.data !== undefined && (
            <ConfigEditor effective={effective.query.data.config} key={scope} raw={raw.query.data} scope={scope} />
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
