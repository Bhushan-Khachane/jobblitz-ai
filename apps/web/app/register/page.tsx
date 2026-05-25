import { Suspense } from "react";
import RegisterClient from "./RegisterClient";

export const dynamic = "force-dynamic";

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterClient />
    </Suspense>
  );
}