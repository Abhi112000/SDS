import dns from 'dns';
import https from 'https';
import net from 'net';
import { getSession } from 'next-auth/react';
import { getToken } from 'next-auth/jwt';
import dbConnect from '@/lib/mongodb';

const MAX_HTML_BYTES = 2 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 9000;

function isPublicAddress(address) {
  const version = net.isIP(address);
  if (version === 4) {
    const [a, b, c] = address.split('.').map(Number);
    return !(
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 0 || b === 168)) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113)
    );
  }
  if (version === 6) {
    const normalized = address.toLowerCase().split('%')[0];
    const parts = normalized.split('::');
    const left = parts[0] ? parts[0].split(':') : [];
    const right = parts[1] ? parts[1].split(':') : [];
    const groups = parts.length === 2 ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right] : left;
    if (groups.length !== 8) return false;
    const first = parseInt(groups[0], 16);
    const second = parseInt(groups[1], 16);
    return first >= 0x2000 && first <= 0x3fff &&
      !(first === 0x2001 && (second === 0 || second === 0x0db8)) &&
      first !== 0x2002;
  }
  return false;
}

async function validateUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Enter a valid product page URL.');
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('Only public HTTPS product pages are supported.');
  }
  if (url.port && url.port !== '443') throw new Error('Only standard HTTPS product pages on port 443 are supported.');
  const hostname = url.hostname.toLowerCase();
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || net.isIP(hostname)) {
    throw new Error('This host is not allowed.');
  }
  if (hostname === 'google.com' || hostname.endsWith('.google.com') || hostname === 'google.co.in' || hostname.endsWith('.google.co.in')) {
    throw new Error('Open a product page from Google and paste that product page URL, not a Google results URL.');
  }

  const addresses = await dns.promises.lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(entry => !isPublicAddress(entry.address))) {
    throw new Error('This host does not resolve exclusively to public IP addresses.');
  }
  return { url, addresses };
}

function requestHtml(url, addresses) {
  return new Promise((resolve, reject) => {
    const address = addresses[0];
    const request = https.get(url, {
      headers: {
        'User-Agent': 'SDS-Product-Research/1.0 (+admin product metadata import)',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Encoding': 'identity'
      },
      lookup: (_hostname, _options, callback) => callback(null, address.address, address.family)
    }, response => {
      const status = response.statusCode || 0;
      if ([301, 302, 303, 307, 308].includes(status)) {
        response.resume();
        resolve({ redirect: response.headers.location });
        return;
      }
      if (status < 200 || status >= 300) {
        response.resume();
        reject(new Error(`Product page returned HTTP ${status}.`));
        return;
      }
      const contentType = String(response.headers['content-type'] || '').toLowerCase();
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
        response.resume();
        reject(new Error('The URL did not return an HTML product page.'));
        return;
      }
      const chunks = [];
      let totalBytes = 0;
      response.on('data', chunk => {
        totalBytes += chunk.length;
        if (totalBytes > MAX_HTML_BYTES) {
          request.destroy(new Error('Product page is too large to import.'));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => resolve({ html: Buffer.concat(chunks).toString('utf8') }));
      response.on('error', reject);
    });
    request.setTimeout(REQUEST_TIMEOUT_MS, () => request.destroy(new Error('Product page request timed out.')));
    request.on('error', reject);
  });
}

async function fetchProductPage(startUrl) {
  let currentUrl = startUrl;
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const { url, addresses } = await validateUrl(currentUrl);
    const result = await requestHtml(url, addresses);
    if (!result.redirect) return { url: url.href, html: result.html };
    if (redirects === 3) throw new Error('Product page redirected too many times.');
    currentUrl = new URL(result.redirect, url).href;
  }
  throw new Error('Unable to fetch product page.');
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_match, code) => decodeCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => decodeCodePoint(parseInt(code, 16)));
}

function decodeCodePoint(value) {
  if (!Number.isInteger(value) || value < 0 || value > 0x10ffff || (value >= 0xd800 && value <= 0xdfff)) return '';
  return String.fromCodePoint(value);
}

