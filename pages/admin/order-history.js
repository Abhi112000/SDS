import AdminOrders from './orders/index';
import { getSession } from 'next-auth/react';
import { authRedirect } from '@/lib/authRedirect';

export default AdminOrders;

export async function getServerSideProps(ctx) {
  const session = await getSession(ctx);
  if (!session || session.user?.role !== 'admin') return authRedirect(ctx);
  return { props: {} };
}