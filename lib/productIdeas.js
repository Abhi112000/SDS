const PRODUCT_IDEA_GROUPS = [
  {
    category: 'Pencils',
    terms: ['pencil', 'pencils', 'hb', '2b', 'graphite', 'mechanical', 'wooden pencil'],
    ideas: ['HB Writing Pencil', '2B Drawing Pencil', 'Mechanical Pencil', 'Colored Pencil Set', 'Jumbo Beginner Pencil', 'Carpenter Pencil', 'Pencil Set with Eraser']
  },
  {
    category: 'Pens',
    terms: ['pen', 'pens', 'ball pen', 'ballpoint', 'gel pen', 'ink pen', 'fountain pen', 'rollerball'],
    ideas: ['Ball Pen', 'Gel Pen', '0.5 mm Fine Tip Pen', 'Fountain Pen', 'Rollerball Pen', 'Multi-colour Pen Set', 'Refillable Pen']
  },
  {
    category: 'Markers & Highlighters',
    terms: ['marker', 'markers', 'highlighter', 'highlighters', 'sketch pen', 'permanent marker', 'whiteboard marker'],
    ideas: ['Text Highlighter', 'Permanent Marker', 'Whiteboard Marker', 'Sketch Pen Set', 'Brush Marker Set', 'Fine Tip Marker']
  },
  {
    category: 'Notebooks & Registers',
    terms: ['notebook', 'notebooks', 'copy', 'copies', 'register', 'registers', 'diary', 'journal', 'rough book'],
    ideas: ['Single Line Notebook', 'Four Line Notebook', 'Square Rule Notebook', 'Unruled Drawing Notebook', 'Long Register', 'Practical Notebook', 'Pocket Diary']
  },
  {
    category: 'Paper & Pads',
    terms: ['paper', 'papers', 'a4', 'print paper', 'chart paper', 'graph paper', 'sticky notes', 'notepad', 'pad'],
    ideas: ['A4 Copier Paper Pack', 'Colour Paper Pack', 'Graph Paper Pad', 'Chart Paper Sheet', 'Sticky Notes Pad', 'Memo Notepad']
  },
  {
    category: 'Erasers & Correction',
    terms: ['eraser', 'erasers', 'rubber', 'correction', 'whitener', 'correction pen', 'correction tape'],
    ideas: ['Soft PVC Eraser', 'Dust-free Eraser', 'Kneaded Art Eraser', 'Correction Pen', 'Correction Tape', 'Eraser Multi-pack']
  },
  {
    category: 'Sharpeners & Rulers',
    terms: ['sharpener', 'sharpeners', 'scale', 'ruler', 'rulers', 'geometry', 'compass', 'divider', 'protractor'],
    ideas: ['Single Hole Sharpener', 'Sharpener with Container', '15 cm Ruler', '30 cm Ruler', 'Geometry Box', 'Compass Set', 'Protractor']
  },
  {
    category: 'Art & Craft',
    terms: ['art', 'craft', 'colour', 'color', 'crayon', 'crayons', 'paint', 'watercolour', 'watercolor', 'brush', 'sketchbook'],
    ideas: ['Wax Crayon Set', 'Colour Pencil Set', 'Watercolour Cake Set', 'Poster Colour Set', 'Paint Brush Set', 'Drawing Sheet Pad', 'Craft Paper Pack']
  },
  {
    category: 'Adhesives & Tape',
    terms: ['glue', 'adhesive', 'fevicol', 'tape', 'sticky tape', 'gluestick', 'glue stick'],
    ideas: ['School Glue Bottle', 'Glue Stick', 'Transparent Tape Roll', 'Paper Masking Tape', 'Double-sided Tape', 'Craft Adhesive']
  },
  {
    category: 'Files & Folders',
    terms: ['file', 'files', 'folder', 'folders', 'document', 'document file', 'envelope', 'clipboard'],
    ideas: ['Button File', 'L-folder', 'Document Folder', 'Ring Binder', 'Project File', 'Document Envelope', 'Clipboard']
  },
  {
    category: 'Office Supplies',
    terms: ['office', 'stapler', 'staples', 'paper clip', 'paper clips', 'binder clip', 'scissors', 'punch'],
    ideas: ['Mini Stapler', 'Stapler Pins', 'Paper Clip Box', 'Binder Clip Set', 'Office Scissors', 'Single Hole Punch', 'Push Pins']
  },
  {
    category: 'School Bags & Accessories',
    terms: ['bag', 'bags', 'school bag', 'pencil box', 'pencil pouch', 'lunch box', 'water bottle'],
    ideas: ['School Backpack', 'Pencil Box', 'Zipper Pencil Pouch', 'Lunch Box', 'Water Bottle', 'Name Label Set']
  }
];

const STOP_WORDS = new Set(['a', 'an', 'the', 'of', 'for', 'and', 'type', 'types', 'kind', 'kinds', 'stationery', 'item', 'items']);

function normalizeTerm(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\b(pencils|pens|notebooks|registers|erasers|sharpeners|markers|folders|files)\b/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function searchableWords(value) {
  return normalizeTerm(value)
    .split(/[\s-]+/)
    .filter(word => word && !STOP_WORDS.has(word));
}

function canonicalWords(value) {
  const plurals = {
    pencils: 'pencil',
    pens: 'pen',
    notebooks: 'notebook',
    registers: 'register',
    erasers: 'eraser',
    sharpeners: 'sharpener',
    markers: 'marker',
    highlighters: 'highlighter',
    folders: 'folder',
    files: 'file',
    rulers: 'ruler',
    crayons: 'crayon'
  };
  return searchableWords(value).map(word => plurals[word] || word);
}

function isNearMatch(left, right) {
  if (Math.abs(left.length - right.length) > 2) return false;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1)
      );
    }
    previous = current;
  }
  return previous[right.length] <= 2;
}

export function getProductIdeas(query) {
  const cleanQuery = normalizeTerm(query);
  const queryWords = canonicalWords(cleanQuery);
  if (!queryWords.length) return [];

  const matches = PRODUCT_IDEA_GROUPS.map(group => {
    const groupTerms = group.terms.map(term => canonicalWords(term).join(' '));
    const queryPhrase = queryWords.join(' ');
    const score = groupTerms.reduce((best, term) => {
      if (term === queryPhrase) return Math.max(best, 100);
      const termWords = term.split(' ');
      const shared = queryWords.filter(word => termWords.some(candidate =>
        candidate === word ||
        (word.length >= 4 && candidate.startsWith(word)) ||
        (word.length >= 5 && candidate.length >= 5 && isNearMatch(word, candidate))
      )).length;
      return Math.max(best, shared ? (shared * 10) / Math.max(queryWords.length, termWords.length) : 0);
    }, 0);
    return { ...group, score };
  }).filter(group => group.score > 0).sort((a, b) => b.score - a.score);

  if (matches.length) {
    const exactMatches = matches.filter(group => group.score === 100);
    const relevantMatches = exactMatches.length ? exactMatches : matches.filter(group => group.score >= matches[0].score * 0.8);
    return relevantMatches.slice(0, 3).flatMap(group => group.ideas.map(title => ({ title, category: group.category })));
  }

  const title = cleanQuery.replace(/\b[a-z]/g, char => char.toUpperCase());
  return [
    { title, category: '' },
    { title: `${title} - Single Piece`, category: '' },
    { title: `${title} - Pack of 5`, category: '' },
    { title: `${title} - Pack of 10`, category: '' },
    { title: `${title} - Student Set`, category: '' }
  ];
}
