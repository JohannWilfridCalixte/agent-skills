import { createFileRoute } from '@tanstack/react-router';

import { PlaceholderPage } from '@/shell/placeholder-page';

function WorkitemsPage() {
  return <PlaceholderPage description="Work items in the selected project." title="Work items" />;
}

export const Route = createFileRoute('/work-items')({ component: WorkitemsPage });
