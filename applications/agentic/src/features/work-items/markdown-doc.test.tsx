/* eslint-disable testing-library/no-node-access -- proving raw HTML never becomes DOM elements needs direct element queries */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MarkdownDoc } from './markdown-doc';

describe('markdown doc renderer (D32)', () => {
  it('never turns raw HTML into elements', () => {
    const { container } = render(<MarkdownDoc text={'Hello\n\n<script>alert(1)</script>\n\n<img src="x" onerror="alert(2)">\n\n<b>bold</b>'} />);

    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    expect(container.querySelector('[onerror]')).toBeNull();
  });

  it('opens links in a new tab without opener or referrer', () => {
    render(<MarkdownDoc text="See [the docs](https://example.com/docs)." />);

    const link = screen.getByRole('link', { name: 'the docs' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders markdown images as links instead of loading them', () => {
    const { container } = render(<MarkdownDoc text="![diagram](https://tracker.example/pixel.png)" />);

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('link', { name: 'Image: diagram' })).toHaveAttribute('href', 'https://tracker.example/pixel.png');
  });

  it('drops javascript: links', () => {
    render(<MarkdownDoc text="[click](javascript:alert(1))" />);

    expect(screen.getByText('click').closest('a')?.getAttribute('href') ?? '').not.toContain('javascript');
  });

  it('renders GitHub-flavoured tables', () => {
    render(<MarkdownDoc text={'| a | b |\n| - | - |\n| 1 | 2 |'} />);

    expect(screen.getByRole('table')).toHaveTextContent('1');
  });
});
