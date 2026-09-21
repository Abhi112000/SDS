import { getSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import AdminSidebar from '@/components/AdminSidebar';
import { authRedirect } from '@/lib/authRedirect';

const emptySlide = () => ({ imageUrl: '', altText: 'Stationery item', caption: '', link: '/shop' });

export default function HomeBannerAdminPage() {
  const [slides, setSlides] = useState([emptySlide()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/admin/home-banner', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        const items = Array.isArray(data?.slides) && data.slides.length ? data.slides : [emptySlide()];
        setSlides(items);
      })
      .catch(() => setSlides([emptySlide()]))
      .finally(() => setLoading(false));
  }, []);

  function updateSlide(index, field, value) {
    setSlides((prev) => prev.map((slide, i) => i === index ? { ...slide, [field]: value } : slide));
  }

  function addSlide() {
    setSlides((prev) => [...prev, emptySlide()]);
  }

  function removeSlide(index) {
    setSlides((prev) => prev.length === 1 ? [emptySlide()] : prev.filter((_, i) => i !== index));
  }

  async function saveSlides() {
    setSaving(true);
    try {
      const cleanedSlides = slides
        .map((slide) => ({
          imageUrl: String(slide?.imageUrl || '').trim(),
          altText: String(slide?.altText || 'Stationery item').trim() || 'Stationery item',
          caption: String(slide?.caption || '').trim(),
          link: String(slide?.link || '/shop').trim() || '/shop'
        }))
        .filter((slide) => slide.imageUrl);

      const res = await fetch('/api/admin/home-banner', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slides: cleanedSlides.length ? cleanedSlides : [emptySlide()] })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setSlides(Array.isArray(data?.slides) && data.slides.length ? data.slides : [emptySlide()]);
      alert('Homepage banner updated');
    } catch (error) {
      alert(error.message || 'Unable to save banner');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6">
      <div className="grid md:grid-cols-4 gap-6">
        <AdminSidebar />
        <main className="md:col-span-3">
          <div className="mb-4">
            <h1 className="text-2xl font-bold">Homepage banner</h1>
            <p className="text-sm text-gray-600">Add or update banner images. If there is only one image, it will display as a single banner; more than one will become a carousel.</p>
          </div>

          <section className="bg-white p-4 rounded shadow">
            {loading ? (
              <div className="text-sm text-gray-500">Loading banner settings...</div>
            ) : (
              <>
                {slides.map((slide, index) => (
                  <div key={index} className="border rounded p-3 mb-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-semibold">Slide {index + 1}</div>
                      <button type="button" onClick={() => removeSlide(index)} className="px-2 py-1 border rounded text-sm">Remove</button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <label className="block text-sm mb-1">Image URL</label>
                        <input
                          value={slide.imageUrl || ''}
                          onChange={(e) => updateSlide(index, 'imageUrl', e.target.value)}
                          className="w-full p-2 border rounded"
                          placeholder="https://example.com/image.jpg"
                        />
                      </div>

                      <div>
                        <label className="block text-sm mb-1">Alt text</label>
                        <input
                          value={slide.altText || ''}
                          onChange={(e) => updateSlide(index, 'altText', e.target.value)}
                          className="w-full p-2 border rounded"
                          placeholder="Stationery items"
                        />
                      </div>

                      <div>
                        <label className="block text-sm mb-1">Link</label>
                        <input
                          value={slide.link || ''}
                          onChange={(e) => updateSlide(index, 'link', e.target.value)}
                          className="w-full p-2 border rounded"
                          placeholder="/shop"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm mb-1">Caption</label>
                        <input
                          value={slide.caption || ''}
                          onChange={(e) => updateSlide(index, 'caption', e.target.value)}
                          className="w-full p-2 border rounded"
                          placeholder="Optional text overlay"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <div className="flex flex-wrap gap-2 mt-4">
                  <button type="button" onClick={addSlide} className="px-3 py-2 border rounded">Add slide</button>
                  <button type="button" onClick={saveSlides} disabled={saving} className="px-3 py-2 bg-blue-600 text-white rounded">{saving ? 'Saving...' : 'Save banner'}</button>
                </div>
              </>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

export async function getServerSideProps(ctx) {
  const session = await getSession(ctx);
  if (!session || session.user?.role !== 'admin') return authRedirect(ctx);
  return { props: {} };
}
