import {
  createEmptyStore,
  createInvoice,
  createLineItem,
  type Invoice,
} from "../model";
import { sortInvoices } from "./InvoiceListPage";

const make = (
  number: string,
  issueDate: string,
  client: string,
  price: number,
): Invoice => {
  const invoice = { ...createInvoice(createEmptyStore()), number, issueDate };
  invoice.client.name = client;
  invoice.items = [createLineItem({ quantity: 1, unitPrice: price })];
  return invoice;
};

describe("sortInvoices", () => {
  const a = make("2026-002", "2026-02-28", "Valamar", 2850);
  const b = make("2026-010", "2026-09-30", "acme", 3300);
  const c = make("2026-009", "2026-09-30", "Zeta", 100);
  const numbers = (list: Invoice[]) => list.map((invoice) => invoice.number);

  it("sorts newest first by default, then by number", () => {
    expect(numbers(sortInvoices([a, c, b], "newest"))).toEqual([
      "2026-010",
      "2026-009",
      "2026-002",
    ]);
    expect(numbers(sortInvoices([a, c, b], "oldest"))).toEqual([
      "2026-002",
      "2026-009",
      "2026-010",
    ]);
  });

  it("sorts by number, amount and client", () => {
    expect(numbers(sortInvoices([a, c, b], "number"))).toEqual([
      "2026-010",
      "2026-009",
      "2026-002",
    ]);
    expect(numbers(sortInvoices([a, c, b], "amount"))).toEqual([
      "2026-010",
      "2026-002",
      "2026-009",
    ]);
    expect(numbers(sortInvoices([c, a, b], "client"))).toEqual([
      "2026-010",
      "2026-002",
      "2026-009",
    ]);
  });
});
