import { formatDateNumeric } from '../../lib/dates';
import { formatAmount } from '../../lib/money';
import type { BusinessProfile } from '../invoices/model';
import { bookYear, entryTotal, yearTotals, type KpoBook } from '../kpo/model';
import { FLAT_RATE_LIMIT_RSD, type MonthRow } from './model';

type Props = {
  year: number;
  profile: BusinessProfile;
  book: KpoBook;
  rows: MonthRow[];
  currency: 'EUR' | 'RSD';
  income: number;
  tax: number;
  incomeRsd: number;
  today: string;
};

const MONTHS = ['januar', 'februar', 'mart', 'april', 'maj', 'jun', 'jul', 'avgust', 'septembar', 'oktobar', 'novembar', 'decembar'];

/**
 * A4 yearly summary for the accountant or the tax office: totals, month by
 * month, and the booked KPO entries. Always in Serbian, like the KPO form.
 */
export const YearReport = ({ year, profile, book, rows, currency, income, tax, incomeRsd, today }: Props) => {
  const money = (value: number) => formatAmount(value, currency, 'sr-Latn-RS');
  const entries = bookYear(book, year, today).filter((row) => !row.planned);
  const kpo = yearTotals(entries);
  const share = Math.round((incomeRsd / FLAT_RATE_LIMIT_RSD) * 100);
  const cell = 'border border-slate-200 px-2 py-1';
  const party = profile.party;
  return (
    <div data-pdf-page className="box-border w-[210mm] bg-white px-[16mm] py-[15mm] font-sans text-[10px] text-slate-900" style={{ minHeight: '297mm' }}>
      <div className="flex items-start justify-between border-b-2 border-slate-800 pb-3">
        <div>
          <div className="text-[15px] font-bold">{party.name || '—'}</div>
          <div className="mt-0.5 text-slate-600">{[party.address, party.cityCountry].filter(Boolean).join(', ')}</div>
          <div className="text-slate-600">{[party.taxId && `PIB ${party.taxId}`, party.regNo && `Matični broj ${party.regNo}`].filter(Boolean).join(' · ')}</div>
        </div>
        <div className="text-right">
          <div className="text-[18px] font-bold tracking-tight">Godišnji pregled {year}.</div>
          <div className="text-slate-500">Sastavljeno {formatDateNumeric(today)}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {[
          ['Prihod', money(income)],
          ['Plaćen porez i doprinosi', money(tax)],
          ['Zarada posle poreza', money(income - tax)],
          ['Limit za paušal (6 mil. RSD)', `${share}%`]
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border border-slate-200 px-2.5 py-2">
            <div className="text-[8.5px] uppercase tracking-wide text-slate-500">{label}</div>
            <div className="mt-0.5 text-[13px] font-bold">{value}</div>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[8.5px] text-slate-500">
        Prihod u dinarima po srednjem kursu NBS na dan knjiženja: {formatAmount(incomeRsd, 'RSD', 'sr-Latn-RS')}.
      </p>

      <h2 className="mt-5 text-[11px] font-bold">Po mesecima</h2>
      <table className="mt-1.5 w-full border-collapse">
        <thead>
          <tr className="bg-slate-800 text-white">
            <th className={`${cell} border-slate-800 text-left`}>Mesec</th>
            <th className={`${cell} border-slate-800 text-right`}>Prihod</th>
            <th className={`${cell} border-slate-800 text-right`}>Porez i doprinosi</th>
            <th className={`${cell} border-slate-800 text-right`}>Zarada posle poreza</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.month} className={index % 2 ? 'bg-slate-50' : ''}>
              <td className={`${cell} capitalize`}>{MONTHS[row.month - 1]}</td>
              <td className={`${cell} text-right`}>{money(row.income)}</td>
              <td className={`${cell} text-right`}>{row.taxPlanned ? '—' : money(row.tax)}</td>
              <td className={`${cell} text-right font-semibold`}>{money(row.net)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-800 font-bold">
            <td className={cell}>Ukupno</td>
            <td className={`${cell} text-right`}>{money(income)}</td>
            <td className={`${cell} text-right`}>{money(tax)}</td>
            <td className={`${cell} text-right`}>{money(income - tax)}</td>
          </tr>
        </tfoot>
      </table>

      {entries.length > 0 && (
        <>
          <h2 className="mt-5 text-[11px] font-bold">KPO knjiga — proknjiženi promet</h2>
          <table className="mt-1.5 w-full border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className={`${cell} w-[13mm] whitespace-nowrap border-slate-800`}>R. br.</th>
                <th className={`${cell} w-[22mm] border-slate-800 text-left`}>Datum</th>
                <th className={`${cell} border-slate-800 text-left`}>Opis knjiženja</th>
                <th className={`${cell} w-[30mm] border-slate-800 text-right`}>Iznos</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(({ entry, number }, index) => (
                <tr key={entry.id} className={index % 2 ? 'bg-slate-50' : ''}>
                  <td className={`${cell} text-center`}>{number}</td>
                  <td className={cell}>{formatDateNumeric(entry.date)}</td>
                  <td className={cell}>{entry.description}</td>
                  <td className={`${cell} text-right`}>{formatAmount(entryTotal(entry), book.currency, 'sr-Latn-RS')}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-800 font-bold">
                <td className={cell} colSpan={3}>
                  Ukupno proknjiženo
                </td>
                <td className={`${cell} text-right`}>{formatAmount(kpo.total, book.currency, 'sr-Latn-RS')}</td>
              </tr>
            </tfoot>
          </table>
        </>
      )}

      <p className="mt-6 text-[8.5px] text-slate-400">Pregled je informativan i sastavljen iz podataka unetih u aplikaciju Paperwork. Ne zamenjuje poresku prijavu ni zvaničnu evidenciju.</p>
    </div>
  );
};
