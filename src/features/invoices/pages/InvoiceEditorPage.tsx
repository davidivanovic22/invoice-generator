import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { printToPdf } from '../../../lib/pdf';
import { safeFileName } from '../../../lib/files';
import { A4Preview } from '../../../ui/A4Preview';
import { Button, IconButton } from '../../../ui/Button';
import { useFeedback } from '../../../ui/Feedback';
import { Icon } from '../../../ui/Icon';
import { EmptyState, Segmented } from '../../../ui/Layout';
import { InvoiceDocument } from '../document/InvoiceDocument';
import { ClientSection } from '../editor/ClientSection';
import { DesignSection } from '../editor/DesignSection';
import { DetailsSection } from '../editor/DetailsSection';
import { FromSection } from '../editor/FromSection';
import { ItemsSection } from '../editor/ItemsSection';
import { StatusBadge, StatusMenu } from '../components/Status';
import type { Invoice } from '../model';
import { useInvoiceStore } from '../store';

export const InvoiceEditorPage = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { store, updateInvoice, duplicateInvoice, deleteInvoice, setStatus, rememberClient } = useInvoiceStore();
  const { confirm, toast } = useFeedback();
  const invoice = store.invoices.find((candidate) => candidate.id === id);
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit');
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const onChange = useCallback((update: Partial<Invoice>) => updateInvoice(id, update), [id, updateInvoice]);

  // Save the client to the address book when leaving the editor (not on every keystroke).
  const latest = useRef(invoice);
  latest.current = invoice;
  const saveClient = useCallback(() => {
    const current = latest.current;
    if (!current?.client.name.trim()) return;
    const clientId = rememberClient(current.client, current.currency, current.clientId);
    if (clientId && clientId !== current.clientId) updateInvoice(current.id, { clientId });
  }, [rememberClient, updateInvoice]);
  useEffect(() => saveClient, [saveClient]);

  // A draft created before the business profile was filled in picks it up automatically.
  const profileParty = store.profile.party;
  const profileBank = store.profile.bank;
  useEffect(() => {
    const current = latest.current;
    if (current?.status === 'draft' && !current.issuer.name.trim() && profileParty.name.trim()) {
      updateInvoice(current.id, { issuer: { ...profileParty }, bank: { ...profileBank } });
    }
  }, [id, profileParty, profileBank, updateInvoice]);


  if (!invoice) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <EmptyState
          icon="file"
          title="Invoice not found"
          description="It may have been deleted, or it was created in another browser."
          action={
            <Link to="/invoices">
              <Button variant="primary">Back to invoices</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const exportPdf = async () => {
    saveClient();
    const node = exportRef.current;
    if (!node) return;
    setExporting(true);
    try {
      await printToPdf(node, safeFileName(`${invoice.design.language === 'en' ? 'Invoice' : 'Faktura'}-${invoice.number}`, 'invoice'));
    } catch (error) {
      console.error(error);
      toast('The PDF could not be created. Please try again.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleDuplicate = () => {
    saveClient();
    const copy = duplicateInvoice(invoice.id);
    if (copy) {
      navigate(`/invoices/${copy.id}`);
      toast(`Created invoice ${copy.number}`);
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Delete invoice ${invoice.number}?`,
      message: 'This removes it from this browser. Export a backup first if you might need it.',
      confirmLabel: 'Delete',
      tone: 'danger'
    });
    if (!ok) return;
    deleteInvoice(invoice.id);
    navigate('/invoices');
    toast('Invoice deleted');
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="sticky top-14 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center gap-2 px-4 py-2.5 sm:gap-3 sm:px-6">
          <Link to="/invoices" className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900">
            <Icon name="chevronLeft" />
            <span className="hidden sm:inline">Invoices</span>
          </Link>
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-[15px] font-semibold text-slate-900">Invoice {invoice.number}</h1>
            <StatusBadge invoice={invoice} />
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <StatusMenu invoice={invoice} onChange={(status) => setStatus(invoice.id, status)} />
            <IconButton icon="copy" label="Duplicate as new invoice" onClick={handleDuplicate} className="hidden sm:inline-flex" />
            <IconButton icon="trash" label="Delete invoice" tone="danger" onClick={handleDelete} />
            <Button variant="primary" icon="download" onClick={exportPdf} disabled={exporting} title="Opens the save dialog: choose “Save as PDF”">
              Download PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1600px] px-4 pt-4 sm:px-6 lg:hidden">
        <Segmented
          value={mobileView}
          onChange={setMobileView}
          options={[
            { value: 'edit', label: 'Edit' },
            { value: 'preview', label: 'Preview' }
          ]}
        />
      </div>

      <div className="mx-auto grid w-full max-w-[1600px] flex-1 gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(420px,560px)_1fr]">
        <div className={`space-y-4 ${mobileView === 'preview' ? 'hidden lg:block' : ''}`}>
          <ClientSection invoice={invoice} clients={store.clients} invoices={store.invoices} onChange={onChange} onCommit={saveClient} />
          <ItemsSection invoice={invoice} defaultUnit={store.profile.defaults.unit} onChange={onChange} />
          <DetailsSection invoice={invoice} invoices={store.invoices} numberPrefix={store.profile.defaults.numberPrefix} onChange={onChange} />
          <DesignSection invoice={invoice} profile={store.profile} onChange={(design) => onChange({ design })} />
          <FromSection invoice={invoice} profile={store.profile} onChange={onChange} />
        </div>
        <div className={mobileView === 'edit' ? 'hidden lg:block' : ''}>
          <div className="sticky top-[124px] max-h-[calc(100vh-140px)] overflow-y-auto rounded-xl pb-2 lg:pr-1">
            <div className="overflow-hidden rounded-xl shadow-[0_1px_3px_rgba(15,23,42,0.08),0_12px_40px_-12px_rgba(15,23,42,0.25)] ring-1 ring-slate-200">
              <A4Preview>
                <InvoiceDocument ref={exportRef} invoice={invoice} profile={store.profile} />
              </A4Preview>
            </div>
            <p className="mt-3 text-center text-xs text-slate-400">Live preview · saved automatically in this browser</p>
          </div>
        </div>
      </div>

    </div>
  );
};
