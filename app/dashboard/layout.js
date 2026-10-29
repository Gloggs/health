import { LogProvider } from "@/components/log/LogProvider";
import DashboardShell from "./_components/DashboardShell";

// Every signed-in page: the log sheets, then the app frame (navigation,
// search, notifications) around the page.
export default function DashboardLayout({ children }) {
  return (
    <LogProvider>
      <DashboardShell>{children}</DashboardShell>
    </LogProvider>
  );
}
