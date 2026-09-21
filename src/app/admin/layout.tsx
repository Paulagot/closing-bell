import type { ReactNode } from "react";

// The only <html> and <body> belong in src/app/layout.tsx.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
