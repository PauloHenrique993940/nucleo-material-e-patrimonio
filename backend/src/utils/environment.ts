import 'dotenv/config';
const value = process.env.JWT_SECRET;
if (!value || value.length < 32 || value.startsWith('replace-'))
  throw new Error('Configure JWT_SECRET com pelo menos 32 caracteres aleatórios.');
export const jwtSecret = value;
