import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Higgsfield AI Studio · Generador de Imágenes y Videos (BYOK)',
  description:
    'Estudio web multi-usuario para generar imágenes y videos con IA usando la API de Higgsfield (open.higgsfield.ai) y el SDK v2 con credenciales por usuario.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
