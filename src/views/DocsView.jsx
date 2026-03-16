import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import overview from '../docs/overview.md?raw';
import methodology from '../docs/methodology.md?raw';
import architecture from '../docs/architecture.md?raw';

const sections = [
  { title: 'What this is', body: overview },
  { title: 'Methodology & evidence model', body: methodology },
  { title: 'How to interpret the architecture view', body: architecture }
];

export default function DocsView() {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {sections.map((section) => (
        <article key={section.title} className="prose prose-invert max-w-none rounded-2xl border border-white/10 bg-white/5 p-5 shadow-card prose-headings:text-ink prose-p:text-slate-300 prose-strong:text-ink prose-li:text-slate-300 prose-a:text-accentSoft">
          <div className="mb-4 text-xs uppercase tracking-[0.18em] text-mute not-prose">{section.title}</div>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.body}</ReactMarkdown>
        </article>
      ))}
    </div>
  );
}
