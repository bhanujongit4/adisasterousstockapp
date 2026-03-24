import { neon } from '@neondatabase/serverless'

export async function sql(strings: TemplateStringsArray, ...values: unknown[]) {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set')
  }

  const client = neon(databaseUrl)
  return client(strings, ...values)
}
