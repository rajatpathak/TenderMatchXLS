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
import { UploadProgressProvider, useUploadProgress } from "@/hooks/useUploadProgress";
import { Progress } from "@/components/ui/progress";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import Settings from "@/pages/Settings";
import UnableToAnalyse from "@/pages/UnableToAnalyse";
import UploadHistory from "@/pages/UploadHistory";
import UploadPage from "@/pages/UploadPage";
import TeamManagement from "@/pages/TeamManagement";
import WorkflowPage from "@/pages/WorkflowPage";
import SubmittedTenders from "@/pages/SubmittedTenders";
import AssignmentsHub from "@/pages/AssignmentsHub";
import MyWork from "@/pages/MyWork";
import AuditLogs from "@/pages/AuditLogs";
import TenderResults from "@/pages/TenderResults";
import Presentations from "@/pages/Presentations";
import Clarifications from "@/pages/Clarifications";
import MISReports from "@/pages/MISReports";
import { 
  EligibleTendersPage, 
  NotRelevantTendersPage, 
  NotEligibleTendersPage, 
  ManualReviewTendersPage,
  MissedTendersPage,
} from "@/pages/TenderCategoryPage";
import { NotificationBell } from "@/components/NotificationBell";
import { NotificationMarquee } from "@/components/NotificationMarquee";

function HeaderContent() {
  const { upload } = useUploadProgress();

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${Math.ceil(seconds)}s`;
    return `${Math.ceil(seconds / 60)}m`;
  };

  return (
    <div className="flex items-center justify-between h-14 px-4 border-b border-border bg-background shrink-0 gap-4">
      <SidebarTrigger data-testid="button-sidebar-toggle" />
      {upload?.isUploading && (
        <div className="flex-1 max-w-2xl flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground truncate">{upload.fileName}</p>
              <div className="flex gap-3 text-xs text-muted-foreground font-mono whitespace-nowrap">
                {upload.gemCount !== undefined && <span>{upload.gemCount} GEM</span>}
                {upload.nonGemCount !== undefined && <span>{upload.nonGemCount} Non-GEM</span>}
                {upload.timeRemaining !== undefined && upload.timeRemaining > 0 && (
                  <span>{formatTime(upload.timeRemaining)} left</span>
                )}
                {upload.progress === 100 && (
                  <div className="flex gap-2">
                    <span className="text-green-600 dark:text-green-400">+{upload.newCount || 0}</span>
                    <span className="text-muted-foreground">−{upload.duplicateCount || 0}</span>
                    <span className="text-blue-600 dark:text-blue-400">~{upload.corrigendumCount || 0}</span>
                  </div>
                )}
              </div>
            </div>
            <Progress value={upload.progress} className="h-1" />
          </div>
          <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">{upload.progress}%</span>
        </div>
      )}
      <div className="flex items-center gap-2">
        <NotificationBell />
        <ThemeToggle />
      </div>
    </div>
  );
}

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
          <NotificationMarquee />
          <HeaderContent />
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
        <Route path="/unable-to-analyse" component={UnableToAnalyse} />
        <Route path="/workflow" component={WorkflowPage} />
        <Route path="/assignments" component={AssignmentsHub} />
        <Route path="/my-work" component={MyWork} />
        <Route path="/submissions" component={SubmittedTenders} />
        <Route path="/tender-results" component={TenderResults} />
        <Route path="/presentations" component={Presentations} />
        <Route path="/clarifications" component={Clarifications} />
        <Route path="/mis-reports" component={MISReports} />
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
          <UploadProgressProvider>
            <Toaster />
            <Router />
          </UploadProgressProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
