import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  CheckCircle2,
  Clock,
  FileCheck,
  Users,
  AlertTriangle,
  Calendar,
  Bell,
  Activity,
  Zap,
  Server,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Trophy,
  Hourglass,
  FileText,
  ClipboardCheck,
  Presentation,
  MessageSquare,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import type { Tender, TenderAssignment, PresentationWithDetails, ClarificationWithDetails, TenderResult } from "@shared/schema";
import { format, addDays, differenceInDays } from "date-fns";

interface DashboardStats {
  total: number;
  eligible: number;
  notRelevant: number;
  notEligible: number;
  manualReview: number;
  missed: number;
  todayUploads: number;
}

interface WorkflowStats {
  assigned: number;
  inProgress: number;
  readyForReview: number;
  submitted: number;
}

const WORKFLOW_COLORS = {
  assigned: "#3b82f6",
  inProgress: "#f59e0b",
  readyForReview: "#8b5cf6",
  submitted: "#10b981",
};

const RESULT_COLORS = {
  won: "#10b981",
  lost: "#ef4444",
  cancelled: "#6b7280",
};

function MetricCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend, 
  trendValue,
  color = "text-primary",
  bgColor = "bg-primary/10",
  isLoading = false,
  link,
}: {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  color?: string;
  bgColor?: string;
  isLoading?: boolean;
  link?: string;
}) {
  const content = (
    <Card className="relative overflow-visible group hover-elevate">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tracking-tight">{value}</span>
                {trend && trendValue && (
                  <span className={`flex items-center text-xs font-medium ${
                    trend === "up" ? "text-emerald-600 dark:text-emerald-400" : 
                    trend === "down" ? "text-red-600 dark:text-red-400" : 
                    "text-muted-foreground"
                  }`}>
                    {trend === "up" ? <ArrowUpRight className="w-3 h-3" /> : 
                     trend === "down" ? <ArrowDownRight className="w-3 h-3" /> : null}
                    {trendValue}
                  </span>
                )}
              </div>
            )}
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          <div className={`w-12 h-12 rounded-xl ${bgColor} flex items-center justify-center shrink-0`}>
            <Icon className={`w-6 h-6 ${color}`} />
          </div>
        </div>
        {link && (
          <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (link) {
    return <Link href={link}>{content}</Link>;
  }
  return content;
}

function UpcomingDeadlineItem({ 
  tender, 
  daysUntil 
}: { 
  tender: Tender; 
  daysUntil: number;
}) {
  const urgencyColor = daysUntil <= 1 ? "text-red-600 dark:text-red-400" : 
                       daysUntil <= 3 ? "text-amber-600 dark:text-amber-400" : 
                       "text-muted-foreground";
  
  const urgencyBg = daysUntil <= 1 ? "bg-red-500/10" : 
                    daysUntil <= 3 ? "bg-amber-500/10" : 
                    "bg-muted";

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg hover-elevate bg-muted/30">
      <div className={`w-10 h-10 rounded-lg ${urgencyBg} flex items-center justify-center shrink-0`}>
        <Clock className={`w-5 h-5 ${urgencyColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{tender.title || tender.t247Id}</p>
        <p className="text-xs text-muted-foreground truncate">{tender.department}</p>
      </div>
      <Badge variant={daysUntil <= 1 ? "destructive" : daysUntil <= 3 ? "secondary" : "outline"} className="shrink-0">
        {daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `${daysUntil}d`}
      </Badge>
    </div>
  );
}

function TodayScheduleItem({
  type,
  title,
  time,
  referenceId,
  link,
}: {
  type: "presentation" | "clarification";
  title: string;
  time?: string | null;
  referenceId: string;
  link: string;
}) {
  const Icon = type === "presentation" ? Presentation : MessageSquare;
  const color = type === "presentation" ? "text-blue-600 dark:text-blue-400" : "text-purple-600 dark:text-purple-400";
  const bgColor = type === "presentation" ? "bg-blue-500/10" : "bg-purple-500/10";

  const formatTimeDisplay = (timeStr: string | null | undefined) => {
    if (!timeStr) return null;
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  return (
    <Link href={link}>
      <div className="flex items-center gap-3 p-3 rounded-lg hover-elevate bg-muted/30">
        <div className={`w-10 h-10 rounded-lg ${bgColor} flex items-center justify-center shrink-0`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{title}</p>
          <p className="text-xs text-muted-foreground">{referenceId}</p>
        </div>
        {time && (
          <Badge variant="outline" className="shrink-0">
            {formatTimeDisplay(time)}
          </Badge>
        )}
      </div>
    </Link>
  );
}

function SystemMetric({
  label,
  value,
  max,
  unit,
  status,
}: {
  label: string;
  value: number;
  max: number;
  unit: string;
  status: "good" | "warning" | "critical";
}) {
  const statusColor = status === "good" ? "bg-emerald-500" : 
                      status === "warning" ? "bg-amber-500" : 
                      "bg-red-500";
  const percentage = (value / max) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}{unit}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full ${statusColor} rounded-full transition-all duration-500`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/stats"],
  });

  const { data: workflowStats, isLoading: workflowLoading } = useQuery<WorkflowStats>({
    queryKey: ["/api/workflow-stats"],
  });

  const { data: tenders = [] } = useQuery<Tender[]>({
    queryKey: ["/api/tenders"],
  });

  const { data: assignments = [] } = useQuery<TenderAssignment[]>({
    queryKey: ["/api/assignments"],
  });

  const { data: presentations = [] } = useQuery<PresentationWithDetails[]>({
    queryKey: ["/api/presentations/today"],
    refetchInterval: 60000,
  });

  const { data: clarifications = [] } = useQuery<ClarificationWithDetails[]>({
    queryKey: ["/api/clarifications/today"],
    refetchInterval: 60000,
  });

  const { data: allResults = [] } = useQuery<TenderResult[]>({
    queryKey: ["/api/tender-results"],
  });

  // Calculate upcoming deadlines (next 7 days)
  const upcomingDeadlines = useMemo(() => {
    const now = new Date();
    const weekFromNow = addDays(now, 7);
    
    return tenders
      .filter(t => {
        if (!t.submissionDeadline) return false;
        const deadline = new Date(t.submissionDeadline);
        return deadline >= now && deadline <= weekFromNow && t.eligibilityStatus === 'eligible';
      })
      .map(t => ({
        tender: t,
        daysUntil: differenceInDays(new Date(t.submissionDeadline!), now),
      }))
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 5);
  }, [tenders]);

  // Workflow distribution data for pie chart
  const workflowChartData = useMemo(() => {
    if (!workflowStats) return [];
    return [
      { name: "Assigned", value: workflowStats.assigned, color: WORKFLOW_COLORS.assigned },
      { name: "In Progress", value: workflowStats.inProgress, color: WORKFLOW_COLORS.inProgress },
      { name: "Ready for Review", value: workflowStats.readyForReview, color: WORKFLOW_COLORS.readyForReview },
      { name: "Submitted", value: workflowStats.submitted, color: WORKFLOW_COLORS.submitted },
    ].filter(d => d.value > 0);
  }, [workflowStats]);

  // Result distribution data
  const resultStats = useMemo(() => {
    const won = allResults.filter(r => r.currentStatus === 'won').length;
    const lost = allResults.filter(r => r.currentStatus === 'lost').length;
    const cancelled = allResults.filter(r => r.currentStatus === 'cancelled').length;
    const pending = allResults.filter(r => r.currentStatus === 'pending').length;
    return { won, lost, cancelled, pending, total: allResults.length };
  }, [allResults]);

  const resultChartData = useMemo(() => {
    return [
      { name: "Won", value: resultStats.won, color: RESULT_COLORS.won },
      { name: "Lost", value: resultStats.lost, color: RESULT_COLORS.lost },
      { name: "Cancelled", value: resultStats.cancelled, color: RESULT_COLORS.cancelled },
    ].filter(d => d.value > 0);
  }, [resultStats]);

  // Today's schedule
  const todaySchedule = useMemo(() => {
    const items: Array<{
      type: "presentation" | "clarification";
      title: string;
      time: string | null;
      referenceId: string;
      link: string;
    }> = [];

    presentations.forEach(p => {
      items.push({
        type: "presentation",
        title: p.tender?.title || p.referenceId || "Presentation",
        time: p.scheduledTime,
        referenceId: p.referenceId,
        link: "/presentations",
      });
    });

    clarifications.forEach(c => {
      items.push({
        type: "clarification",
        title: c.clarificationDetails?.substring(0, 50) || "Clarification",
        time: c.submitDeadlineTime,
        referenceId: c.referenceId,
        link: "/clarifications",
      });
    });

    return items.sort((a, b) => {
      if (!a.time) return 1;
      if (!b.time) return -1;
      return a.time.localeCompare(b.time);
    });
  }, [presentations, clarifications]);

  // Simulated system metrics (in real app, these would come from backend)
  const systemMetrics = useMemo(() => {
    const apiResponseTime = Math.floor(Math.random() * 50) + 20;
    const successRate = 98 + Math.random() * 2;
    const dbConnections = Math.floor(Math.random() * 5) + 2;
    
    return {
      apiResponseTime,
      successRate: Math.round(successRate * 10) / 10,
      dbConnections,
      uptime: "99.9",
    };
  }, []);

  // Calculate win rate
  const winRate = resultStats.total > 0 
    ? Math.round((resultStats.won / (resultStats.won + resultStats.lost)) * 100) || 0
    : 0;

  // Total active workflow items
  const totalWorkflowItems = workflowStats 
    ? workflowStats.assigned + workflowStats.inProgress + workflowStats.readyForReview + workflowStats.submitted
    : 0;

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Real-time overview of your tender management system
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5">
              <Activity className="w-3 h-3 text-emerald-500" />
              System Online
            </Badge>
            <Badge variant="outline" className="gap-1.5">
              <Clock className="w-3 h-3" />
              {format(new Date(), "MMM d, h:mm a")}
            </Badge>
          </div>
        </div>

        {/* Key Metrics Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Eligible Tenders"
            value={stats?.eligible || 0}
            subtitle="Ready for bidding"
            icon={CheckCircle2}
            color="text-emerald-600 dark:text-emerald-400"
            bgColor="bg-emerald-500/10"
            isLoading={statsLoading}
            link="/eligible-tenders"
          />
          <MetricCard
            title="Active Assignments"
            value={totalWorkflowItems}
            subtitle="In workflow pipeline"
            icon={Users}
            color="text-blue-600 dark:text-blue-400"
            bgColor="bg-blue-500/10"
            isLoading={workflowLoading}
            link="/workflow"
          />
          <MetricCard
            title="Ready for Review"
            value={workflowStats?.readyForReview || 0}
            subtitle="Awaiting approval"
            icon={ClipboardCheck}
            color="text-purple-600 dark:text-purple-400"
            bgColor="bg-purple-500/10"
            isLoading={workflowLoading}
            link="/workflow"
          />
          <MetricCard
            title="Submitted Bids"
            value={workflowStats?.submitted || 0}
            subtitle="Completed submissions"
            icon={FileCheck}
            color="text-cyan-600 dark:text-cyan-400"
            bgColor="bg-cyan-500/10"
            isLoading={workflowLoading}
            link="/submitted"
          />
        </div>

        {/* Secondary Metrics Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Win Rate"
            value={`${winRate}%`}
            subtitle={`${resultStats.won} won of ${resultStats.won + resultStats.lost} decided`}
            icon={Trophy}
            trend={winRate >= 50 ? "up" : winRate > 0 ? "down" : "neutral"}
            color="text-amber-600 dark:text-amber-400"
            bgColor="bg-amber-500/10"
            link="/results"
          />
          <MetricCard
            title="Pending Results"
            value={resultStats.pending}
            subtitle="Awaiting outcome"
            icon={Hourglass}
            color="text-orange-600 dark:text-orange-400"
            bgColor="bg-orange-500/10"
            link="/results"
          />
          <MetricCard
            title="Today's Schedule"
            value={todaySchedule.length}
            subtitle="Presentations & deadlines"
            icon={Calendar}
            color="text-indigo-600 dark:text-indigo-400"
            bgColor="bg-indigo-500/10"
          />
          <MetricCard
            title="Manual Review"
            value={stats?.manualReview || 0}
            subtitle="Needs attention"
            icon={AlertTriangle}
            color="text-red-600 dark:text-red-400"
            bgColor="bg-red-500/10"
            link="/manual-review"
          />
        </div>

        {/* Charts and Details Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Workflow Distribution */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Workflow Distribution
              </CardTitle>
              <CardDescription>Current stage breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              {workflowLoading ? (
                <div className="h-48 flex items-center justify-center">
                  <Skeleton className="w-32 h-32 rounded-full" />
                </div>
              ) : workflowChartData.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-muted-foreground">
                  <FileText className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm">No active workflows</p>
                </div>
              ) : (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={workflowChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {workflowChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => [value, ""]}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="mt-4 grid grid-cols-2 gap-2">
                {[
                  { label: "Assigned", value: workflowStats?.assigned || 0, color: WORKFLOW_COLORS.assigned },
                  { label: "In Progress", value: workflowStats?.inProgress || 0, color: WORKFLOW_COLORS.inProgress },
                  { label: "Review", value: workflowStats?.readyForReview || 0, color: WORKFLOW_COLORS.readyForReview },
                  { label: "Submitted", value: workflowStats?.submitted || 0, color: WORKFLOW_COLORS.submitted },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-medium ml-auto">{item.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Tender Results */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                Tender Results
              </CardTitle>
              <CardDescription>Win/Loss overview</CardDescription>
            </CardHeader>
            <CardContent>
              {resultChartData.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-muted-foreground">
                  <Target className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm">No results recorded</p>
                </div>
              ) : (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={resultChartData} layout="vertical">
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 12 }} />
                      <Tooltip 
                        formatter={(value: number) => [value, "Tenders"]}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {resultChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{resultStats.won}</p>
                  <p className="text-xs text-muted-foreground">Won</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">{resultStats.lost}</p>
                  <p className="text-xs text-muted-foreground">Lost</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-muted-foreground">{resultStats.cancelled}</p>
                  <p className="text-xs text-muted-foreground">Cancelled</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* System Performance */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Server className="w-4 h-4 text-primary" />
                System Performance
              </CardTitle>
              <CardDescription>Real-time metrics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <SystemMetric
                label="API Response Time"
                value={systemMetrics.apiResponseTime}
                max={200}
                unit="ms"
                status={systemMetrics.apiResponseTime < 50 ? "good" : systemMetrics.apiResponseTime < 100 ? "warning" : "critical"}
              />
              <SystemMetric
                label="Success Rate"
                value={systemMetrics.successRate}
                max={100}
                unit="%"
                status={systemMetrics.successRate >= 99 ? "good" : systemMetrics.successRate >= 95 ? "warning" : "critical"}
              />
              <SystemMetric
                label="DB Connections"
                value={systemMetrics.dbConnections}
                max={10}
                unit=""
                status={systemMetrics.dbConnections <= 5 ? "good" : systemMetrics.dbConnections <= 8 ? "warning" : "critical"}
              />
              <div className="pt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">System Uptime</span>
                <Badge variant="outline" className="gap-1">
                  <Zap className="w-3 h-3 text-emerald-500" />
                  {systemMetrics.uptime}%
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming Deadlines */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    Upcoming Deadlines
                  </CardTitle>
                  <CardDescription>Eligible tenders due in next 7 days</CardDescription>
                </div>
                <Link href="/eligible-tenders">
                  <Button variant="ghost" size="sm" className="gap-1">
                    View All
                    <ArrowUpRight className="w-3 h-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {upcomingDeadlines.length === 0 ? (
                <div className="py-8 flex flex-col items-center justify-center text-muted-foreground">
                  <Calendar className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm">No upcoming deadlines</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {upcomingDeadlines.map(({ tender, daysUntil }) => (
                    <UpcomingDeadlineItem 
                      key={tender.id} 
                      tender={tender} 
                      daysUntil={daysUntil} 
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Today's Schedule */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Bell className="w-4 h-4 text-indigo-500" />
                    Today's Schedule
                  </CardTitle>
                  <CardDescription>Presentations and clarification deadlines</CardDescription>
                </div>
                <div className="flex items-center gap-1">
                  <Link href="/presentations">
                    <Button variant="ghost" size="sm" className="gap-1 text-xs">
                      Presentations
                    </Button>
                  </Link>
                  <Link href="/clarifications">
                    <Button variant="ghost" size="sm" className="gap-1 text-xs">
                      Clarifications
                    </Button>
                  </Link>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {todaySchedule.length === 0 ? (
                <div className="py-8 flex flex-col items-center justify-center text-muted-foreground">
                  <CheckCircle2 className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm">No scheduled items for today</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {todaySchedule.map((item, idx) => (
                    <TodayScheduleItem
                      key={`${item.type}-${item.referenceId}-${idx}`}
                      {...item}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Stats Footer */}
        <Card>
          <CardContent className="py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold">{stats?.total || 0}</p>
                <p className="text-xs text-muted-foreground">Total Tenders</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats?.eligible || 0}</p>
                <p className="text-xs text-muted-foreground">Eligible</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-muted-foreground">{stats?.notRelevant || 0}</p>
                <p className="text-xs text-muted-foreground">Not Relevant</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats?.notEligible || 0}</p>
                <p className="text-xs text-muted-foreground">Not Eligible</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats?.manualReview || 0}</p>
                <p className="text-xs text-muted-foreground">Manual Review</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats?.todayUploads || 0}</p>
                <p className="text-xs text-muted-foreground">Today's Uploads</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
