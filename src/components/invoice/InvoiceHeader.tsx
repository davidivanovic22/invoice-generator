import type { InvoiceData } from '../../types/invoice';

type Props = {
    invoice: InvoiceData;
};

export const InvoiceHeader = ({ invoice }: Props) => {
    return (
        <header className="mb-5 flex items-start justify-between gap-6 border-b border-slate-200 pb-5 print:mb-4 print:pb-4">
            <div className="flex items-center gap-4">
                {invoice.logo && (
                    <div className="h-16 w-16 flex items-center justify-center rounded-2xl border border-slate-200 bg-white overflow-hidden">
                        <img
                            src={invoice.logo}
                            alt="Company logo"
                            className="max-h-full max-w-full object-contain"
                        />
                    </div>
                )}

                <div>
                    <h1 className="text-4xl font-extrabold leading-none tracking-tight text-slate-900">
                        INVOICE
                    </h1>
                    <p className="mt-2 text-sm text-slate-500">
                        Invoice number: {invoice.invoiceNumber}
                    </p>
                </div>
            </div>

            <div className="space-y-1 text-sm text-slate-700">
                <div>
                    <span className="font-semibold">Issue date:</span> {invoice.issueDate}
                </div>
                <div>
                    <span className="font-semibold">Due date:</span> {invoice.dueDate}
                </div>
                <div>
                    <span className="font-semibold">Billing period:</span> {invoice.billingPeriod}
                </div>
            </div>
        </header>
    );
};