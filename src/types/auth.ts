export type Role = 'admin' | 'officer' | 'user';

export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: Role;
  designation: string;
  token: string;
  loginTime: string;
}

export interface DemoAccount {
  role: Role;
  name: string;
  designation: string;
  email: string;
  password: string;
  badgeLabel: string;
  description: string;
}