function parseAttributes(tag) {
  const attributes = {};
  const pattern = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match;
  while ((match = pattern.exec(tag))) {
    attributes[match[1].toLowerCase()] = decodeHtml(match[2] ?? match[3] ?? match[4] ?? '');
  }
  return attributes;
}

function metaContent(html, key) {
  const metas = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of metas) {
    const attributes = parseAttributes(tag);
    if ([attributes.property, attributes.name, attributes.itemprop].some(value => String(value || '').toLowerCase() === key.toLowerCase())) {
      return attributes.content || '';
    }
  }
  return '';
}

function flattenJsonLd(value, results = []) {
  if (Array.isArray(value)) {
    value.forEach(item => flattenJsonLd(item, results));
  } else if (value && typeof value === 'object') {
    results.push(value);
    if (value['@graph']) flattenJsonLd(value['@graph'], results);
  }
  return results;
}

function firstValue(value) {
  if (Array.isArray(value)) return firstValue(value[0]);
  if (value && typeof value === 'object') return value.url || value.contentUrl || value.name || '';
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function extractProductData(html, sourceUrl) {
  const scripts = html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
  let jsonProducts = [];
  for (const script of scripts) {
    const jsonText = script.replace(/^<script\b[^>]*>/i, '').replace(/<\/script>$/i, '').trim();
    try {
      const parsed = JSON.parse(jsonText);
      jsonProducts = jsonProducts.concat(flattenJsonLd(parsed).filter(entry => {
        const type = Array.isArray(entry['@type']) ? entry['@type'] : [entry['@type']];
        return type.some(item => String(item || '').toLowerCase() === 'product');
      }));
    } catch {
      // Some pages include invalid JSON-LD alongside valid metadata.
    }
  }

  const product = jsonProducts[0] || {};
  const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers || {};
  const pageTitle = (html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '';
  const productName = firstValue(product.name) || metaContent(html, 'og:title') || metaContent(html, 'twitter:title') || decodeHtml(pageTitle.replace(/<[^>]+>/g, ''));
  const description = firstValue(product.description) || metaContent(html, 'og:description') || metaContent(html, 'description');
  const imageValues = Array.isArray(product.image) ? product.image : [product.image || metaContent(html, 'og:image') || metaContent(html, 'twitter:image')];
  const images = [...new Set(imageValues.map(firstValue).filter(Boolean).map(image => {
    try { return new URL(image, sourceUrl).href; } catch { return ''; }
  }).filter(image => /^https?:\/\//i.test(image)))].slice(0, 8);
  const brand = firstValue(product.brand);
  const rawPrice = firstValue(offer.price) || firstValue(offer.lowPrice) || metaContent(html, 'product:price:amount');
  const price = Number(rawPrice);
  const sourcePrice = Number.isFinite(price) && price >= 0 ? price : null;
  const currency = firstValue(offer.priceCurrency) || metaContent(html, 'product:price:currency');

  return {
    title: productName.slice(0, 180),
    description: String(description).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1000),
    brand: String(brand).slice(0, 100),
    images,
    sourcePrice,
    currency: String(currency).slice(0, 8),
    sku: String(firstValue(product.sku)).slice(0, 100),
    category: String(firstValue(product.category)).slice(0, 100),
    structuredProductFound: jsonProducts.length > 0
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  await dbConnect();
  const session = await getSession({ req });
  let token = null;
  if (!session) {
    try { token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET }); }
    catch (error) { console.error('product research token lookup failed', error); }
  }
  const role = session?.user?.role || token?.role;
  if (role !== 'admin') return res.status(403).json({ error: 'admin required' });

  const pageUrl = String(req.body?.url || '').trim();
  if (!pageUrl || pageUrl.length > 2048) return res.status(400).json({ error: 'A product page URL is required (maximum 2048 characters).' });

  try {
    const { url, html } = await fetchProductPage(pageUrl);
    const product = extractProductData(html, url);
    if (!product.title && product.images.length === 0) {
      return res.status(422).json({ error: 'No product metadata found. Try a retailer product page with structured product details.' });
    }
    return res.status(200).json({ ok: true, sourceUrl: url, product });
  } catch (error) {
    console.error('product page research failed', error);
    return res.status(400).json({ error: error.message || 'Unable to read product page.' });
  }
}
