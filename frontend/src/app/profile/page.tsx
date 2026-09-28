// ==============================================================================
// 👤 PROFILE ROUTE (URL: /profile)
// ==============================================================================
// NOTE FOR DEVELOPERS:
// Next.js App Router requires route entrypoints to be named "page.tsx".
// The full, readable UI implementation for this page is located at:
// 👉 src/views/ProfilePage.tsx
// ==============================================================================

import { Suspense } from "react";
import ProfilePage from "@/views/ProfilePage";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ProfilePage />
    </Suspense>
  );
}
