import type { Context, Hono } from 'hono';

import type { WorkItemDetail, WorkItemDoc, WorkItemList } from '@agentic/contract-http/work-items';
import type { WorkItemDocError, WorkItemsService } from '@agentic/domain-work-items';

import type { AppEnv } from '../../platform/app-env.js';

import { problem } from '../../platform/problem.js';

/** Mounted under `/api/projects`; GET only (AC19): any other verb falls through to the 404 handler. */
export function registerWorkItemsRoutes(app: Hono<AppEnv>, service: WorkItemsService) {
  app.get('/:projectId/work-items', async (c) => {
    const listed = await service.list(c.req.param('projectId'));
    if (!listed.ok) return workItemsProblem(c, listed.error);
    return c.json({ items: [...listed.value] } satisfies WorkItemList);
  });

  app.get('/:projectId/work-items/:slug', async (c) => {
    const found = await service.detail(c.req.param('projectId'), c.req.param('slug'));
    if (!found.ok) return workItemsProblem(c, found.error);
    const { timeline, ...rest } = found.value;
    return c.json({ ...rest, docs: [...rest.docs], timeline: { ...timeline, events: [...timeline.events] } } satisfies WorkItemDetail);
  });

  app.get('/:projectId/work-items/:slug/docs/:name', async (c) => {
    const found = await service.doc(c.req.param('projectId'), c.req.param('slug'), c.req.param('name'));
    if (!found.ok) return workItemsProblem(c, found.error);
    return c.json(found.value satisfies WorkItemDoc);
  });
}

function workItemsProblem(c: Context<AppEnv>, error: WorkItemDocError) {
  switch (error.type) {
    case 'doc_not_found': {
      return problem(c, { status: 404, title: 'Document not found', type: error.type });
    }
    case 'invalid_doc_name': {
      return problem(c, { detail: 'Doc names are spec, plan, decisions, … or reviews/<file>.md.', status: 422, title: 'Invalid document name', type: error.type });
    }
    case 'invalid_slug': {
      return problem(c, { status: 422, title: 'Invalid work item name', type: error.type });
    }
    case 'project_not_found': {
      return problem(c, { status: 404, title: 'Project not found', type: error.type });
    }
    case 'work_item_not_found': {
      return problem(c, { status: 404, title: 'Work item not found', type: error.type });
    }
    default: {
      return error satisfies never;
    }
  }
}
