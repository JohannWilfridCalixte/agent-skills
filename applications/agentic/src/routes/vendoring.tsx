import { createFileRoute } from '@tanstack/react-router';

import { VendoringPage } from '@/features/vendoring/vendoring-page';

export const Route = createFileRoute('/vendoring')({ component: VendoringPage });
