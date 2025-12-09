import { getSession } from 'next-auth/react';
import AdminSidebar from '@/components/AdminSidebar';
import { useState } from 'react';
import { useToast } from '@/components/Toast';

export default function UploadTest(){
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const toast = useToast();

  async function upload(){
    if(!file) return toast?.push?.({ message: 'Pick a file first', type: 'error' });
    try{
      // convert to dataURL
      const dataUrl = await new Promise((res, rej)=>{
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = rej;
        r.readAsDataURL(file);
      });

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/admin/upload-image');
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.upload.onprogress = (e) => {
          if(e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if(xhr.status >= 200 && xhr.status < 300){
            const json = JSON.parse(xhr.responseText || '{}');
            toast?.push?.({ message: 'Uploaded: ' + (json.url || 'no url'), type: 'success' });
            resolve(json);
          }else{
            toast?.push?.({ message: 'Upload failed', type: 'error' });
            reject(new Error('upload failed'));
          }
        };
        xhr.onerror = () => { toast?.push?.({ message: 'Upload network error', type: 'error' }); reject(new Error('network')); };
        xhr.send(JSON.stringify({ dataUrl }));
      });
    }catch(e){ console.error(e); toast?.push?.({ message: 'Upload error: ' + (e?.message||e), type: 'error' }); }
  }

  return (
    <div className="p-6">
      <div className="grid md:grid-cols-4 gap-6">
        <AdminSidebar />
        <main className="md:col-span-3">
          <h1 className="text-xl font-bold mb-4">Admin upload test</h1>
          <div className="mb-3">
            <input type="file" accept="image/*" onChange={e=>setFile(e.target.files?.[0]||null)} />
          </div>
          <div className="mb-3">
            <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={upload}>Upload</button>
          </div>
          <div className="w-full bg-gray-200 h-2 rounded overflow-hidden">
            <div style={{ width: progress + '%'}} className="bg-green-600 h-2"></div>
          </div>
          <p className="text-sm mt-2">Progress: {progress}%</p>
        </main>
      </div>
    </div>
  );
}

export async function getServerSideProps(ctx){
  const session = await getSession(ctx);
  if(!session || session.user.role !== 'admin') return { redirect: { destination: '/login', permanent: false } };
  return { props: {} };
}
