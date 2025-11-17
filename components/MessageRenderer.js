import React from 'react';

// Minimal, safe markdown renderer: supports **bold**, *italic*, `code`, and [link](url)
function escapeHtml(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

export default function MessageRenderer({ text }){
  if(!text) return null;
  let out = escapeHtml(text);
  // code spans
  out = out.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 bg-gray-100 rounded">$1</code>');
  // bold
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // italic
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // links
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" class="text-mehroon underline">$1</a>');
  // line breaks
  out = out.replace(/\n/g, '<br/>');

  return <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: out }} />;
}
