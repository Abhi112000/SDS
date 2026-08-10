import dbConnect from '@/lib/mongodb';
import Product from '@/models/Product';
import Category from '@/models/Category';
import { getSession } from 'next-auth/react';
import { getToken } from 'next-auth/jwt';
import XLSX from 'xlsx';

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};

function categoryPrefix(category) {
  const words = String(category || 'General').trim().split(/\s+/).filter(Boolean);
  const initials = words.map(word => word[0]).join('').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return (initials || 'GEN').slice(0, 6);
}

function asNumber(value, fallback = 0) {
  if (value === '' || value === null || value === undefined) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function asBoolean(value) {
  return value === true || ['true', 'yes', '1', 'y'].includes(String(value || '').trim().toLowerCase());
}

function normalizeRows(rows) {
  return rows.filter(row => {
    const title = String(row.title || '').trim();
    const hasPrice = row.price !== '' && row.price !== null && row.price !== undefined;
    return title || hasPrice;
  }).map((row, index) => ({
    rowNumber: index + 2,
    productId: String(row._productId || row.productId || '').trim(),
    title: String(row.title || '').trim(),
    description: String(row.description || '').trim(),
    price: asNumber(row.price, NaN),
    originalPrice: row.originalPrice === '' || row.originalPrice === undefined ? undefined : asNumber(row.originalPrice, NaN),
    salePrice: row.salePrice === '' || row.salePrice === undefined ? undefined : asNumber(row.salePrice, NaN),
    onSale: asBoolean(row.onSale),
    stock: asNumber(row.stock, 9999),
    featured: asBoolean(row.featured),
    category: String(row.category || 'General').trim() || 'General',
  }));
}

async function requireAdmin(req, res) {
  const session = await getSession({ req });
  let token = null;
  try {
    token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  } catch (error) {
    token = null;
  }
  const role = session?.user?.role || token?.role;
  if (role !== 'admin') {
    res.status(403).json({ error: 'admin required' });
    return false;
  }
  return true;
}

function makeRowsFromWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const rows = [];
  workbook.SheetNames.forEach(sheetName => {
    const sheetRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
    sheetRows.forEach(row => rows.push({ ...row, category: row.category || sheetName }));
  });
  return normalizeRows(rows);
}

