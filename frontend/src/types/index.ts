export type Row = { id: string; name?: string; [key: string]: any };
export type User = {
  id: string;
  name: string;
  email: string;
  registration: string;
  role: 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'VIEWER';
  active: boolean;
};
export type Field = {
  key: string;
  label: string;
  type?: 'number' | 'date' | 'email' | 'password' | 'textarea' | 'select' | 'checkbox';
  required?: boolean;
  options?: { value: string; label: string }[];
  source?: string;
  min?: number;
};
export type Entity = {
  title: string;
  singular: string;
  description: string;
  fields: Field[];
  columns: { key: string; label: string }[];
  writers: User['role'][];
};
