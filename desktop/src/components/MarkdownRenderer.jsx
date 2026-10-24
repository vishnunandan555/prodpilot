import React, { useMemo, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { Copy, Check } from 'lucide-react';

// Configure marked with GitHub Flavored Markdown
marked.setOptions({
  gfm: true,
  breaks: true,
  pedantic: false
});

export default function MarkdownRenderer({ content, className = '' }) {
  const [copiedCode, setCopiedCode] = useState(false);

  const sanitizedHtml = useMemo(() => {
    if (!content) return '';
    try {
      const rawHtml = marked.parse(content);
      return DOMPurify.sanitize(rawHtml, {
        ADD_ATTR: ['target', 'rel']
      });
    } catch (err) {
      console.error('Markdown parse error:', err);
      return `<pre class="text-xs text-[#ff7b72]">${content}</pre>`;
    }
  }, [content]);

  // Handle clicking links inside the rendered markdown to open safely
  const handleClick = (e) => {
    const target = e.target.closest('a');
    if (target && target.href) {
      e.preventDefault();
      window.open(target.href, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`markdown-body text-xs text-[#c9d1d9] leading-relaxed break-words ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}
