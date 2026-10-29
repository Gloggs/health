import { Suspense } from "react";
import DemoShell from "./_components/DemoShell";
import MockProvider from "./_mock/MockProvider";
import { LogProvider } from "@/components/log/LogProvider";

export const metadata = {
  title: "Demo",
  description: "The real Health app running on sample data. Nothing is saved.",
};

// MockProvider installs the sample-data network layer before anything below
// it renders, so the frame (search, notifications) and the reused pages all
// read sample data. Suspense covers useSearchParams (?mode=solo|family).
export default function DemoLayout({ children }) {
  return (
    <Suspense fallback={null}>
      <MockProvider>
        <LogProvider>
          <DemoShell>{children}</DemoShell>
        </LogProvider>
      </MockProvider>
    </Suspense>
  );
}
