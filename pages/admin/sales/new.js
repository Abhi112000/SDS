import AdminSidebar from '@/components/AdminSidebar';
import DailySalesEntry from '@/components/DailySalesEntry';
import DailySalesBatch from '@/components/DailySalesBatch';
import SalesHistory from '@/components/SalesHistory';
import { useState } from 'react';

export default function NewSalePage(){
  const [tab, setTab] = useState('single');
  return (
    <div className="p-6">
      <div className="grid md:grid-cols-4 gap-6">
        <AdminSidebar />
        <main className="md:col-span-3">
          <h1 className="text-2xl font-bold mb-4">Sales</h1>

          <div className="mb-4">
            <div className="flex gap-2">
              <button onClick={()=>setTab('single')} className={`px-3 py-1 rounded ${tab==='single' ? 'bg-blue-600 text-white' : 'border'}`}>Single entry</button>
              <button onClick={()=>setTab('batch')} className={`px-3 py-1 rounded ${tab==='batch' ? 'bg-blue-600 text-white' : 'border'}`}>Batch / CSV</button>
              <button onClick={()=>setTab('history')} className={`px-3 py-1 rounded ${tab==='history' ? 'bg-blue-600 text-white' : 'border'}`}>History</button>
            </div>
          </div>

          {tab === 'single' && <DailySalesEntry onSuccess={(body)=>{ /* optionally refresh history */ }} />}
          {tab === 'batch' && <DailySalesBatch onResult={(body)=>{ /* optionally refresh history */ }} />}
          {tab === 'history' && <SalesHistory />}

        </main>
      </div>
    </div>
  );
}
