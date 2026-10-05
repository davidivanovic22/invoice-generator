import fs from 'fs';
import path from 'path';
import { CLOUD_SQL } from './cloudSql';

it('shows the same SQL as the migration', () => {
  const migration = fs.readFileSync(path.join(__dirname, '../../supabase/migrations/20261005120000_paperwork.sql'), 'utf8').replace(/\r\n/g, '\n').trim();
  expect(CLOUD_SQL).toBe(migration);
});
