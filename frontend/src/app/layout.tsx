import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Auditable Machine Unlearning Engine | Real-time Dashboard',
  description:
    'SISA Architecture, SurrealDB Property Graph, and Cryptographic Merkle Proof Receipts for Machine Unlearning Verification.',
  keywords: [
    'Machine Unlearning',
    'SISA',
    'SurrealDB',
    'LanceDB',
    'Axum',
    'Merkle Tree Proofs',
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-gray-100 font-sans antialiased selection:bg-cyan-500/30 selection:text-cyan-200 min-h-screen bg-cyber-grid">
        {children}
      </body>
    </html>
  );
}
