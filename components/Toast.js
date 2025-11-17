import React from 'react';

export default function Toast({ message, type = 'success' }){
  if(!message) return null;
  const bg = type === 'error' ? 'bg-red-600' : 'bg-green-600';
  return (
    <div className={`${bg} text-white fixed top-6 right-6 z-50 px-4 py-2 rounded shadow`} role="status" aria-live="polite">
      {message}
    </div>
  );
}
import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((t) => {
    const id = Date.now();
    setToasts((s) => [...s, { id, ...t }]);
    if (t.duration !== 0) setTimeout(() => setToasts((s) => s.filter((x) => x.id !== id)), t.duration || 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 space-y-2 z-50">
        {toasts.map((t) => (
          <div key={t.id} className={`px-4 py-2 rounded shadow flex items-start gap-3 ${t.type === 'error' ? 'bg-red-600 text-babypink' : 'bg-white text-mehroon'}`}>
            <div className="flex-1">{t.message}</div>
            <button onClick={() => setToasts((s) => s.filter((x) => x.id !== t.id))} className="text-gray-400 hover:text-gray-700">✕</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ToastProvider is exported as a named export above.
