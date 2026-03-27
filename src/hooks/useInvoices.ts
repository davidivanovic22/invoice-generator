import { useEffect, useMemo, useState } from 'react';
import type {
  EditableInvoiceField,
  EditorElement,
  InvoiceData,
  InvoiceItem,
  InvoicesState,
  PartyDetails
} from '../types/invoice';
import {
  createEditorElement,
  createId,
  createInvoice,
  createInvoiceItem,
  createInvoiceNumber
} from '../utils/invoice';
import { loadInvoicesState, normalizeInvoice, saveInvoicesState } from '../utils/storage';

const createInitialState = (): InvoicesState => {
  const stored = loadInvoicesState();

  if (stored?.invoices.length) {
    return stored;
  }

  const firstInvoice = createInvoice();

  return {
    invoices: [firstInvoice],
    activeInvoiceId: firstInvoice.id
  };
};

export const useInvoices = () => {
  const [state, setState] = useState<InvoicesState>(createInitialState);

  useEffect(() => {
    saveInvoicesState(state);
  }, [state]);

  const activeInvoice = useMemo(() => {
    return (
      state.invoices.find((invoice) => invoice.id === state.activeInvoiceId) ??
      state.invoices[0] ??
      null
    );
  }, [state]);

  const updateActiveInvoice = (updater: (invoice: InvoiceData) => InvoiceData) => {
    setState((prev) => ({
      ...prev,
      invoices: prev.invoices.map((invoice) =>
        invoice.id === prev.activeInvoiceId
          ? {
              ...updater(invoice),
              updatedAt: new Date().toISOString()
            }
          : invoice
      )
    }));
  };

  const createNewInvoice = () => {
    const invoice = createInvoice();

    setState((prev) => ({
      invoices: [invoice, ...prev.invoices],
      activeInvoiceId: invoice.id
    }));
  };

  const duplicateActiveInvoice = () => {
    if (!activeInvoice) return;

    const now = new Date().toISOString();

    const copy: InvoiceData = {
      ...activeInvoice,
      id: createId(),
      invoiceNumber: createInvoiceNumber(),
      items: activeInvoice.items.map((item) => ({
        ...item,
        id: createId()
      })),
      editorSettings: {
        ...activeInvoice.editorSettings,
        elements: activeInvoice.editorSettings.elements.map((element) => ({
          ...element,
          id: createId()
        }))
      },
      createdAt: now,
      updatedAt: now
    };

    setState((prev) => ({
      invoices: [copy, ...prev.invoices],
      activeInvoiceId: copy.id
    }));
  };

  const deleteActiveInvoice = () => {
    if (!activeInvoice || state.invoices.length === 1) return;

    const filtered = state.invoices.filter((invoice) => invoice.id !== activeInvoice.id);

    setState({
      invoices: filtered,
      activeInvoiceId: filtered[0]?.id ?? null
    });
  };

  const resetActiveInvoice = () => {
    if (!activeInvoice) return;

    const fresh = createInvoice();
    fresh.id = activeInvoice.id;
    fresh.createdAt = activeInvoice.createdAt;
    fresh.updatedAt = new Date().toISOString();

    setState((prev) => ({
      ...prev,
      invoices: prev.invoices.map((invoice) =>
        invoice.id === activeInvoice.id ? fresh : invoice
      )
    }));
  };

  const selectInvoice = (invoiceId: string) => {
    setState((prev) => ({
      ...prev,
      activeInvoiceId: invoiceId
    }));
  };

  const updateInvoiceField = <K extends EditableInvoiceField>(
    field: K,
    value: InvoiceData[K]
  ) => {
    updateActiveInvoice((invoice) => ({
      ...invoice,
      [field]: value
    }));
  };

  const updatePartyField = (
    section: 'issuer' | 'client',
    field: keyof PartyDetails,
    value: string
  ) => {
    updateActiveInvoice((invoice) => ({
      ...invoice,
      [section]: {
        ...invoice[section],
        [field]: value
      }
    }));
  };

  const addItem = () => {
    updateActiveInvoice((invoice) => ({
      ...invoice,
      items: [...invoice.items, createInvoiceItem()]
    }));
  };

  const removeItem = (itemId: string) => {
    updateActiveInvoice((invoice) => ({
      ...invoice,
      items:
        invoice.items.length > 1
          ? invoice.items.filter((item) => item.id !== itemId)
          : invoice.items
    }));
  };

  const updateItemField = (
    itemId: string,
    field: keyof InvoiceItem,
    value: string | number
  ) => {
    updateActiveInvoice((invoice) => ({
      ...invoice,
      items: invoice.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              [field]: value
            }
          : item
      )
    }));
  };

  const setLogo = (logo: string) => {
    updateInvoiceField('logo', logo);
  };

  const clearLogo = () => {
    updateInvoiceField('logo', '');
  };

  const addTextElement = () => {
    updateActiveInvoice((invoice) => ({
      ...invoice,
      editorSettings: {
        ...invoice.editorSettings,
        elements: [
          ...invoice.editorSettings.elements,
          createEditorElement({
            type: 'text',
            x: 120,
            y: 240,
            width: 220,
            height: 48,
            text: 'Editable text',
            fontSize: 18
          })
        ]
      }
    }));
  };

  const updateEditorElement = (elementId: string, patch: Partial<EditorElement>) => {
    updateActiveInvoice((invoice) => ({
      ...invoice,
      editorSettings: {
        ...invoice.editorSettings,
        elements: invoice.editorSettings.elements.map((element) =>
          element.id === elementId
            ? {
                ...element,
                ...patch
              }
            : element
        )
      }
    }));
  };

  const removeEditorElement = (elementId: string) => {
    updateActiveInvoice((invoice) => ({
      ...invoice,
      editorSettings: {
        ...invoice.editorSettings,
        elements: invoice.editorSettings.elements.filter((x) => x.id !== elementId)
      }
    }));
  };

  const exportCurrentInvoice = () => {
    if (!activeInvoice) return;

    const blob = new Blob([JSON.stringify(activeInvoice, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `invoice-${activeInvoice.invoiceNumber}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportAllInvoices = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'all-invoices.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importFromJson = async (file: File) => {
    const text = await file.text();
    const parsed = JSON.parse(text) as InvoiceData | InvoicesState;

    if ('invoices' in parsed) {
      const normalizedInvoices = parsed.invoices.map((invoice) => normalizeInvoice(invoice));

      if (normalizedInvoices.length > 0) {
        const activeInvoiceId =
          parsed.activeInvoiceId &&
          normalizedInvoices.some((invoice) => invoice.id === parsed.activeInvoiceId)
            ? parsed.activeInvoiceId
            : normalizedInvoices[0].id;

        setState({
          invoices: normalizedInvoices,
          activeInvoiceId
        });
      }

      return;
    }

    const normalizedInvoice = normalizeInvoice(parsed);

    setState((prev) => ({
      invoices: [normalizedInvoice, ...prev.invoices],
      activeInvoiceId: normalizedInvoice.id
    }));
  };

  return {
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
  };
};