import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { t } from '../../../i18n';
import { safeFileName } from '../../../lib/files';
import { printToPdf } from '../../../lib/pdf';
import { A4Preview } from '../../../ui/A4Preview';
import { Button } from '../../../ui/Button';
import { EditorToolbar, editTargetFrom, flash, MobileViewSwitch, PreviewHint, useUndoShortcuts } from '../../../ui/EditorChrome';
import { useFeedback } from '../../../ui/Feedback';
import { InlineEdit } from '../../../ui/InlineEdit';
import { EmptyState } from '../../../ui/Layout';
import { StatusMenu } from '../components/Status';
import { InvoiceDocument } from '../document/InvoiceDocument';
import { ClientSection } from '../editor/ClientSection';
import { DesignSection } from '../editor/DesignSection';
import { DetailsSection } from '../editor/DetailsSection';
import { FromSection } from '../editor/FromSection';
import { ItemsSection } from '../editor/ItemsSection';
import { isDefaultPeriod, isNumberTaken, periodLabel, type Invoice } from '../model';
import { useInvoiceStore } from '../store';

const SECTION_IDS: Record<string, string> = { client: 'client', items: 'items', details: 'details', from: 'from', design: 'design' };

export const InvoiceEditorPage = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { store, updateInvoice, duplicateInvoice, deleteInvoice, restoreInvoice, setStatus, rememberClient, updateProfile, undo, redo, canUndo, canRedo } =
    useInvoiceStore();
  const { toast } = useFeedback();
  const invoice = store.invoices.find((candidate) => candidate.id === id);
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit');
  const [exporting, setExporting] = useState(false);
  const [openFromToken, setOpenFromToken] = useState(0);
  const exportRef = useRef<HTMLDivElement>(null);

  const onChange = useCallback((update: Partial<Invoice>) => updateInvoice(id, update), [id, updateInvoice]);
  const onUndo = useCallback(() => undo(id), [id, undo]);
  const onRedo = useCallback(() => redo(id), [id, redo]);
  useUndoShortcuts(onUndo, onRedo);

  // Save the client to the address book when focus leaves it or the editor closes (not on every keystroke).
  const latest = useRef(invoice);
  latest.current = invoice;
  const saveClient = useCallback(() => {
    const current = latest.current;
    if (!current?.client.name.trim()) return;
    const clientId = rememberClient(current.client, current.currency, current.clientId);
    if (clientId && clientId !== current.clientId) updateInvoice(current.id, { clientId }, { record: false });
  }, [rememberClient, updateInvoice]);
  useEffect(() => saveClient, [saveClient]);

  // A draft created before the business profile was filled in picks it up automatically.
  const profileParty = store.profile.party;
  const profileBank = store.profile.bank;
  useEffect(() => {
    const current = latest.current;
    if (current?.status === 'draft' && !current.issuer.name.trim() && profileParty.name.trim()) {
      updateInvoice(current.id, { issuer: { ...profileParty }, bank: { ...profileBank } }, { record: false });
    }
  }, [id, profileParty, profileBank, updateInvoice]);

  const exportPdf = useCallback(async () => {
    const current = latest.current;
    const node = exportRef.current;
    if (!current || !node) return;
    saveClient();
    setExporting(true);
    toast(t('In the window that opens, choose "Save as PDF".'), 'info');
    try {
      await printToPdf(node, safeFileName(`${current.design.language === 'en' ? 'Invoice' : 'Faktura'}-${current.number}`, 'invoice'));
      // A downloaded invoice has been issued: count it as sent, so totals and the year overview are right.
      if (current.status === 'draft') {
        updateInvoice(current.id, { status: 'sent' }, { record: false });
        toast(t('Marked as sent. Mark it paid when the money arrives.'), 'info');
      }
    } catch (error) {
      console.error(error);
      toast(t('The PDF could not be created. Please try again.'), 'error');
    } finally {
      setExporting(false);
    }
  }, [saveClient, toast, updateInvoice]);

  // Arriving with ?print=1 (from "Create & download") opens the save dialog right away.
  useEffect(() => {
    if (searchParams.get('print') !== '1' || !latest.current) return;
    setSearchParams({}, { replace: true });
    const timer = setTimeout(exportPdf, 400);
    return () => clearTimeout(timer);
  }, [searchParams, setSearchParams, exportPdf]);

  if (!invoice) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <EmptyState
          icon="file"
          title={t('Invoice not found')}
          description={t('It may have been deleted, or it was created in another browser.')}
          action={
            <Link to="/invoices">
              <Button variant="primary">{t('Back to invoices')}</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const openSection = (target: string) => {
    const sectionId = SECTION_IDS[target];
    if (!sectionId) return;
    setMobileView('edit');
    if (sectionId === 'from') setOpenFromToken(Date.now());
    requestAnimationFrame(() => {
      const element = document.getElementById(sectionId);
      element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      flash(element);
      setTimeout(() => element?.querySelector<HTMLElement>('input, textarea')?.focus({ preventScroll: true }), 400);
    });
  };

  const handleDuplicate = () => {
    saveClient();
    const copy = duplicateInvoice(invoice.id);
    if (copy) {
      navigate(`/invoices/${copy.id}`);
      toast(t('Created invoice {number}', { number: copy.number }));
    }
  };

  const handleDelete = () => {
    const removed = deleteInvoice(invoice.id);
    navigate('/invoices');
    if (removed) toast(t('Invoice {number} deleted', { number: removed.number }), 'success', { label: t('Undo'), onClick: () => restoreInvoice(removed) });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <EditorToolbar
        backTo="/invoices"
        backLabel={t('Invoices')}
        onUndo={onUndo}
        onRedo={onRedo}
        canUndo={canUndo(id)}
        canRedo={canRedo(id)}
        title={
          <>
            <h1 className="hidden min-w-0 text-[15px] font-semibold text-slate-900 sm:block">
              <InlineEdit
                label={t('Invoice number')}
                value={invoice.number}
                display={`${t('Invoice')} ${invoice.number}`}
                validate={(number) => (isNumberTaken(store.invoices, number, invoice.id) ? t('Another invoice already uses this number.') : undefined)}
                onSave={(number) => onChange({ number })}
              />
            </h1>
            <StatusMenu invoice={invoice} onChange={(status) => setStatus(invoice.id, status)} />
          </>
        }
        menu={[
          { label: t('Duplicate as new invoice'), icon: 'copy', onSelect: handleDuplicate },
          { label: t('Business profile'), icon: 'building', onSelect: () => navigate('/profile') },
          'divider',
          { label: t('Delete invoice'), icon: 'trash', danger: true, onSelect: handleDelete }
        ]}
      >
        <Button icon="copy" onClick={handleDuplicate} title={t('Duplicate as new invoice')} aria-label={t('Duplicate as new invoice')}>
          <span className="hidden sm:inline">{t('Duplicate')}</span>
        </Button>
        <Button variant="primary" icon="download" onClick={exportPdf} disabled={exporting}>
          <span className="hidden sm:inline">{t('Download PDF')}</span>
          <span className="sm:hidden">PDF</span>
        </Button>
      </EditorToolbar>

      <MobileViewSwitch value={mobileView} onChange={setMobileView} />

      <div className="mx-auto grid w-full max-w-[1600px] flex-1 gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(420px,560px)_1fr]">
        <div className={`min-w-0 space-y-4 ${mobileView === 'preview' ? 'hidden lg:block' : ''}`}>
          <ClientSection invoice={invoice} clients={store.clients} invoices={store.invoices} onChange={onChange} onCommit={saveClient} />
          <ItemsSection invoice={invoice} defaultUnit={store.profile.defaults.unit} onChange={onChange} />
          <DetailsSection invoice={invoice} invoices={store.invoices} numberPrefix={store.profile.defaults.numberPrefix} onChange={onChange} />
          <DesignSection
            invoice={invoice}
            profile={store.profile}
            onChange={(design) =>
              onChange(
                design.language !== invoice.design.language && isDefaultPeriod(invoice.billingPeriod, invoice.issueDate)
                  ? { design, billingPeriod: periodLabel(invoice.issueDate, design.language) }
                  : { design }
              )
            }
          />
          <FromSection invoice={invoice} profile={store.profile} onChange={onChange} onProfileChange={updateProfile} forceOpenToken={openFromToken} />
        </div>
        <div className={`min-w-0 ${mobileView === 'edit' ? 'hidden lg:block' : ''}`}>
          <div className="sticky top-[124px] max-h-[calc(100vh-140px)] overflow-y-auto rounded-xl pb-2 lg:pr-1">
            <div
              className="editable-preview overflow-hidden rounded-xl shadow-[0_1px_3px_rgba(15,23,42,0.08),0_12px_40px_-12px_rgba(15,23,42,0.25)] ring-1 ring-slate-200"
              onClick={(event) => {
                const target = editTargetFrom(event);
                if (target) openSection(target.target);
              }}
            >
              <A4Preview>
                <InvoiceDocument ref={exportRef} invoice={invoice} profile={store.profile} />
              </A4Preview>
            </div>
            <PreviewHint />
          </div>
        </div>
      </div>
    </div>
  );
};
