import fs from 'fs';
import path from 'path';
import { CLOUD_SQL } from './cloudSql';

it('shows database setup, PIB protection and relational document migrations', () => {
  const migration = ['20261005120000_paperwork.sql', '20261007120000_firm_identity.sql', '20261007140000_relational_documents.sql', '20261007150000_remove_legacy_triggers.sql', '20261007160000_invoice_signature_visibility.sql', '20261007170000_account_profiles.sql']
    .map(file => fs.readFileSync(path.join(__dirname, '../../supabase/migrations', file), 'utf8').replace(/\r\n/g, '\n').trim())
    .join('\n\n');
  expect(CLOUD_SQL).toBe(migration);
});
