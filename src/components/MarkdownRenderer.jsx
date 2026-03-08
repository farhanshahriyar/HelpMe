import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

function CodeBlock({ language, children }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(String(children).replace(/\n$/, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-2">
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity
                   bg-white/10 hover:bg-white/20 border border-white/10 rounded-md p-1.5"
      >
        {copied
          ? <Check className="w-3 h-3 text-green-400" />
          : <Copy className="w-3 h-3 text-zinc-400" />}
      </button>
      <SyntaxHighlighter
        language={language || 'text'}
        style={oneDark}
        customStyle={{
          margin: 0,
          borderRadius: '8px',
          background: 'rgba(0,0,0,0.45)',
          border: '1px solid rgba(255,255,255,0.07)',
          fontSize: '11.5px',
          padding: '12px 14px',
        }}
        wrapLongLines
      >
        {String(children).replace(/\n$/, '')}
      </SyntaxHighlighter>
    </div>
  );
}

export default function MarkdownRenderer({ content, streaming }) {
  return (
    <div className={`prose-helpme ${streaming ? 'cursor-blink' : ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            if (!inline && match) {
              return <CodeBlock language={match[1]}>{children}</CodeBlock>;
            }
            return <code className={className} {...props}>{children}</code>;
          },
          pre({ children }) {
            return <>{children}</>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
