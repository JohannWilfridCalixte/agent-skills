import type { Components } from 'react-markdown';

import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Read-only, sanitising markdown (D32): raw HTML is skipped (no rehype-raw), unsafe URLs are dropped by
 * react-markdown's default `urlTransform`, links open in a new tab without opener, and images become links so no
 * remote host is contacted on open.
 */
const COMPONENTS = {
  a: ({ children, href }) => (
    <a className="text-primary underline" href={href} rel="noopener noreferrer" target="_blank">
      {children}
    </a>
  ),
  img: ({ alt, src }) => {
    if (typeof src !== 'string' || src === '') return <span>{`Image: ${alt ?? ''}`}</span>;
    return (
      <a className="text-primary underline" href={src} rel="noopener noreferrer" target="_blank">
        {`Image: ${alt ?? src}`}
      </a>
    );
  },
} satisfies Components;

export function MarkdownDoc({ text }: { readonly text: string }) {
  return (
    <div className="flex flex-col gap-3 text-sm leading-relaxed [&_code]:font-mono [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-6 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_td]:border [&_td]:px-2 [&_th]:border [&_th]:px-2 [&_ul]:list-disc [&_ul]:pl-6">
      <Markdown components={COMPONENTS} remarkPlugins={[remarkGfm]} skipHtml>
        {text}
      </Markdown>
    </div>
  );
}
