import Link from 'next/link';
export default function Breadcrumbs({ items = [] }){
  // items: [{ href, label }]
  return (
    <nav className="text-sm text-gray-600 mb-4" aria-label="Breadcrumb">
      <ol className="flex items-center gap-2">
        <li><Link href="/" className="hover:underline">Home</Link></li>
        {items.map((it, idx) => (
          <li key={idx} className="flex items-center gap-2">
            <span>/</span>
            {it.href ? <Link href={it.href} className="hover:underline">{it.label}</Link> : <span>{it.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
