import mongoose from 'mongoose';
import Product from '@/models/Product';
import Sale from '@/models/Sale';

export async function recordSale({ product, sellingPrice, quantity, actorId, timestamp, note }) {
  const qty = Number(quantity);
  const sellPrice = Number(sellingPrice);
  if (!Number.isInteger(qty) || qty <= 0) throw new Error('Quantity must be a positive whole number');
  if (!Number.isFinite(sellPrice) || sellPrice < 0) throw new Error('Selling price must be a valid non-negative amount');

  const costPrice = Number(product.originalPrice || 0);
  const profit = Number(((sellPrice - costPrice) * qty).toFixed(2));
  const session = await mongoose.startSession();
  let result;

  try {
    await session.withTransaction(async () => {
      const updatedProduct = await Product.findOneAndUpdate(
        { _id: product._id, stock: { $gte: qty } },
        { $inc: { stock: -qty, lifetimeProfit: profit } },
        { new: true, session }
      ).lean();
      if (!updatedProduct) throw new Error('Insufficient stock');

      const [sale] = await Sale.create([{
        itemId: product._id,
        sku: product.sku,
        name: product.title,
        costPrice: mongoose.Types.Decimal128.fromString(costPrice.toFixed(2)),
        sellingPrice: mongoose.Types.Decimal128.fromString(sellPrice.toFixed(2)),
        quantity: qty,
        profit: mongoose.Types.Decimal128.fromString(profit.toFixed(2)),
        actorId,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        note,
        source: 'admin'
      }], { session });

      result = { sale, product: updatedProduct };
    });
  } finally {
    await session.endSession();
  }

  return result;
}
