import { createFileRoute } from '@tanstack/react-router';

import { WorkItemDetailPage } from '@/features/work-items/work-item-detail-page';

function WorkItemRoute() {
  const { projectId, slug } = Route.useParams();
  return <WorkItemDetailPage key={`${projectId}/${slug}`} projectId={projectId} slug={slug} />;
}

export const Route = createFileRoute('/work-items_/$projectId/$slug')({ component: WorkItemRoute });
