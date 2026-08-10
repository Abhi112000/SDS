import { getSession } from 'next-auth/react';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import { authRedirect } from '@/lib/authRedirect';
import Breadcrumbs from '@/components/Breadcrumbs';
import { useRouter } from 'next/router';

const formatMoney = value => `₹${Number(value || 0).toFixed(2)}`;
const formatDateTime = value => {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date(value));
  } catch (e) {
    return String(value);
  }
};

export default function OrderDetail({ order }) {
  const router = useRouter();
  if (!order) return <div className="p-6">Order not found.</div>;

  return (
    <div className="p-6">
      <Breadcrumbs items={[{ label: 'My Orders', href: '/orders' }, { label: `Order ${order._id}` }]} />
      <button onClick={() => router.back()} className="mb-4 px-3 py-1 border rounded">Back</button>
      <h1 className="text-2xl font-bold mb-4">Order Details</h1>

      <div className="bg-white p-4 rounded shadow mb-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="font-semibold">Order ID</div>
            <div>{order._id}</div>
          </div>
          <div>
            <div className="font-semibold">Status</div>
            <div>{order.status}</div>
          </div>
          <div>
            <div className="font-semibold">Placed on</div>
            <div>{formatDateTime(order.createdAt)}</div>
          </div>
          <div>
            <div className="font-semibold">Customer</div>
            <div>{order.name || order.email || 'Guest'}</div>
          </div>
          <div className="md:col-span-2">
            <div className="font-semibold">Delivery address</div>
            <div>{order.address || 'Not provided'}</div>
          </div>
          {order.locationUrl && (
            <div className="md:col-span-2">
              <div className="font-semibold">Delivery location</div>
              <a href={order.locationUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline break-all">{order.locationUrl}</a>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white p-4 rounded shadow mb-4">
        <h2 className="text-lg font-semibold mb-3">Items</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="p-3">Product</th>
                <th className="p-3 text-right">Qty</th>
                <th className="p-3 text-right">Unit price</th>
                <th className="p-3 text-right">Line total</th>
              </tr>
            </thead>
            <tbody>
              {(order.items || []).map((item, index) => (
                <tr key={index} className="border-b last:border-b-0">
                  <td className="p-3">{item.title || 'Item'}</td>
                  <td className="p-3 text-right">{item.qty || 1}</td>
                  <td className="p-3 text-right">{formatMoney(item.price)}</td>
                  <td className="p-3 text-right">{formatMoney((Number(item.price) || 0) * (Number(item.qty) || 1))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white p-4 rounded shadow max-w-md ml-auto">
        <h2 className="text-lg font-semibold mb-3">Pricing summary</h2>
        <div className="grid gap-2 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(order.subtotal)}</span></div>
          <div className="flex justify-between"><span>Delivery charges</span><span>{formatMoney(order.deliveryCharge)}</span></div>
          <div className="flex justify-between"><span>Discount</span><span>- {formatMoney(order.coupon?.discountAmount)}</span></div>
          <div className="flex justify-between"><span className="font-semibold">Total</span><span className="font-semibold">{formatMoney(order.total ?? ((order.subtotal || 0) + (order.deliveryCharge || 0) - (order.coupon?.discountAmount || 0)))}</span></div>
        </div>
      </div>
    </div>
  );
}

export async function getServerSideProps(ctx){
  const session = await getSession(ctx);
  if(!session) return authRedirect(ctx);
  await dbConnect();
  const { id } = ctx.params;
  const order = await Order.findById(id).lean();
  if(!order) return { notFound: true };
  if(order.userId && order.userId !== session.user.id) return { redirect: { destination: '/orders', permanent: false } };
  return { props: { order: JSON.parse(JSON.stringify(order)) } };
}
