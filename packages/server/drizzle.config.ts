import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql', // 'pg' was renamed to 'postgresql' in newer versions
  dbCredentials: {
    url: 'postgres://myuser:mypassword@localhost:5432/mydatabase',
  },
});