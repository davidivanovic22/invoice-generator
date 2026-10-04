import { useMemo, useRef, useState } from 'react';
import { Button } from '../../../ui/Button';
import { inputClass } from '../../../ui/Field';
import { Icon } from '../../../ui/Icon';
import { Section } from '../../../ui/Layout';
import { formatMinor } from '../../../utils/money';
import { createParty, invoiceTotals, sameClient, type Client, type Invoice, type LineItem, type Party } from '../model';
import { PartyFields } from './PartyFields';
import { createId } from '../../../lib/files';

type Props = {
  invoice: Invoice;
  clients: Client[];
  invoices: Invoice[];
  onChange: (update: Partial<Invoice>) => void;
  /** Called when focus leaves the section: the moment to save the client to the address book. */
  onCommit: () => void;
};

const itemsAreBlank = (items: LineItem[]) => items.every((item) => !item.title.trim() && !item.description.trim() && item.unitPrice === 0);

export const ClientSection = ({ invoice, clients, invoices, onChange, onCommit }: Props) => {
  const [query, setQuery] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const name = query ?? invoice.client.name;

  const matches = useMemo(() => {
    const needle = name.trim().toLowerCase();
    return clients
      .filter((client) => !needle || client.party.name.toLowerCase().includes(needle))
      .filter((client) => !sameClient(client.party, invoice.client) || query !== null)
      .sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt))
      .slice(0, 6);
  }, [clients, name, invoice.client, query]);

  const open = query !== null && matches.length > 0;

  const pick = (client: Client) => {
    onChange({ client: { ...client.party }, clientId: client.id, currency: client.currency || invoice.currency });
    setQuery(null);
  };

  // Editing details keeps the link to the saved client (so they update it); a new name means a new client.
  const setParty = (party: Party) =>
    onChange(party.name === invoice.client.name ? { client: party } : { client: party, clientId: null });

  // Offer to repeat the most recent other invoice for this client.
  const previous = useMemo(() => {
    if (!invoice.client.name.trim() || !itemsAreBlank(invoice.items)) return null;
    return (
      invoices
        .filter((candidate) => candidate.id !== invoice.id && sameClient(candidate.client, invoice.client) && !itemsAreBlank(candidate.items))
        .sort((a, b) => b.issueDate.localeCompare(a.issueDate))[0] ?? null
    );
  }, [invoice, invoices]);

  const nameField = (
    <div className="relative">
      <label htmlFor="client-name" className="mb-1.5 block text-[13px] font-medium text-slate-700">
        Name or company
      </label>
      <div className="relative">
        <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          id="client-name"
          role="combobox"
          aria-expanded={open}
          aria-controls="client-suggestions"
          aria-autocomplete="list"
          autoComplete="off"
          value={name}
          placeholder={clients.length ? 'Search your clients or type a new name' : 'Client name'}
          className={`${inputClass} pl-9`}
          onFocus={() => setQuery(invoice.client.name)}
          onBlur={() => setTimeout(() => setQuery(null), 120)}
          onChange={(event) => {
            setQuery(event.target.value);
            setHighlight(0);
            setParty({ ...invoice.client, name: event.target.value });
          }}
          onKeyDown={(event) => {
            if (!open) return;
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setHighlight((value) => Math.min(matches.length - 1, value + 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setHighlight((value) => Math.max(0, value - 1));
            } else if (event.key === 'Enter') {
              event.preventDefault();
              pick(matches[highlight]);
              inputRef.current?.blur();
            } else if (event.key === 'Escape') {
              setQuery(null);
            }
          }}
        />
      </div>
      {open && (
        <ul id="client-suggestions" role="listbox" className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl bg-white py-1 shadow-lg ring-1 ring-slate-200">
          {matches.map((client, index) => (
            <li key={client.id} role="option" aria-selected={index === highlight}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(client)}
                onMouseEnter={() => setHighlight(index)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left ${index === highlight ? 'bg-indigo-50' : ''}`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                  {client.party.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-900">{client.party.name}</span>
                  <span className="block truncate text-xs text-slate-500">{[client.party.cityCountry, client.party.taxId].filter(Boolean).join(' · ') || 'Saved client'}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <Section
      id="client"
      title="Bill to"
      icon="users"
      description={invoice.client.name ? invoice.client.name : 'Who is this invoice for?'}
      actions={
        invoice.client.name ? (
          <Button size="sm" variant="ghost" onClick={() => onChange({ client: createParty(), clientId: null })}>
            Clear
          </Button>
        ) : undefined
      }
    >
      <div
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onCommit();
        }}
      >
        <PartyFields party={invoice.client} onChange={setParty} nameSlot={nameField} />
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
        <Icon name="check" className="h-3.5 w-3.5 text-emerald-500" />
        Clients are saved automatically, so next time just start typing their name.
      </p>
      {previous && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-indigo-50 px-4 py-3 ring-1 ring-indigo-100">
          <div className="min-w-0 text-sm">
            <div className="font-medium text-indigo-900">Same work as last time?</div>
            <div className="truncate text-indigo-700/80">
              Invoice {previous.number} · {previous.items.length} item{previous.items.length === 1 ? '' : 's'} ·{' '}
              {formatMinor(invoiceTotals(previous).totalMinor, previous.currency)}
            </div>
          </div>
          <Button
            size="sm"
            variant="accent"
            icon="refresh"
            onClick={() =>
              onChange({
                items: previous.items.map((item) => ({ ...item, id: createId() })),
                currency: previous.currency,
                vatPercent: previous.vatPercent
              })
            }
          >
            Repeat items
          </Button>
        </div>
      )}
    </Section>
  );
};
