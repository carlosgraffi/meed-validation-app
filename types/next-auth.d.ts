import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      isAdmin: boolean;
    };
  }
  interface User {
    id: string;
    email: string;
    name?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    expertId?: string;
    email?: string;
    name?: string;
    isAdmin?: boolean;
  }
}
