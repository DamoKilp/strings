# Supabase Data Retrieval (Typed, RLS-safe)

## Critical Requirements
- RLS enabled; never bypass in app code
- Use typed RPCs for complex identifiers; direct typed selects for simple reads
- No `exec_sql`
- Fetch minimal columns; prefer keyset pagination for large tables

## Patterns
- Server: `const supabase = await createClient()` in route/actions
- Typed RPC example:
```ts
const { data, error } = await supabase.rpc('get_public_table_columns', { p_table: 'conversations' });
```
- Direct select example:
```ts
const { data, error } = await supabase
  .from('conversations')
  .select('id,title,updated_at', { count: 'exact' })
  .order('updated_at', { ascending: false })
  .limit(30)
```

