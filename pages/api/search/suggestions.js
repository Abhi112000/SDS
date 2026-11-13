import dbConnect from '@/lib/mongodb';
import Category from '@/models/Category';
import Product from '@/models/Product';
import { getFuzzyMatchScore } from '@/lib/searchMatching';

const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const query = String(req.query.q || '').trim().slice(0, 60);
  if (query.length < 2) return res.status(200).json({ products: [], categories: [] });

  try {
    await dbConnect();
    const matcher = new RegExp(escapeRegex(query), 'i');
    const [exactProducts, exactCategories] = await Promise.all([
      Product.find({
        $or: [
          { title: matcher },
          { description: matcher },
          { sku: matcher },
          { category: matcher }
        ]
      })
        .select('title sku category price salePrice onSale image images')
        .limit(5)
        .lean(),
      Category.find({ name: matcher })
        .select('name')
        .sort({ name: 1 })
        .limit(5)
        .lean()
    ]);

    const exactProductIds = new Set(exactProducts.map(product => String(product._id)));
    const exactCategoryNames = new Set(exactCategories.map(category => category.name.toLowerCase()));
    const [catalogProducts, catalogCategories] = await Promise.all([
      exactProducts.length < 5
        ? Product.find({})
          .select('title description sku category price salePrice onSale image images')
          .limit(2000)
          .lean()
        : Promise.resolve([]),
      exactCategories.length < 5
        ? Category.find({})
          .select('name')
          .sort({ name: 1 })
          .limit(500)
          .lean()
        : Promise.resolve([])
    ]);

    const fuzzyProducts = catalogProducts
      .filter(product => !exactProductIds.has(String(product._id)))
      .map(product => ({
        product,
        score: getFuzzyMatchScore(query, product.title, product.sku, product.category, product.description)
      }))
      .filter(result => result.score !== null)
      .sort((left, right) => left.score - right.score)
      .slice(0, Math.max(0, 5 - exactProducts.length))
      .map(result => result.product);

    const products = [...exactProducts, ...fuzzyProducts].slice(0, 5);
    const categories = [
      ...exactCategories,
      ...catalogCategories
        .filter(category => !exactCategoryNames.has(category.name.toLowerCase()))
        .map(category => ({ category, score: getFuzzyMatchScore(query, category.name) }))
        .filter(result => result.score !== null)
        .sort((left, right) => left.score - right.score)
        .map(result => result.category)
    ].slice(0, 5);

    const productCategoryIds = products
      .map(product => String(product.category || ''))
      .filter(id => /^[a-f\d]{24}$/i.test(id));
    const productCategories = productCategoryIds.length
      ? await Category.find({ _id: { $in: productCategoryIds } }).select('name').lean()
      : [];
    const categoryNames = new Map(productCategories.map(category => [String(category._id), category.name]));

    return res.status(200).json({
      products: products.map(product => ({
        id: String(product._id),
        title: product.title || product.sku || 'Product',
        category: categoryNames.get(String(product.category || '')) || (
          /^[a-f\d]{24}$/i.test(String(product.category || '')) ? '' : (product.category || '')
        ),
        price: product.price ?? null,
        salePrice: product.salePrice ?? null,
        onSale: Boolean(product.onSale),
        image: product.image || product.images?.[0] || null,
        fuzzy: !exactProductIds.has(String(product._id))
      })),
      categories: categories.map(category => ({
        name: category.name,
        href: `/shop?category=${encodeURIComponent(category.name)}`,
        fuzzy: !exactCategoryNames.has(category.name.toLowerCase())
      }))
    });
  } catch (error) {
    console.error('Search suggestions failed:', error);
    return res.status(500).json({ error: 'Could not load search suggestions' });
  }
}
