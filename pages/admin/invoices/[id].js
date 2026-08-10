import { getSession } from 'next-auth/react';
import dbConnect from '@/lib/mongodb';
import Invoice from '@/models/Invoice';
import AdminSidebar from '@/components/AdminSidebar';
import { useRouter } from 'next/router';
import { formatReferenceId } from '@/lib/referenceIds';

function fmtISO(d){ if(!d) return ''; try{ return new Date(d).toISOString().replace('T',' ').slice(0,19); }catch(e){ return String(d); } }

export default function InvoiceDetail({ invoice }){
  const router = useRouter();
  if(!invoice) return <div className="p-6">Invoice not found</div>;
  return (
    <div className="p-6">
      <div className="grid md:grid-cols-4 gap-6">
        <AdminSidebar />
        <main className="md:col-span-3">
          <button onClick={()=>router.back()} className="mb-4 px-3 py-1 border rounded">Back</button>
          <h1 className="text-2xl font-bold mb-4">Invoice {formatReferenceId('invoice', invoice, invoice.payload?.guest === true)}</h1>
          <div className="bg-white p-4 rounded shadow mb-4">
            <div><strong>Status:</strong> {invoice.status}</div>
            <div><strong>Total:</strong> ₹{invoice.total}</div>
            <div><strong>Created:</strong> {fmtISO(invoice.createdAt)}</div>
            <div className="mt-3">
              <pre className="text-sm bg-gray-50 p-3 rounded overflow-auto">{JSON.stringify(invoice.payload || {}, null, 2)}</pre>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { window.open('/api/admin/invoices/print?id='+(invoice._id || invoice.invoiceId), '_blank'); }} className="px-3 py-1 bg-blue-600 text-white rounded">Print / Download</button>
          </div>
        </main>
      </div>
    </div>
  );
}

export async function getServerSideProps(ctx){
  const session = await getSession(ctx);
  if(!session || session.user.role !== 'admin') return { redirect: { destination: '/login', permanent: false } };
  const { id } = ctx.params;
  await dbConnect();
  // try _id first, then invoiceId
  let inv = await Invoice.findById(id).lean().catch(()=>null);
  if(!inv) inv = await Invoice.findOne({ invoiceId: id }).lean().catch(()=>null);
  return { props: { invoice: inv ? JSON.parse(JSON.stringify(inv)) : null } };
}
