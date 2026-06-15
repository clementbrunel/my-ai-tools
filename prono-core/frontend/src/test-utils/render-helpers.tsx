import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

export const renderWithRouter = (
  ui: React.ReactNode,
  { route = '/' }: { route?: string } = {}
) =>
  render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>);
