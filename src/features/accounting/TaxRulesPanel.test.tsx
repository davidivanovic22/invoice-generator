import { fireEvent, render, screen } from '@testing-library/react';
import { TaxRulesPanel } from './TaxRulesPanel';

const firmId = '00000000-0000-4000-8000-000000000001';
const fill = () => {
  fireEvent.change(screen.getByLabelText('Pravna forma u primeru'),{target:{value:'doo'}});
  fireEvent.change(screen.getByLabelText('Poreski režim u primeru'),{target:{value:'regular_vat'}});
  fireEvent.change(screen.getByLabelText('Dokaz režima za primer'),{target:{value:'Potvrda PDV, probna firma'}});
  fireEvent.change(screen.getByLabelText('Datum prometa u primeru'),{target:{value:'2026-10-09'}});
  fireEvent.change(screen.getByLabelText('Osnovica primera RSD'),{target:{value:'1000,00'}});
};
it('requires an explicit firm regime and displays exact calculation and source links', () => {
  render(<TaxRulesPanel firmId={firmId}/>);
  expect(screen.getByLabelText('Poreski režim u primeru')).toHaveValue('');
  fill(); fireEvent.click(screen.getByRole('button',{name:'Proveri poreski primer'}));
  expect(screen.getByRole('status')).toHaveTextContent('PDV 200.00 RSD');
  expect(screen.getByRole('status')).toHaveTextContent('Ukupno 1200.00 RSD');
  expect(screen.getByRole('link',{name:'Zakon o PDV — Ministarstvo finansija'})).toHaveAttribute('href','https://www.mfin.gov.rs/sr/propisi-1/zakon-o-porezu-na-dodatu-vrednost--21');
  fireEvent.change(screen.getByLabelText('Osnovica primera RSD'),{target:{value:'2000'}});
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
it('requires reduced classification and keeps input deduction unassessed', () => {
  render(<TaxRulesPanel firmId={firmId}/>); fill();
  fireEvent.change(screen.getByLabelText('Poreska kategorija primera'),{target:{value:'reduced'}});
  fireEvent.click(screen.getByRole('button',{name:'Proveri poreski primer'}));
  expect(screen.getByRole('status')).toHaveTextContent('Potrebna poreska provera');
  fireEvent.change(screen.getByLabelText('Tačka člana 23 stav 2'),{target:{value:'1'}});
  fireEvent.change(screen.getByLabelText('Dokaz klasifikacije'),{target:{value:'Hleb, klasifikacija potvrđena'}});
  fireEvent.change(screen.getByLabelText('Smer primera'),{target:{value:'purchase'}});
  fireEvent.click(screen.getByRole('button',{name:'Proveri poreski primer'}));
  expect(screen.getByRole('status')).toHaveTextContent('PDV 100.00 RSD');
  expect(screen.getByRole('status')).toHaveTextContent('pravo na odbitak nije utvrđeno');
});
it('never shows a calculated tax for advances, exemptions or future years', () => {
  render(<TaxRulesPanel firmId={firmId}/>); fill();
  fireEvent.change(screen.getByLabelText('Datum ranijeg avansa (ako postoji)'),{target:{value:'2026-09-01'}});
  fireEvent.click(screen.getByRole('button',{name:'Proveri poreski primer'}));
  expect(screen.getByRole('status')).toHaveTextContent('Poreski datum: 2026-09-01');
  expect(screen.getByRole('status')).not.toHaveTextContent('PDV 200.00');
  fireEvent.change(screen.getByLabelText('Datum ranijeg avansa (ako postoji)'),{target:{value:''}});
  fireEvent.change(screen.getByLabelText('Datum prometa u primeru'),{target:{value:'2027-01-01'}});
  fireEvent.click(screen.getByRole('button',{name:'Proveri poreski primer'}));
  expect(screen.getByRole('status')).toHaveTextContent('Scenario nije podržan');
});
it('disables reference input during unresolved accounting commands and resets when keyed context changes', () => {
  const view=render(<TaxRulesPanel key={firmId} firmId={firmId}/>); fill();
  view.rerender(<TaxRulesPanel key={firmId} firmId={firmId} disabled/>);
  expect(screen.getByRole('button',{name:'Proveri poreski primer'})).toBeDisabled();
  expect(screen.getByLabelText('Poreski režim u primeru')).toBeDisabled();
  const other='00000000-0000-4000-8000-000000000002';
  view.rerender(<TaxRulesPanel key={other} firmId={other}/>);
  expect(screen.getByLabelText('Poreski režim u primeru')).toHaveValue('');
  expect(screen.getByLabelText('Dokaz režima za primer')).toHaveValue('');
});
