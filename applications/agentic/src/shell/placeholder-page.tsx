import { EmptyState, PageHeader } from '@agentic/design-system';

interface PlaceholderPageProps {
  readonly description: string;
  readonly title: string;
}

/** Stand-in until the feature lands (T16-T18). */
export function PlaceholderPage({ description, title }: PlaceholderPageProps) {
  return (
    <>
      <PageHeader description={description} title={title} />
      <EmptyState description="This section is not available yet." title={`${title} is coming soon`} />
    </>
  );
}
