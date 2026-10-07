import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { BackToTopButton } from './BackToTopButton';

test('muncul setelah halaman digulir dan mengembalikan halaman ke atas', () => {
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 500 });
  const scrollTo = vi.fn();
  Object.defineProperty(window, 'scrollTo', { configurable: true, value: scrollTo });
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: false }) });

  render(<BackToTopButton />);
  fireEvent.scroll(window);
  const button = screen.getByRole('button', { name: 'Kembali ke bagian paling atas halaman' });
  expect(button).toHaveClass('bottom-[max(1rem,env(safe-area-inset-bottom))]');
  fireEvent.click(button);

  expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
});

test('disembunyikan ketika pengguna masih berada di bagian atas', () => {
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
  render(<BackToTopButton />);
  expect(screen.queryByRole('button', { name: 'Kembali ke bagian paling atas halaman' })).not.toBeInTheDocument();
});
