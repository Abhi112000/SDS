import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
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
          };
        } catch (e) {
          // helpful server-side logging for Vercel logs
          try { console.error('[auth] credentials authorize error', e?.message || e); } catch (__) {}
          throw e;
        }
      },
    }),

    // --- Google Login
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],

  pages: {
    signIn: "/login", // custom login page
  },

  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET || 'dev-secret-change-me',

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role || "user";
        token.sub = user.id || token.sub;
      }
      if (process.env.NODE_ENV !== 'production') {
        try{ console.log('next-auth jwt callback - token:', { sub: token.sub, role: token.role, user: !!user }); }catch(e){}
      }
      return token;
    },
    async session({ session, token }) {
      session.user.role = token.role;
      session.user.id = token.sub || session.user.id;
      if (process.env.NODE_ENV !== 'production') {
        try{ console.log('next-auth session callback - session user:', { id: session.user.id, role: session.user.role }); }catch(e){}
      }
      return session;
    },
  },
};

export default NextAuth(authOptions);
