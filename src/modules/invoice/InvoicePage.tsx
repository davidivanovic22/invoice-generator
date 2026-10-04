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
import { A4ScaledPreview } from '../../components/invoice/A4ScaledPreview';
import { InvoiceVariantPicker } from '../../components/invoice/InvoiceVariantPicker';

import { useInvoices } from '../../hooks/useInvoices';
import { resolveInvoiceTheme } from '../../utils/invoiceTheme';
import { downloadDocumentPdf, previewDocumentPdf } from '../../utils/pdf';
import { calculateGrandTotal } from '../../utils/invoice';
import { formatMoney } from '../../utils/currency';
import { Icon } from '../../components/common/Icon';
import { WizardStepper, type WizardStep } from '../../components/common/WizardStepper';
import { WizardStepShell } from '../../components/common/WizardStepShell';

const STEP_ORDER = ['details', 'issuer', 'client', 'items', 'design', 'branding', 'finish'] as const;
type StepId = (typeof STEP_ORDER)[number];

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
    const [step, setStep] = useState<StepId>('details');

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
                fileName: `${activeInvoice.invoiceNumber}.pdf`
            });
        } catch (error) {
            console.error('PDF download failed:', error);
            alert('Failed to generate PDF.');
        }
    };

    const handleDelete = () => {
        const label = activeInvoice.invoiceNumber || 'this invoice';
        const isOnlyInvoice = state.invoices.length === 1;

        if (isOnlyInvoice) {
            alert("This is your only invoice, so it can't be deleted. Create another one first.");
            return;
        }

        const confirmed = window.confirm(`Delete invoice "${label}"? This can't be undone.`);

        if (confirmed) {
            deleteActiveInvoice();
        }
    };

    const handleResetCurrent = () => {
        const confirmed = window.confirm(
            "Reset this invoice? All fields will be cleared back to defaults. This can't be undone."
        );

        if (confirmed) {
            resetActiveInvoice();
        }
    };

    const grandTotal = calculateGrandTotal(activeInvoice);
    const theme = resolveInvoiceTheme(
        activeInvoice.editorSettings,
        activeInvoice.issueDate,
        activeInvoice.billingPeriod
    );
    const templateMode = activeInvoice.editorSettings.templateMode ?? 'manual';
    const templateModeLabel =
        templateMode === 'auto-month'
            ? 'Auto by month'
            : templateMode === 'auto-season'
                ? 'Auto by season'
                : (activeInvoice.editorSettings.templateKey ?? 'winter');

    const steps: WizardStep[] = [
        {
            id: 'details',
            label: 'Details',
            icon: <Icon name="document" className="h-4 w-4" />,
            isComplete: Boolean(activeInvoice.invoiceNumber && activeInvoice.billingPeriod)
        },
        {
            id: 'issuer',
            label: 'Issuer',
            icon: <Icon name="user" className="h-4 w-4" />,
            isComplete: Boolean(activeInvoice.issuer.name)
        },
        {
            id: 'client',
            label: 'Client',
            icon: <Icon name="users" className="h-4 w-4" />,
            isComplete: Boolean(activeInvoice.client.name)
        },
        {
            id: 'items',
            label: 'Items',
            icon: <Icon name="items" className="h-4 w-4" />,
            isComplete: activeInvoice.items.length > 0
        },
        {
            id: 'design',
            label: 'Design',
            icon: <Icon name="palette" className="h-4 w-4" />,
            isComplete: true
        },
        {
            id: 'branding',
            label: 'Logo & signature',
            icon: <Icon name="image" className="h-4 w-4" />,
            isComplete: Boolean(activeInvoice.logo || activeInvoice.signature)
        },
        {
            id: 'finish',
            label: 'Finish & export',
            icon: <Icon name="download" className="h-4 w-4" />,
            isComplete: false
        }
    ];

    const stepIndex = STEP_ORDER.indexOf(step);
    const goPrev = stepIndex > 0 ? () => setStep(STEP_ORDER[stepIndex - 1]) : undefined;
    const goNext = stepIndex < STEP_ORDER.length - 1 ? () => setStep(STEP_ORDER[stepIndex + 1]) : undefined;

    return (
        <div className="flex h-full min-h-0 w-full min-w-0 gap-6">
            {/* ================= LEFT PANEL ================= */}
            {/* Scrolls independently, capped to the viewport, so paging
                through wizard steps (or picking an older invoice down in
                "Finish & export") never depends on how tall the A4 preview
                on the right happens to be. */}
            <div className="h-full min-h-0 w-[420px] shrink-0 space-y-4 overflow-y-auto pr-2">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900">
                        Invoice Editor
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Follow the steps below — your preview updates live on the right.
                    </p>
                    <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                        <Icon name="check" className="h-3.5 w-3.5" />
                        Saved automatically to this browser
                    </div>
                </div>

                <ActionPanel
                    onCreate={createNewInvoice}
                    onDuplicate={duplicateActiveInvoice}
                    onDelete={handleDelete}
                    onPreviewPdf={handlePreviewPdf}
                    onDownloadPdf={handleDownloadPdf}
                />

                <WizardStepper steps={steps} currentId={step} onSelect={(id) => setStep(id as StepId)} />

                {step === 'details' && (
                    <WizardStepShell
                        title="Invoice details"
                        subtitle="The basics: number, dates, currency and any note."
                        stepNumber={1}
                        totalSteps={STEP_ORDER.length}
                        onNext={goNext}
                    >
                        <InvoiceMetaForm invoice={activeInvoice} onChange={updateInvoiceField} />
                    </WizardStepShell>
                )}

                {step === 'issuer' && (
                    <WizardStepShell
                        title="Who's issuing this invoice?"
                        subtitle="Your business details, as they should appear on the invoice."
                        stepNumber={2}
                        totalSteps={STEP_ORDER.length}
                        onPrev={goPrev}
                        onNext={goNext}
                    >
                        <PartyForm
                            title="Issuer"
                            party={activeInvoice.issuer}
                            onChange={(field, value) => updatePartyField('issuer', field, value)}
                            showIban
                        />
                    </WizardStepShell>
                )}

                {step === 'client' && (
                    <WizardStepShell
                        title="Who's this invoice for?"
                        subtitle="Your client's details."
                        stepNumber={3}
                        totalSteps={STEP_ORDER.length}
                        onPrev={goPrev}
                        onNext={goNext}
                    >
                        <PartyForm
                            title="Client"
                            party={activeInvoice.client}
                            onChange={(field, value) => updatePartyField('client', field, value)}
                        />
                    </WizardStepShell>
                )}

                {step === 'items' && (
                    <WizardStepShell
                        title="What are you billing for?"
                        subtitle={`${activeInvoice.items.length} item${activeInvoice.items.length === 1 ? '' : 's'} · ${formatMoney(grandTotal, activeInvoice.currency)} total`}
                        stepNumber={4}
                        totalSteps={STEP_ORDER.length}
                        onPrev={goPrev}
                        onNext={goNext}
                    >
                        <ItemsEditor
                            items={activeInvoice.items}
                            currency={activeInvoice.currency}
                            onAdd={addItem}
                            onRemove={removeItem}
                            onChange={updateItemField}
                        />
                    </WizardStepShell>
                )}

                {step === 'design' && (
                    <WizardStepShell
                        title="Pick a look"
                        subtitle={`Currently: ${templateModeLabel}`}
                        stepNumber={5}
                        totalSteps={STEP_ORDER.length}
                        onPrev={goPrev}
                        onNext={goNext}
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
                    </WizardStepShell>
                )}

                {step === 'branding' && (
                    <WizardStepShell
                        title="Logo & signature"
                        subtitle="Both are optional, but make an invoice look a lot more official."
                        stepNumber={6}
                        totalSteps={STEP_ORDER.length}
                        onPrev={goPrev}
                        onNext={goNext}
                    >
                        <div className="space-y-4">
                            <LogoPanel
                                hasLogo={Boolean(activeInvoice.logo)}
                                onUpload={handleLogoUpload}
                                onRemove={clearLogo}
                            />
                            <SignatureField
                                value={activeInvoice.signature}
                                onChange={(signature) => updateInvoiceField('signature', signature)}
                            />
                        </div>
                    </WizardStepShell>
                )}

                {step === 'finish' && (
                    <WizardStepShell
                        title="Finish & export"
                        subtitle="Download the PDF, switch invoices, or back everything up."
                        stepNumber={7}
                        totalSteps={STEP_ORDER.length}
                        onPrev={goPrev}
                    >
                        <div className="space-y-4">
                            <button
                                type="button"
                                onClick={handleDownloadPdf}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                            >
                                <Icon name="download" className="h-4 w-4" />
                                Download this invoice as PDF
                            </button>

                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                <div className="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
                                    <Icon name="list" className="h-4 w-4" />
                                    Invoice list
                                </div>
                                <p className="mb-3 text-xs text-slate-400">
                                    {state.invoices.length} invoice{state.invoices.length === 1 ? '' : 's'} saved in this browser
                                </p>
                                <InvoiceListPanel
                                    invoices={state.invoices}
                                    activeInvoiceId={state.activeInvoiceId}
                                    onSelect={selectInvoice}
                                />
                            </div>

                            <ImportExportPanel
                                onExportCurrent={exportCurrentInvoice}
                                onExportAll={exportAllInvoices}
                                onResetCurrent={handleResetCurrent}
                                onImport={handleImport}
                            />
                        </div>
                    </WizardStepShell>
                )}
            </div>

            {/* Right pane: scrolls vertically on its own, independent of the
                left column, so a tall A4 page never forces the whole app to
                scroll just to reach controls on the left. Horizontally it
                never scrolls — A4ScaledPreview shrinks the fixed-size page
                to fit instead, so there's no horizontal scrollbar even with
                the app sidebar open on a narrower window. */}
            <div className="h-full min-h-0 flex-1 min-w-0 overflow-x-hidden overflow-y-auto">
                <A4ScaledPreview>
                    <InvoiceEditorPreview
                        ref={editorPreviewRef}
                        invoice={activeInvoice}
                        onInvoiceFieldChange={updateInvoiceField}
                        onElementChange={updateEditorElement}
                        onElementRemove={removeEditorElement}
                    />
                </A4ScaledPreview>

                <InvoiceVariantPicker
                    images={theme.backgroundImages}
                    labels={theme.backgroundImageLabels}
                    activeIndex={theme.backgroundImageIndex}
                    accentColor={theme.accentColor}
                    onSelect={(index) =>
                        updateInvoiceField('editorSettings', {
                            ...activeInvoice.editorSettings,
                            templateVariantIndex: index
                        })
                    }
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
