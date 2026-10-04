import { fireEvent, render, screen } from '@testing-library/react';
import App from './App';

test('first visit shows the welcome, then the home page actions', () => {
  render(<App />);
  expect(screen.getByText('Dobrodošli · Welcome')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /English/ }));
  expect(screen.getByText('What would you like to make first?')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Just look around' }));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Good (morning|afternoon|evening)/);
  expect(screen.getAllByRole('button', { name: /New invoice/ }).length).toBeGreaterThan(0);
});
