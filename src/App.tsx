import { useRef } from 'react';
import { AppShell } from './components/layout/AppShell';
import { Sidebar } from './components/layout/Sidebar';
import { MainContent } from './components/layout/MainContent';
import { ActionPanel } from './components/sidebar/ActionPanel';
import { InvoiceListPanel } from './components/sidebar/InvoiceListPanel';
import { ImportExportPanel } from './components/sidebar/ImportExportPanel';
import { InvoiceMetaForm } from './components/sidebar/InvoiceMetaForm';
import { PartyForm } from './components/sidebar/PartyForm';
import { LogoPanel } from './components/sidebar/LogoPanel';
import { ItemsEditor } from './components/sidebar/ItemsEditor';
import { SignatureField } from './components/sidebar/SignatureField';
import { InvoiceEditorPanel } from './components/sidebar/InvoiceEditorPanel';
import { InvoiceEditorPreview } from './components/invoice/InvoiceEditorPreview';
import { InvoicePrintPreview } from './components/invoice/InvoicePrintPreview';
import { useInvoices } from './hooks/useInvoices';
import { downloadInvoicePdf, previewInvoicePdf } from './utils/pdf';

function App() {
  const {
    state,
    activeInvoice,
    createNewInvoice,
    duplicateActiveInvoice,
    deleteActiveInvoice,
    resetActiveInvoice,
    selectInvoice,
    updateInvoiceField,
    updatePartyField,
    addItem,
    removeItem,
    updateItemField,
    setLogo,
    clearLogo,
    addTextElement,
    updateEditorElement,
    removeEditorElement,
    exportCurrentInvoice,
    exportAllInvoices,
    importFromJson
  } = useInvoices();

  const fileReaderRef = useRef<FileReader | null>(null);
  const editorPreviewRef = useRef<HTMLDivElement | null>(null);
  const printPreviewRef = useRef<HTMLDivElement | null>(null);

  if (!activeInvoice) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-100 p-6">
        <div className="rounded-2xl bg-white p-6 shadow-soft">
          Unable to load invoice.
        </div>
      </div>
    );
  }

  const handleLogoUpload = (file: File) => {
    const reader = new FileReader();
    fileReaderRef.current = reader;

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setLogo(reader.result);
      }
    };

    reader.readAsDataURL(file);
  };

  const handleImport = async (file: File) => {
    try {
      await importFromJson(file);
    } catch {
      alert('Invalid JSON file.');
    }
  };

  const handlePreviewPdf = async () => {
    if (!printPreviewRef.current) return;

    try {
      await previewInvoicePdf({
        element: printPreviewRef.current
      });
    } catch (error) {
      console.error('PDF preview failed:', error);
      alert('Failed to preview PDF.');
    }
  };

  const handleDownloadPdf = async () => {
    if (!printPreviewRef.current) return;

    try {
      await downloadInvoicePdf({
        element: printPreviewRef.current,
        fileName: `invoice-${activeInvoice.invoiceNumber}.pdf`
      });
    } catch (error) {
      console.error('PDF download failed:', error);
      alert('Failed to generate PDF.');
    }
  };

  return (
    <AppShell>
      <Sidebar>
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Invoice Editor</h1>
            <p className="mt-1 text-sm text-slate-500">
              Edit on preview, drag elements, export clean PDF
            </p>
          </div>

          <ActionPanel
            onCreate={createNewInvoice}
            onDuplicate={duplicateActiveInvoice}
            onDelete={deleteActiveInvoice}
            onPreviewPdf={handlePreviewPdf}
            onDownloadPdf={handleDownloadPdf}
          />

          <InvoiceListPanel
            invoices={state.invoices}
            activeInvoiceId={state.activeInvoiceId}
            onSelect={selectInvoice}
          />

          <ImportExportPanel
            onExportCurrent={exportCurrentInvoice}
            onExportAll={exportAllInvoices}
            onResetCurrent={resetActiveInvoice}
            onImport={handleImport}
          />

          <InvoiceMetaForm invoice={activeInvoice} onChange={updateInvoiceField} />

          <LogoPanel
            hasLogo={Boolean(activeInvoice.logo)}
            onUpload={handleLogoUpload}
            onRemove={clearLogo}
          />

          <SignatureField
            value={activeInvoice.signature}
            onChange={(signature) => updateInvoiceField('signature', signature)}
          />

          <InvoiceEditorPanel
            settings={activeInvoice.editorSettings}
            issueDate={activeInvoice.issueDate}
            onAddText={addTextElement}
            onChange={(field, value) =>
              updateInvoiceField('editorSettings', {
                ...activeInvoice.editorSettings,
                [field]: value
              })
            }
          />

          <PartyForm
            title="Issuer"
            party={activeInvoice.issuer}
            onChange={(field, value) => updatePartyField('issuer', field, value)}
            showIban
          />

          <PartyForm
            title="Client"
            party={activeInvoice.client}
            onChange={(field, value) => updatePartyField('client', field, value)}
          />

          <ItemsEditor
            items={activeInvoice.items}
            currency={activeInvoice.currency}
            onAdd={addItem}
            onRemove={removeItem}
            onChange={updateItemField}
          />
        </div>
      </Sidebar>

      <MainContent>
        <InvoiceEditorPreview
          ref={editorPreviewRef}
          invoice={activeInvoice}
          onInvoiceFieldChange={updateInvoiceField}
          onElementChange={updateEditorElement}
          onElementRemove={removeEditorElement}
        />

        <div className="pointer-events-none fixed left-[-99999px] top-0 opacity-0">
          <InvoicePrintPreview ref={printPreviewRef} invoice={activeInvoice} />
        </div>
      </MainContent>
    </AppShell>
  );
}

export default App;