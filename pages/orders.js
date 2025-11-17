import useSWR from 'swr';
import { getSession } from 'next-auth/react';
const fetcher = url=>fetch(url).then(r=>r.json());
export default function Orders(){
  const { data } = useSWR('/api/orders', fetcher);
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">My Orders</h1>
      <table className="w-full bg-white">
        <thead><tr><th>Date</th><th>Amount</th><th>Status</th></tr></thead>
        <tbody>
          {data?.map(o=> (
            <tr key={o._id} className="align-top">
              <td>{new Date(o.createdAt).toLocaleString()}</td>
              <td>₹{o.subtotal}</td>
              <td>
                <div>{o.status}</div>
                <div className="mt-2">
                  <a href={`/messages?orderId=${o._id}`} className="px-3 py-1 btn-primary rounded">Chat & Support</a>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export async function getServerSideProps(ctx){
  const session = await getSession(ctx);
  if(!session) return { redirect: { destination: '/api/auth/signin', permanent: false } };
  return { props: {} };
}
