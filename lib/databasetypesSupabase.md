npx supabase login

# After removing FM_CRS from your database, regenerate types to ensure it is not included in your TypeScript types.


npx supabase gen types typescript --project-id nktqfxfotmcbxufilcnh --schema public > lib/database.types.ts