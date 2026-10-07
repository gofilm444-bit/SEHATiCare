import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test } from 'vitest';
import { MedicationNavigation } from './MedicationNavigation';

describe('MedicationNavigation', () => {
  test.each([
    ['/patient/medication-reminders', 'Kelola Pengingat'],
    ['/patient/medication-reminders/edit', 'Ubah Pengingat'],
    ['/patient/adherence', 'Riwayat Respons']
  ])('shows one internal section as active at %s', (path, activeLabel) => {
    render(<MemoryRouter initialEntries={[path]}><MedicationNavigation /></MemoryRouter>);
    expect(screen.getAllByRole('link')).toHaveLength(3);
    expect(screen.getByRole('link', { name: activeLabel })).toHaveAttribute('aria-current', 'page');
    expect(screen.getAllByRole('link').filter((link) => link.hasAttribute('aria-current'))).toHaveLength(1);
  });
});
