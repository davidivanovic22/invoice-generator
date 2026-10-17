import { z } from 'zod';
// PostgreSQL accepts every 128-bit UUID, including existing MD5-derived reversal IDs.
// Canonical lowercase transport is required for identity/scope comparisons.
export const accountingUuid=z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
