import { render, screen } from '@testing-library/react';
import App from './App';

test('opens the invoice list by default', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Invoices' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /create your first invoice/i })).toBeInTheDocument();
});
