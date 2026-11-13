import { getSession } from 'next-auth/react';
import { getToken } from 'next-auth/jwt';

export async function getLedgerAdmin(req) {
  const session = await getSession({ req });
  let token = null;
  try {
    token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET || 'dev-secret-change-me'
    });
  } catch (error) {
    console.error('ledger authentication token lookup failed', error);
  }

  const isAdmin = session?.user?.role === 'admin' ||
    token?.role === 'admin' ||
    token?.user?.role === 'admin';
  if (!isAdmin) return null;

  return {
    id: session?.user?.id || token?.sub || '',
    role: 'admin'
  };
}
