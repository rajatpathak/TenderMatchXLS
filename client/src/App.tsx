import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import Settings from "@/pages/Settings";
import UnableToAnalyse from "@/pages/UnableToAnalyse";
import Corrigendum from "@/pages/Corrigendum";
import UploadHistory from "@/pages/UploadHistory";
import UploadPage from "@/pages/UploadPage";
import TeamManagement from "@/pages/TeamManagement";
import WorkflowPage from "@/pages/WorkflowPage";
import SubmittedTenders from "@/pages/SubmittedTenders";
import AssignmentsHub from "@/pages/AssignmentsHub";
import MyWork from "@/pages/MyWork";
import AuditLogs from "@/pages/AuditLogs";
import { 
  EligibleTendersPage, 
  NotRelevantTendersPage, 
  NotEligibleTendersPage, 
  ManualReviewTendersPage,
  MissedTendersPage,
} from "@/pages/TenderCategoryPage";

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between h-14 px-4 border-b border-border bg-background shrink-0">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-hidden bg-background">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route component={Landing} />
      </Switch>
    );
  }

  return (
    <AuthenticatedLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/upload" component={UploadPage} />
        <Route path="/history" component={UploadHistory} />
        <Route path="/tenders/eligible" component={EligibleTendersPage} />
        <Route path="/tenders/not-relevant" component={NotRelevantTendersPage} />
        <Route path="/tenders/not-eligible" component={NotEligibleTendersPage} />
        <Route path="/tenders/manual-review" component={ManualReviewTendersPage} />
        <Route path="/tenders/missed" component={MissedTendersPage} />
        <Route path="/corrigendum" component={Corrigendum} />
        <Route path="/unable-to-analyse" component={UnableToAnalyse} />
        <Route path="/workflow" component={WorkflowPage} />
        <Route path="/assignments" component={AssignmentsHub} />
        <Route path="/my-work" component={MyWork} />
        <Route path="/submissions" component={SubmittedTenders} />
        <Route path="/team" component={TeamManagement} />
        <Route path="/audit-logs" component={AuditLogs} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </AuthenticatedLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
