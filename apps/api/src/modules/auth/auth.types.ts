export interface AuthUser {
  id: string;
  username: string;
  name: string;
  email?: string | null;
  locale: string;
  roles: string[];
  permissions: string[];
}

export interface JwtPayload {
  sub: string;
  username: string;
}
