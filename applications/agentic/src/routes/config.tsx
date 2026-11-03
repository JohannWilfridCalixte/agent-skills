import { createFileRoute } from '@tanstack/react-router';

import { PlaceholderPage } from '@/shell/placeholder-page';

function ConfigPage() {
  return <PlaceholderPage description="Global and project configuration." title="Config" />;
}

export const Route = createFileRoute('/config')({ component: ConfigPage });
