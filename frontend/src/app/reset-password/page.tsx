// ==============================================================================
// 🔑 RESET PASSWORD ROUTE (URL: /reset-password)
// ==============================================================================
// The full, readable UI implementation for this page is located at:
// 👉 src/views/ResetPasswordPage.tsx
// ==============================================================================

import { Suspense } from "react";
import ResetPasswordPage from "@/views/ResetPasswordPage";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordPage />
    </Suspense>
  );
}
