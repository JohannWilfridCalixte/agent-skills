import { createFileRoute } from '@tanstack/react-router';

import { WorkItemsPage } from '@/features/work-items/work-items-page';

export const Route = createFileRoute('/work-items')({ component: WorkItemsPage });
