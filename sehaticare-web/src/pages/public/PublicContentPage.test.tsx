import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import { getYouTubeVideoId, PublicContentPage } from './PublicContentPage';

const json = (body:unknown) => new Response(JSON.stringify(body), {status:200,headers:{'Content-Type':'application/json'}});
const video = {
  id:'v1',
  title:'Cara Penularan HIV/AIDS',
  description:'Ringkas',
  source_type:'EXTERNAL',
  external_url:'https://www.youtube.com/watch?v=mLfb3mMNubc',
  subtitle_text:'Caption mengikuti penerbit.',
  transcript_text:'Ringkasan isi terverifikasi.'
};

test('video carousel loads privacy-enhanced YouTube only after a user action', async () => {
  vi.spyOn(globalThis,'fetch').mockImplementation(async (input) => String(input).includes('/articles') ? json({items:[]}) : json({items:[video]}) );
  const user = userEvent.setup();
  render(<MemoryRouter><PublicContentPage/></MemoryRouter>);
  expect(await screen.findByText('Cara Penularan HIV/AIDS')).toBeInTheDocument();
  expect(document.querySelector('video')).toBeNull();
  expect(document.querySelector('iframe')).toBeNull();
  expect(screen.getByRole('img',{name:/thumbnail video cara penularan hiv\/aids/i})).toHaveAttribute('src','https://i.ytimg.com/vi/mLfb3mMNubc/hqdefault.jpg');
  await user.click(screen.getByRole('button',{name:/putar cara penularan hiv\/aids/i}));
  const frame = screen.getByTitle('Cara Penularan HIV/AIDS');
  expect(frame).toHaveAttribute('src',expect.stringContaining('https://www.youtube-nocookie.com/embed/mLfb3mMNubc'));
  expect(screen.getByRole('link',{name:/lihat ringkasan dan aksesibilitas/i})).toHaveAttribute('href','/edukasi/video/v1');
  expect(screen.getByRole('link',{name:/ke beranda/i})).toHaveAttribute('href','/');
});

test('video detail exposes accessibility information and summary', async () => {
  vi.spyOn(globalThis,'fetch').mockResolvedValue(json(video));
  render(<MemoryRouter initialEntries={['/edukasi/video/v1']}><Routes><Route path="/edukasi/video/:videoId" element={<PublicContentPage/>}/></Routes></MemoryRouter>);
  expect(await screen.findByRole('heading',{name:'Informasi aksesibilitas'})).toBeInTheDocument();
  expect(screen.getByText('Caption mengikuti penerbit.')).toBeInTheDocument();
  expect(screen.getByRole('heading',{name:'Ringkasan isi video'})).toBeInTheDocument();
  expect(screen.getByText('Ringkasan isi terverifikasi.')).toBeInTheDocument();
  expect(screen.getByRole('link',{name:/kembali ke edukasi/i})).toHaveAttribute('href','/edukasi');
  expect(screen.getByRole('link',{name:/ke beranda/i})).toHaveAttribute('href','/');
  expect(document.querySelector('iframe')).toBeNull();
});

test('YouTube URL parser accepts supported formats and rejects lookalike hosts', () => {
  expect(getYouTubeVideoId('https://youtu.be/mLfb3mMNubc')).toBe('mLfb3mMNubc');
  expect(getYouTubeVideoId('https://www.youtube.com/shorts/mLfb3mMNubc')).toBe('mLfb3mMNubc');
  expect(getYouTubeVideoId('https://youtube.example/watch?v=mLfb3mMNubc')).toBeNull();
});
