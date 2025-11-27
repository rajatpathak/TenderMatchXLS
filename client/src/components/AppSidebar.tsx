import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuBadge,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  LayoutDashboard, 
  Upload, 
  FileStack, 
  Settings,
  FileSpreadsheet,
  LogOut,
  History,
  CheckCircle,
  XCircle,
  Ban,
  FileSearch,
  Clock,
  RefreshCw,
  Users,
  Workflow,
  Send,
  ClipboardList,
  Briefcase,
  Shield,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useReanalyzeProgress } from "@/hooks/useReanalyzeProgress";

interface Stats {
  total: number;
  eligible: number;
  notRelevant: number;
  notEligible: number;
  manualReview: number;
  missed: number;
  corrigendum: number;
  todayUploads: number;
}

interface WorkflowStats {
  assigned: number;
  inProgress: number;
  readyForReview: number;
  submitted: number;
  totalBudget: number;
}

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { progress, isRunning } = useReanalyzeProgress();

  const { data: stats } = useQuery<Stats>({
    queryKey: ['/api/stats'],
    refetchInterval: isRunning ? 2000 : 30000,
  });

  const { data: workflowStats } = useQuery<WorkflowStats>({
    queryKey: ['/api/workflow-stats'],
    refetchInterval: 30000,
  });

  const mainMenuItems = [
    {
      title: "Dashboard",
      url: "/",
      icon: LayoutDashboard,
      badge: stats?.total,
    },
    {
      title: "Upload Excel",
      url: "/upload",
      icon: Upload,
      badge: stats?.todayUploads ? `+${stats.todayUploads}` : undefined,
    },
    {
      title: "Upload History",
      url: "/history",
      icon: History,
      badge: undefined,
    },
  ];

  const tenderCategories = [
    {
      title: "Eligible",
      url: "/tenders/eligible",
      icon: CheckCircle,
      badge: stats?.eligible,
      color: "text-green-600",
    },
    {
      title: "Not Relevant",
      url: "/tenders/not-relevant",
      icon: Ban,
      badge: stats?.notRelevant,
      color: "text-orange-500",
    },
    {
      title: "Not Eligible",
      url: "/tenders/not-eligible",
      icon: XCircle,
      badge: stats?.notEligible,
      color: "text-red-500",
    },
    {
      title: "Manual Review",
      url: "/tenders/manual-review",
      icon: FileSearch,
      badge: stats?.manualReview,
      color: "text-blue-500",
    },
    {
      title: "Missed Tenders",
      url: "/tenders/missed",
      icon: Clock,
      badge: stats?.missed,
      color: "text-gray-500",
    },
  ];

  const workflowItems = [
    {
      title: "My Work",
      url: "/my-work",
      icon: Briefcase,
      badge: undefined,
      color: "text-blue-500",
      description: "Your assigned tasks",
    },
    {
      title: "Assignments Hub",
      url: "/assignments",
      icon: ClipboardList,
      badge: (workflowStats?.assigned || 0) + (workflowStats?.inProgress || 0) + (workflowStats?.readyForReview || 0),
      color: "text-indigo-500",
      description: "Manage all assignments",
    },
    {
      title: "Workflow Overview",
      url: "/workflow",
      icon: Workflow,
      badge: undefined,
      color: "text-purple-500",
      description: "Full workflow view",
    },
    {
      title: "Submitted Tenders",
      url: "/submissions",
      icon: Send,
      badge: workflowStats?.submitted,
      color: "text-emerald-500",
      description: "Completed bids",
    },
    {
      title: "Team Management",
      url: "/team",
      icon: Users,
      badge: undefined,
      color: "text-amber-500",
      description: "Manage team members",
    },
  ];

  const settingsItems = [
    {
      title: "Settings",
      url: "/settings",
      icon: Settings,
    },
  ];

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-sidebar-primary flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <span className="text-lg font-semibold text-sidebar-foreground">TenderMatch</span>
        </div>
        
        {isRunning && (
          <div className="mt-3 p-2 rounded-md bg-sidebar-accent/50">
            <div className="flex items-center gap-2 text-xs text-sidebar-foreground">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Re-analyzing...</span>
              <span className="ml-auto font-medium">
                {progress.processed}/{progress.total}
              </span>
            </div>
            <div className="mt-1 w-full bg-sidebar-accent rounded-full h-1.5">
              <div 
                className="bg-sidebar-primary h-1.5 rounded-full transition-all duration-300" 
                style={{ width: `${progress.total > 0 ? (progress.processed / progress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainMenuItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild
                      isActive={isActive}
                      data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <Link href={item.url}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                    {item.badge !== undefined && item.badge !== 0 && (
                      <SidebarMenuBadge>
                        <Badge variant="secondary" className="text-[10px] h-5 min-w-5 px-1.5">
                          {item.badge}
                        </Badge>
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Tender Categories</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {tenderCategories.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild
                      isActive={isActive}
                      data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <Link href={item.url}>
                        <item.icon className={`w-4 h-4 ${item.color}`} />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                    {item.badge !== undefined && item.badge !== 0 && (
                      <SidebarMenuBadge>
                        <Badge variant="secondary" className="text-[10px] h-5 min-w-5 px-1.5">
                          {item.badge}
                        </Badge>
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Workflow</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {workflowItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild
                      isActive={isActive}
                      data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <Link href={item.url}>
                        <item.icon className={`w-4 h-4 ${item.color}`} />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                    {item.badge !== undefined && item.badge !== 0 && (
                      <SidebarMenuBadge>
                        <Badge variant="secondary" className="text-[10px] h-5 min-w-5 px-1.5">
                          {item.badge}
                        </Badge>
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Configuration</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild
                      isActive={isActive}
                      data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <Link href={item.url}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              {user?.role === 'admin' && (
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild
                    isActive={location === '/audit-logs'}
                    data-testid="nav-audit-logs"
                  >
                    <Link href="/audit-logs">
                      <Shield className="w-4 h-4" />
                      <span>Audit Logs</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage 
              src={user?.profileImageUrl || undefined} 
              alt={user?.firstName || "User"} 
              className="object-cover"
            />
            <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-sm">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {user?.firstName && user?.lastName 
                ? `${user.firstName} ${user.lastName}` 
                : user?.email || "User"}
            </p>
            <p className="text-xs text-sidebar-foreground/60 truncate">
              {user?.email}
            </p>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            className="shrink-0 text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={async () => {
              try {
                await apiRequest("POST", "/api/logout");
                window.location.replace("/");
              } catch (error) {
                console.error("Logout failed:", error);
                window.location.replace("/");
              }
            }}
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
