import { getSession } from 'next-auth/react';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

export default async function handler(req,res){
  const clientSession = await getSession({ req });
  let serverSession = null;
  try{ serverSession = await getServerSession(req,res,authOptions); }catch(e){ serverSession = { error: e.message } }
  return res.status(200).json({ clientSession, serverSession });
}
