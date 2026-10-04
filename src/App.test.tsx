import { render, screen } from '@testing-library/react';
import App from './App';

test('opens the invoice editor by default', () => {
  render(<App />);
  expect(screen.getByText(/invoice details/i)).toBeInTheDocument();
});
