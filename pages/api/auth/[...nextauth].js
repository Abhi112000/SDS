import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import bcrypt from "bcryptjs";

export const authOptions = {
  providers: [
    // --- Manual Login (email/password)
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "you@example.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          await dbConnect();

          const user = await User.findOne({ email: credentials.email });
          if (!user) throw new Error("No user found with that email.");

          // The registration API stores the hashed password in `passwordHash`
          const hash = user.passwordHash || user.password;
          const isValid = await bcrypt.compare(credentials.password, hash || '');
          if (!isValid) throw new Error("Invalid password.");

          return {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role || "user",
            phone: user.phone || '',
            whatsapp: user.whatsapp || '',
            address: user.address || '',
            locationUrl: user.locationUrl || ''
          };
        } catch (e) {
          // helpful server-side logging for Vercel logs
          try { console.error('[auth] credentials authorize error', e?.message || e); } catch (__) {}
          throw e;
        }
      },
    }),
  ],

  pages: {
    signIn: "/login", // custom login page
  },

  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET || 'dev-secret-change-me',
  // enable verbose debug logs in development to help diagnose client/server session fetch issues
  debug: process.env.NODE_ENV !== 'production',

  callbacks: {
    async jwt({ token, user }) {
      try{
        if (user) {
          // Keep values primitive and serializable
          token.role = user.role || "user";
          token.sub = user.id || token.sub;
          token.phone = user.phone || '';
          token.whatsapp = user.whatsapp || '';
          token.address = user.address || '';
          token.locationUrl = user.locationUrl || '';
        }
        if (process.env.NODE_ENV !== 'production') {
          console.log('next-auth jwt callback - token:', { sub: token.sub, role: token.role, user: !!user });
        }
      }catch(err){
        console.error('[next-auth] jwt callback error', err && (err.stack || err.message || err));
      }
      return token;
    },
    async session({ session, token }) {
      try{
        // guard against unexpected shapes
        if(!session) session = {};
        if(!session.user) session.user = {};
        // copy only primitive values
        session.user.role = token?.role || session.user.role || 'user';
        session.user.id = token?.sub || session.user.id;
        session.user.phone = token?.phone || session.user.phone || '';
        session.user.whatsapp = token?.whatsapp || session.user.whatsapp || '';
        session.user.address = token?.address || session.user.address || '';
        session.user.locationUrl = token?.locationUrl || session.user.locationUrl || '';
        if (process.env.NODE_ENV !== 'production') {
          console.log('next-auth session callback - session user:', { id: session.user.id, role: session.user.role });
        }
      }catch(err){
        console.error('[next-auth] session callback error', err && (err.stack || err.message || err));
      }
      return session;
    },
  },
};

export default NextAuth(authOptions);
