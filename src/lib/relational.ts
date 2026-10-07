import type { SupabaseClient } from '@supabase/supabase-js';

export type DatabaseDocument = { firm_id: string | null; key: string; data: unknown; updated_at: string };

export const readDatabaseDocuments = async (client: SupabaseClient, firmIds: string[], personal = true): Promise<DatabaseDocument[]> => {
  const result = await client.rpc('paperwork_read_documents', { p_firm_ids: firmIds, p_personal: personal });
  if (result.error?.code === 'PGRST202') throw new Error('Apply database migration 20261007140000_relational_documents.sql before using this version of the app.');
  if (result.error) throw result.error;
  return result.data ?? [];
};

/** The RPC splits the transport object into typed rows in one database transaction. */
export const saveDatabaseDocument = async (client: SupabaseClient, firmId: string | null, key: string, data: unknown, expected?: string) => {
  const result = await client.rpc('paperwork_save_document', { p_firm_id: firmId, p_key: key, p_data: data, p_expected: expected ?? null });
  if (result.error) throw result.error;
  return result.data as string;
};
