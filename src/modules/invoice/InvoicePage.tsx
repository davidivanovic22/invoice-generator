import { useRef, useState } from 'react';

import { ActionPanel } from '../../components/sidebar/ActionPanel';
import { InvoiceListPanel } from '../../components/sidebar/InvoiceListPanel';
import { ImportExportPanel } from '../../components/sidebar/ImportExportPanel';
import { InvoiceMetaForm } from '../../components/sidebar/InvoiceMetaForm';
import { PartyForm } from '../../components/sidebar/PartyForm';
import { LogoPanel } from '../../components/sidebar/LogoPanel';
import { ItemsEditor } from '../../components/sidebar/ItemsEditor';
import { SignatureField } from '../../components/sidebar/SignatureField';
import { InvoiceEditorPanel } from '../../components/sidebar/InvoiceEditorPanel';

import { InvoiceEditorPreview } from '../../components/invoice/InvoiceEditorPreview';
import { InvoicePrintPreview } from '../../components/invoice/InvoicePrintPreview';

import { useInvoices } from '../../hooks/useInvoices';
import { downloadDocumentPdf, previewDocumentPdf } from '../../utils/pdf';
import { AccordionSection } from '../../components/common/AcordionSection';

export const InvoicePage = () => {
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
    const [openSection, setOpenSection] = useState<string>('invoice');


    if (!activeInvoice) {
        return (
            <div className="grid min-h-full place-items-center p-6">
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
            await previewDocumentPdf({
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
            await downloadDocumentPdf({
                element: printPreviewRef.current,
                fileName: `invoice-${activeInvoice.invoiceNumber}.pdf`
            });
        } catch (error) {
            console.error('PDF download failed:', error);
            alert('Failed to generate PDF.');
        }
    };


    const handleToggleSection = (sectionId: string) => {
        setOpenSection((current) => (current === sectionId ? '' : sectionId));
    };

    return (
        <div className="flex w-full min-w-0 gap-6">
            {/* ================= LEFT PANEL ================= */}
            <div className="w-[380px] shrink-0 space-y-4 overflow-y-auto pr-2">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900">
                        Invoice Editor
                    </h1>
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

                <ImportExportPanel
                    onExportCurrent={exportCurrentInvoice}
                    onExportAll={exportAllInvoices}
                    onResetCurrent={resetActiveInvoice}
                    onImport={handleImport}
                />
                <AccordionSection
                    id="invoice-list"
                    title="Invoice list"
                    isOpen={openSection === 'invoice-list'}
                    onToggle={handleToggleSection}
                >
                    <InvoiceListPanel
                        invoices={state.invoices}
                        activeInvoiceId={state.activeInvoiceId}
                        onSelect={selectInvoice}
                    />
                </AccordionSection>


                <AccordionSection
                    id="invoice"
                    title="Invoice"
                    isOpen={openSection === 'invoice'}
                    onToggle={handleToggleSection}
                >
                    <InvoiceMetaForm
                        invoice={activeInvoice}
                        onChange={updateInvoiceField}
                    />
                </AccordionSection>
                <AccordionSection
                    id="logo"
                    title="Logo panel"
                    isOpen={openSection === 'logo'}
                    onToggle={handleToggleSection}
                >
                    <LogoPanel
                        hasLogo={Boolean(activeInvoice.logo)}
                        onUpload={handleLogoUpload}
                        onRemove={clearLogo}
                    />
                </AccordionSection>

                <AccordionSection
                    id="signature"
                    title="Signature field"
                    isOpen={openSection === 'signature'}
                    onToggle={handleToggleSection}
                >
                    <SignatureField
                        value={activeInvoice.signature}
                        onChange={(signature) =>
                            updateInvoiceField('signature', signature)
                        }
                    />
                </AccordionSection>

                <AccordionSection
                    id="theme"
                    title="Theme selector"
                    isOpen={openSection === 'theme'}
                    onToggle={handleToggleSection}
                >
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
                </AccordionSection>

                <AccordionSection
                    id="issuer"
                    title="Issuer"
                    isOpen={openSection === 'issuer'}
                    onToggle={handleToggleSection}
                >
                    <PartyForm
                        title="Issuer"
                        party={activeInvoice.issuer}
                        onChange={(field, value) =>
                            updatePartyField('issuer', field, value)
                        }
                        showIban
                    />
                </AccordionSection>

                <AccordionSection
                    id="client"
                    title="Client"
                    isOpen={openSection === 'client'}
                    onToggle={handleToggleSection}
                >
                    <PartyForm
                        title="Client"
                        party={activeInvoice.client}
                        onChange={(field, value) =>
                            updatePartyField('client', field, value)
                        }
                    />
                </AccordionSection>

                <AccordionSection
                    id="items"
                    title="Items"
                    isOpen={openSection === 'items'}
                    onToggle={handleToggleSection}
                >
                    <ItemsEditor
                        items={activeInvoice.items}
                        currency={activeInvoice.currency}
                        onAdd={addItem}
                        onRemove={removeItem}
                        onChange={updateItemField}
                    />
                </AccordionSection>

            </div>

            <div className="flex-1 min-w-0">
                <InvoiceEditorPreview
                    ref={editorPreviewRef}
                    invoice={activeInvoice}
                    onInvoiceFieldChange={updateInvoiceField}
                    onElementChange={updateEditorElement}
                    onElementRemove={removeEditorElement}
                />

                <div className="pointer-events-none fixed left-[-99999px] top-0 opacity-0">
                    <InvoicePrintPreview
                        ref={printPreviewRef}
                        invoice={activeInvoice}
                    />
                </div>
            </div>
        </div>
    );
};