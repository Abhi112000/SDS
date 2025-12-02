import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function useToast() {
  return useContext(ToastContext);
}

function ToastBox({ t, onClose }){
  const base = 'px-4 py-3 rounded-lg shadow-lg flex items-start gap-3 max-w-md';
  const color = t.type === 'error' ? 'bg-red-600 text-white' : (t.type === 'info' ? 'bg-blue-600 text-white' : 'bg-green-600 text-white');
  return (
    <div className={`${base} ${color}`} role="status" aria-live="polite">
      <div className="flex-shrink-0 mt-0.5">
        {t.type === 'error' ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.723-1.36 3.488 0l5.518 9.813c.75 1.333-.213 2.988-1.744 2.988H4.483c-1.53 0-2.494-1.655-1.744-2.988L8.257 3.1zM11 13a1 1 0 10-2 0 1 1 0 002 0zm-.75-6.75a.75.75 0 00-1.5 0v4.5a.75.75 0 001.5 0v-4.5z" clipRule="evenodd" /></svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2.003 5.884l8 4.8a1 1 0 00.994 0l8-4.8A1 1 0 0018 4H2a1 1 0 00.003 1.884z" /></svg>
        )}
      </div>
      <div className="flex-1">
        <div className="font-medium">{t.title || (t.type === 'error' ? 'Error' : t.type === 'info' ? 'Info' : 'Success')}</div>
        <div className="text-sm mt-0.5">{t.message}</div>
      </div>
      <div className="flex-shrink-0">
        <button onClick={onClose} className="text-white/90 hover:text-white">✕</button>
      </div>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((t) => {
    const id = Date.now() + Math.random();
    const item = { id, title: t.title, message: t.message, type: t.type || 'success', duration: typeof t.duration === 'number' ? t.duration : 4500 };
    setToasts((s) => [...s, item]);
    if (item.duration !== 0) setTimeout(() => setToasts((s) => s.filter((x) => x.id !== id)), item.duration);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {toasts.map((t) => (
          <ToastBox key={t.id} t={t} onClose={() => setToasts((s) => s.filter((x) => x.id !== t.id))} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
