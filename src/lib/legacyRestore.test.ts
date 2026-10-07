import { legacyRestoreTarget } from './legacyRestore';

const registry = { activeId: 'selected', firms: [{ id: 'selected', name: 'Example', createdAt: '', cloudId: 'existing' }] };

test('legacy restore targets only the explicitly selected accessible database firm', () => {
  expect(legacyRestoreTarget(registry, [{ firm_id: 'existing', role: 'owner' }])).toBe('existing');
  expect(() => legacyRestoreTarget(registry, [{ firm_id: 'other', role: 'owner' }])).toThrow();
  expect(() => legacyRestoreTarget(registry, [{ firm_id: 'existing', role: 'viewer' }])).toThrow();
  expect(() => legacyRestoreTarget({ ...registry, activeId: 'missing' }, [])).toThrow();
});
