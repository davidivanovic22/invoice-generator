"""Narrow recovery metadata equivalence; genuine constraint drift must remain visible."""
import json,sys,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'scripts'))
from accounting_recovery import fingerprint

class FingerprintTests(unittest.TestCase):
    def metadata(self,expression,table='paperwork_fx_bank_accounts',validated=True):
        value={'data':{},'metadata':[['constraint','public',table,table+'_number_check',validated,expression]]}
        with patch('accounting_recovery.sql',return_value=json.dumps(value)):
            return fingerprint('paperwork_relational_123')['metadata']
    def test_known_equivalent_expression(self):
        nested="CHECK ((((length(number) >= 5) AND (length(number) <= 64)) AND (number ~ '^[A-Z0-9]+$'::text)))"
        flat="CHECK (((length(number) >= 5) AND (length(number) <= 64) AND (number ~ '^[A-Z0-9]+$'::text)))"
        self.assertEqual(self.metadata(nested),self.metadata(flat))
    def test_changed_bound_or_alphabet_is_not_equivalent(self):
        flat="CHECK (((length(number) >= 5) AND (length(number) <= 64) AND (number ~ '^[A-Z0-9]+$'::text)))"
        for changed in [flat.replace('<= 64','<= 63'),flat.replace('A-Z0-9','a-zA-Z0-9')]:
            self.assertNotEqual(self.metadata(flat),self.metadata(changed))
    def test_other_relation_and_validation_flag_remain_distinct(self):
        flat="CHECK (((length(number) >= 5) AND (length(number) <= 64) AND (number ~ '^[A-Z0-9]+$'::text)))"
        self.assertNotEqual(self.metadata(flat),self.metadata(flat,validated=False))
        self.assertEqual(self.metadata(flat,table='other')[0][-1],flat)

if __name__=='__main__':unittest.main()
