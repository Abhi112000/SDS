import AdminOrders from './orders/index';
import { getSession } from 'next-auth/react';

export default AdminOrders;

export async function getServerSideProps(ctx) {
  const session = await getSession(ctx);
  if (!session || session.user?.role !== 'admin') return { redirect: { destination: '/login', permanent: false } };
  return { props: {} };
}
