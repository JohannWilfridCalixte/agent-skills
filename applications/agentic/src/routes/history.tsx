import { createFileRoute } from '@tanstack/react-router';

import { PlaceholderPage } from '@/shell/placeholder-page';

function HistoryPage() {
  return <PlaceholderPage description="Config changes and runs, with restore." title="History" />;
}

export const Route = createFileRoute('/history')({ component: HistoryPage });