function comparableValue(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function hasProductChanges(row, product) {
  return [
    ['title', row.title, product.title],
    ['description', row.description, product.description],
    ['price', row.price, product.price],
    ['originalPrice', row.originalPrice ?? '', product.originalPrice ?? ''],
    ['salePrice', row.salePrice ?? '', product.salePrice ?? ''],
    ['onSale', row.onSale, !!product.onSale],
    ['stock', row.stock, product.stock],
    ['featured', row.featured, !!product.featured],
    ['category', row.category, product.category],
  ].some(([, incoming, existing]) => comparableValue(incoming) !== comparableValue(existing));
}

function validateRows(rows) {
  return rows.map(row => {
    const errors = [];
    if (!row.title) errors.push('Title is required');
    if (!Number.isFinite(row.price) || row.price <= 0) errors.push('Price must be greater than 0');
    if (!Number.isFinite(row.stock) || row.stock < 0) errors.push('Stock must be 0 or more');
    if (row.originalPrice !== undefined && !Number.isFinite(row.originalPrice)) errors.push('Original price is invalid');
    if (row.salePrice !== undefined && !Number.isFinite(row.salePrice)) errors.push('Sale price is invalid');
    return { ...row, errors };
  });
}

async function findDuplicates(rows) {
  const products = await Product.find({}).select('_id title description price originalPrice salePrice onSale stock featured category sku image images featuredImage').lean();
  return rows.map(row => {
    const keyedMatch = row.productId ? products.find(product => String(product._id) === row.productId) : null;
    const matches = products.filter(product =>
      String(product.title || '').trim().toLowerCase() === row.title.toLowerCase() &&
      String(product.category || '').trim().toLowerCase() === row.category.toLowerCase()
    );
    const match = keyedMatch || matches[0];
    return { ...row, duplicate: match ? { id: match._id, title: match.title, category: match.category, sku: match.sku } : null, changed: match ? hasProductChanges(row, match) : true, matchType: keyedMatch ? 'productId' : (match ? 'title-category' : null) };
  });
}

async function nextSku(category, usedSkus) {
  const prefix = categoryPrefix(category);
  const existing = await Product.find({ sku: new RegExp(`^${prefix}-\\d+$`, 'i') }).select('sku').lean();
  const numbers = [...existing.map(item => Number(String(item.sku).split('-').pop())), ...usedSkus.map(sku => Number(String(sku).split('-').pop()))].filter(Number.isFinite);
  let next = Math.max(0, ...numbers) + 1;
  let sku = `${prefix}-${String(next).padStart(3, '0')}`;
  while (usedSkus.includes(sku)) {
    next += 1;
    sku = `${prefix}-${String(next).padStart(3, '0')}`;
  }
  usedSkus.push(sku);
  return sku;
}

function productPayload(row, sku) {
  const payload = {
    title: row.title,
    description: row.description,
    price: row.price,
    stock: row.stock,
    featured: row.featured,
    category: row.category,
    sku,
    onSale: row.onSale,
  };
  if (row.originalPrice !== undefined) payload.originalPrice = row.originalPrice;
  if (row.salePrice !== undefined) payload.salePrice = row.salePrice;
  if (row.onSale) {
    payload.tags = ['SALE!'];
    payload.saleHistory = [{ price: Number(row.salePrice ?? row.price), startAt: new Date().toISOString(), active: true }];
  }
  return payload;
}

export default async function handler(req, res) {
  await dbConnect();
  if (req.method === 'GET') {
    if (!(await requireAdmin(req, res))) return;
    const categories = await Category.find({}).sort({ name: 1 }).lean();
    const names = categories.length ? categories.map(category => category.name) : ['General'];
    const headers = ['title', 'description', 'price', 'originalPrice', 'salePrice', 'onSale', 'stock', 'featured', 'category'];
    const workbook = XLSX.utils.book_new();
    const existingProducts = req.query.existing === '1'
      ? await Product.find({}).sort({ category: 1, createdAt: 1, _id: 1 }).lean()
      : [];
    const exportNames = existingProducts.length
      ? [...new Set(existingProducts.map(product => product.category || 'General'))]
      : names;
    exportNames.forEach(name => {
      const rows = req.query.existing === '1'
        ? existingProducts.filter(product => (product.category || 'General') === name).map(product => [product.title || '', product.description || '', product.price ?? '', product.originalPrice ?? '', product.salePrice ?? '', !!product.onSale, product.stock ?? 9999, !!product.featured, product.category || name, String(product._id)])
        : [['', '', '', '', '', false, 9999, false, name, '']];
      const sheet = XLSX.utils.aoa_to_sheet([[...headers, '_productId'], ...rows]);
      sheet['!cols'] = [{ wch: 28 }, { wch: 40 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 18 }, { hidden: true }];
      XLSX.utils.book_append_sheet(workbook, sheet, name.slice(0, 31) || 'General');
    });
    const output = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="products-${req.query.existing === '1' ? 'existing' : 'template'}.xlsx"`);
    return res.status(200).send(output);
  }

  if (req.method !== 'POST' || !(await requireAdmin(req, res))) return req.method === 'POST' ? undefined : res.status(405).end();
  try {
    const { fileBase64, decisions = {}, commit = false } = req.body || {};
    if (!fileBase64) return res.status(400).json({ error: 'Excel file is required' });
    const parsedRows = makeRowsFromWorkbook(Buffer.from(fileBase64, 'base64'));
    const rows = commit && Array.isArray(req.body.rows)
      ? validateRows(req.body.rows)
      : validateRows(await findDuplicates(parsedRows));
    if (!commit) return res.status(200).json({ rows, valid: rows.filter(row => !row.errors.length).length });

    const invalid = rows.filter(row => row.errors.length);
    if (invalid.length) return res.status(400).json({ error: 'Fix invalid rows before import', rows });
    const usedSkus = [];
    let created = 0;
    let updated = 0;
    let skipped = 0;
    for (const row of rows) {
      const decision = decisions[String(row.rowNumber)] || (row.duplicate && row.changed ? 'update' : 'skip');
      if (row.duplicate && decision === 'skip') {
        skipped += 1;
        continue;
      }
      if (row.duplicate && decision === 'update') {
        const existing = await Product.findById(row.duplicate.id).select('sku title description price originalPrice salePrice onSale stock featured category').lean();
        if (existing && hasProductChanges(row, existing)) {
          await Product.findByIdAndUpdate(row.duplicate.id, productPayload(row, existing.sku || await nextSku(row.category, usedSkus)), { new: true });
          updated += 1;
        } else {
          skipped += 1;
        }
      } else {
        await Product.create(productPayload(row, await nextSku(row.category, usedSkus)));
        created += 1;
      }
    }
    return res.status(200).json({ ok: true, created, updated, skipped });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Bulk import failed' });
  }
}
