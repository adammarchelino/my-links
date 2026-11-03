import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata = {
  title: 'My Links',
  description: 'Katalog bookmark pribadi yang rapi dan mudah dicari.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body className={inter.variable}>{children}</body>
    </html>
  );
}
