import { createFileRoute } from '@tanstack/react-router';

import { PlaceholderPage } from '@/shell/placeholder-page';

function InstallPage() {
  return <PlaceholderPage description="Install and update agentic for each harness." title="Install" />;
}

export const Route = createFileRoute('/install')({ component: InstallPage });
