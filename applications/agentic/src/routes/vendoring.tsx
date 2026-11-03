import { createFileRoute } from '@tanstack/react-router';

import { PlaceholderPage } from '@/shell/placeholder-page';

function VendoringPage() {
  return <PlaceholderPage description="Vendored skills: check, verify and update." title="Vendoring" />;
}

export const Route = createFileRoute('/vendoring')({ component: VendoringPage });
