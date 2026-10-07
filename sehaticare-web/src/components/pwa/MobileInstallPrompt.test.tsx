import { act, fireEvent, render, screen } from '@testing-library/react';
import { MobileInstallPrompt, type BeforeInstallPromptEvent } from './MobileInstallPrompt';

const androidUserAgent = 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 Chrome/130 Safari/537.36';

function setMobileBrowser() {
  Object.defineProperty(navigator, 'userAgent', { configurable: true, value: androidUserAgent });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })
  });
}

describe('MobileInstallPrompt', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    setMobileBrowser();
  });

  afterEach(() => vi.useRealTimers());

  it('menampilkan fallback tambah ke layar utama pada browser HP', () => {
    render(<MobileInstallPrompt />);
    act(() => vi.advanceTimersByTime(1200));

    fireEvent.click(screen.getByRole('button', { name: 'Tambahkan ke layar utama' }));
    expect(screen.getByText(/Ketuk menu/)).toBeInTheDocument();
  });

  it('memanggil dialog instalasi native ketika tersedia', async () => {
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = new Event('beforeinstallprompt') as BeforeInstallPromptEvent;
    event.prompt = prompt;
    event.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });

    render(<MobileInstallPrompt />);
    fireEvent(window, event);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tambahkan ke layar utama' }));

    await act(async () => {
      await event.userChoice;
    });
    expect(prompt).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('tidak muncul saat sudah dibuka sebagai aplikasi standalone', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })
    });
    render(<MobileInstallPrompt />);
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
