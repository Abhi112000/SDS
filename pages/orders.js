import useSWR from 'swr';
import { getSession } from 'next-auth/react';
import { authRedirect } from '@/lib/authRedirect';
const fetcher = url=>fetch(url).then(r=>r.json());
const adminWhatsApp = process.env.NEXT_PUBLIC_OWNER_WHATSAPP_NUMBER || '919818630972';
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
const buildOrderSummary = (o, action) => {
  const lines = [];
  lines.push('ORDER CANCELLATION REQUEST');
  if(action) lines.push(action, '');
  lines.push(`Order ID: ${o._id}`);
  lines.push(`Date: ${formatDateTime(o.createdAt)}`);
  lines.push(`Status: ${o.status}`);
  lines.push(`Customer: ${o.name || ''}`);
  lines.push(`Email: ${o.email || ''}`);
  lines.push(`Phone: ${o.whatsapp || o.phone || ''}`);
  if(o.address) lines.push(`Address: ${o.address}`);
  lines.push('', 'Items:');
  (o.items || []).forEach(item => {
    lines.push(`• ${item.title} x ${item.qty || 1} @ ₹${item.price || 0} = ₹${(((item.qty||1)*(item.price||0))||0).toFixed(2)}`);
  });
  lines.push('', `Subtotal: ₹${Number(o.subtotal || 0).toFixed(2)}`);
  const total = Number(o.total ?? ((o.subtotal || 0) - (o.coupon?.discountAmount || 0)));
  lines.push(`Total: ₹${total.toFixed(2)}`);
  return lines.join('\n');
};
const getWhatsAppHref = text => {
  const phone = String(adminWhatsApp).replace(/\D/g, '');
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
};
export default function Orders(){
  const { data } = useSWR('/api/orders', fetcher);
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">My Orders</h1>
      <table className="w-full bg-white">
        <thead><tr><th>Date</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>
          {data?.map(o=> {
            const isCancelable = ['new','processing'].includes(o.status);
            const actionText = isCancelable ? 'Please cancel this order before shipping.' : 'I would like to request cancellation after shipment.';
            return (
              <tr key={o._id} className="align-top">
                <td>{formatDateTime(o.createdAt)}</td>
                <td>₹{o.subtotal}</td>
                <td>{o.status}</td>
                <td>
                  {o.status !== 'cancelled' ? (
                    <a href={getWhatsAppHref(buildOrderSummary(o, actionText))} target="_blank" rel="noreferrer" className={`px-3 py-1 rounded text-white ${isCancelable ? 'bg-red-600' : 'bg-orange-600'}`}>
                      {isCancelable ? 'Cancel on WhatsApp' : 'Request cancel on WhatsApp'}
                    </a>
                  ) : (
                    <span className="text-sm text-gray-500">Cancelled</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  )
}

export async function getServerSideProps(ctx){
  const session = await getSession(ctx);
  if(!session) return authRedirect(ctx);
  return { props: {} };
}