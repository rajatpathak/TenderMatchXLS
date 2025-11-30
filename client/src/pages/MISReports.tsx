import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  BarChart3, 
  Download, 
  Calendar,
  Users,
  TrendingUp,
  FileSpreadsheet,
  User,
  CheckCircle,
  XCircle,
  Send,
  Eye,
  Presentation,
  MessageSquare,
  Trophy,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { TeamMember } from "@shared/schema";

interface MemberReport {
  teamMemberId: number;
  teamMemberName: string;
  role: string;
  summary: {
    tendersMarkedNotRelevant: number;
    tendersMarkedNotEligible: number;
    tendersAssigned: number;
    tendersSubmitted: number;
    tendersReviewed: number;
    clarificationsCreated: number;
    clarificationsSubmitted: number;
    presentationsScheduled: number;
    presentationsCompleted: number;
    resultsRecorded: number;
    totalActions: number;
  };
}

interface IndividualReport {
  teamMember?: TeamMember;
  user?: { username: string; role: string };
  summary: {
    tendersMarkedNotRelevant: number;
    tendersMarkedNotEligible: number;
    tendersAssigned: number;
    tendersSubmitted: number;
    tendersReviewed: number;
    clarificationsCreated: number;
    clarificationsSubmitted: number;
    presentationsScheduled: number;
    presentationsCompleted: number;
    resultsRecorded: number;
  };
  dailyBreakdown: {
    date: string;
    notRelevant: number;
    notEligible: number;
    assigned: number;
    submitted: number;
    reviewed: number;
    clarifications: number;
    presentations: number;
  }[];
}

interface User {
  id: string;
  role: string;
  teamMemberId?: number;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

const dateRangePresets = [
  { label: 'Today', getValue: () => ({ start: new Date(), end: new Date() }) },
  { label: 'Yesterday', getValue: () => ({ start: subDays(new Date(), 1), end: subDays(new Date(), 1) }) },
  { label: 'Last 7 Days', getValue: () => ({ start: subDays(new Date(), 6), end: new Date() }) },
  { label: 'This Week', getValue: () => ({ start: startOfWeek(new Date()), end: endOfWeek(new Date()) }) },
  { label: 'Last 30 Days', getValue: () => ({ start: subDays(new Date(), 29), end: new Date() }) },
  { label: 'This Month', getValue: () => ({ start: startOfMonth(new Date()), end: endOfMonth(new Date()) }) },
];

export default function MISReportsPage() {
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<'today' | 'yesterday' | 'week' | 'thisWeek' | 'month' | 'thisMonth' | 'custom'>('week');
  const [customStartDate, setCustomStartDate] = useState(format(subDays(new Date(), 6), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedMemberId, setSelectedMemberId] = useState<number | 'all'>('all');
  const [isDownloading, setIsDownloading] = useState(false);

  const { data: currentUser } = useQuery<User>({
    queryKey: ['/api/auth/user'],
  });

  const { data: teamMembers } = useQuery<TeamMember[]>({
    queryKey: ['/api/team-members'],
  });

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  const { startDate, endDate } = useMemo(() => {
    switch (dateRange) {
      case 'today':
        return { startDate: format(new Date(), 'yyyy-MM-dd'), endDate: format(new Date(), 'yyyy-MM-dd') };
      case 'yesterday':
        return { startDate: format(subDays(new Date(), 1), 'yyyy-MM-dd'), endDate: format(subDays(new Date(), 1), 'yyyy-MM-dd') };
      case 'week':
        return { startDate: format(subDays(new Date(), 6), 'yyyy-MM-dd'), endDate: format(new Date(), 'yyyy-MM-dd') };
      case 'thisWeek':
        return { startDate: format(startOfWeek(new Date()), 'yyyy-MM-dd'), endDate: format(endOfWeek(new Date()), 'yyyy-MM-dd') };
      case 'month':
        return { startDate: format(subDays(new Date(), 29), 'yyyy-MM-dd'), endDate: format(new Date(), 'yyyy-MM-dd') };
      case 'thisMonth':
        return { startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'), endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd') };
      case 'custom':
        return { startDate: customStartDate, endDate: customEndDate };
      default:
        return { startDate: format(subDays(new Date(), 6), 'yyyy-MM-dd'), endDate: format(new Date(), 'yyyy-MM-dd') };
    }
  }, [dateRange, customStartDate, customEndDate]);

  const { data: allTeamReports, isLoading: isLoadingAll } = useQuery<MemberReport[]>({
    queryKey: ['/api/mis-report/all', startDate, endDate],
    queryFn: async () => {
      const res = await fetch(`/api/mis-report/all?startDate=${startDate}&endDate=${endDate}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch reports');
      return res.json();
    },
    enabled: isAdmin,
  });

  const { data: myReport, isLoading: isLoadingMy } = useQuery<IndividualReport>({
    queryKey: ['/api/mis-report/me', startDate, endDate],
    queryFn: async () => {
      const res = await fetch(`/api/mis-report/me?startDate=${startDate}&endDate=${endDate}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch my report');
      return res.json();
    },
  });

  const { data: selectedMemberReport, isLoading: isLoadingMember } = useQuery<IndividualReport>({
    queryKey: ['/api/mis-report/team-member', selectedMemberId, startDate, endDate],
    queryFn: async () => {
      const res = await fetch(`/api/mis-report/team-member/${selectedMemberId}?startDate=${startDate}&endDate=${endDate}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch member report');
      return res.json();
    },
    enabled: isAdmin && typeof selectedMemberId === 'number',
  });

  const handleDownload = async (type: 'me' | 'all') => {
    setIsDownloading(true);
    try {
      const res = await fetch(`/api/mis-report/download/${type}?startDate=${startDate}&endDate=${endDate}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to download report');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'report.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({ title: "Report downloaded successfully" });
    } catch (error) {
      toast({ title: "Failed to download report", variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };

  const chartData = useMemo(() => {
    if (!allTeamReports) return [];
    return allTeamReports.map(r => ({
      name: r.teamMemberName.split(' ')[0],
      assigned: r.summary.tendersAssigned,
      submitted: r.summary.tendersSubmitted,
      reviewed: r.summary.tendersReviewed,
      clarifications: r.summary.clarificationsCreated,
      presentations: r.summary.presentationsScheduled,
      total: r.summary.totalActions,
    }));
  }, [allTeamReports]);

  const pieChartData = useMemo(() => {
    if (!myReport && !selectedMemberReport) return [];
    const report = selectedMemberReport || myReport;
    if (!report) return [];
    
    return [
      { name: 'Not Relevant', value: report.summary.tendersMarkedNotRelevant, color: '#EF4444' },
      { name: 'Not Eligible', value: report.summary.tendersMarkedNotEligible, color: '#F59E0B' },
      { name: 'Assigned', value: report.summary.tendersAssigned, color: '#3B82F6' },
      { name: 'Submitted', value: report.summary.tendersSubmitted, color: '#10B981' },
      { name: 'Reviewed', value: report.summary.tendersReviewed, color: '#8B5CF6' },
      { name: 'Clarifications', value: report.summary.clarificationsCreated, color: '#EC4899' },
      { name: 'Presentations', value: report.summary.presentationsScheduled, color: '#06B6D4' },
    ].filter(d => d.value > 0);
  }, [myReport, selectedMemberReport]);

  const dailyTrendData = useMemo(() => {
    const report = selectedMemberReport || myReport;
    if (!report?.dailyBreakdown) return [];
    
    return report.dailyBreakdown.map(day => ({
      date: format(new Date(day.date), 'MMM d'),
      activities: day.assigned + day.submitted + day.reviewed + day.clarifications + day.presentations,
      assigned: day.assigned,
      submitted: day.submitted,
      reviewed: day.reviewed,
    }));
  }, [myReport, selectedMemberReport]);

  const totalTeamActions = useMemo(() => {
    if (!allTeamReports) return 0;
    return allTeamReports.reduce((sum, r) => sum + r.summary.totalActions, 0);
  }, [allTeamReports]);

  const currentReport = selectedMemberReport || myReport;
  const isLoading = isLoadingAll || isLoadingMy || isLoadingMember;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="heading-mis-reports">
            <BarChart3 className="w-6 h-6 text-primary" />
            MIS Reports
          </h1>
          <p className="text-muted-foreground">Analyze team performance and productivity</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <Select value={dateRange} onValueChange={(v: typeof dateRange) => setDateRange(v)} data-testid="select-date-range">
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="thisWeek">This Week</SelectItem>
              <SelectItem value="month">Last 30 Days</SelectItem>
              <SelectItem value="thisMonth">This Month</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
          
          {dateRange === 'custom' && (
            <>
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-[140px]"
                data-testid="input-start-date"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-[140px]"
                data-testid="input-end-date"
              />
            </>
          )}
          
          <Button 
            variant="outline" 
            onClick={() => handleDownload('me')}
            disabled={isDownloading}
            data-testid="button-download-my-report"
          >
            {isDownloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            My Report
          </Button>
          
          {isAdmin && (
            <Button 
              onClick={() => handleDownload('all')}
              disabled={isDownloading}
              data-testid="button-download-team-report"
            >
              {isDownloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
              Team Report
            </Button>
          )}
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        Showing data from {format(new Date(startDate), 'MMM d, yyyy')} to {format(new Date(endDate), 'MMM d, yyyy')}
      </div>

      <Tabs defaultValue={isAdmin ? "team" : "my"} className="space-y-4">
        <TabsList>
          {isAdmin && <TabsTrigger value="team" data-testid="tab-team">Team Overview</TabsTrigger>}
          <TabsTrigger value="my" data-testid="tab-my">My Report</TabsTrigger>
          {isAdmin && <TabsTrigger value="member" data-testid="tab-member">Member Details</TabsTrigger>}
        </TabsList>

        {isAdmin && (
          <TabsContent value="team" className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card data-testid="card-total-actions">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Actions</p>
                      <p className="text-2xl font-bold">{totalTeamActions}</p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-primary" />
                  </div>
                </CardContent>
              </Card>
              <Card data-testid="card-active-members">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Active Members</p>
                      <p className="text-2xl font-bold">{allTeamReports?.filter(r => r.summary.totalActions > 0).length || 0}</p>
                    </div>
                    <Users className="w-8 h-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>
              <Card data-testid="card-submissions">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Submissions</p>
                      <p className="text-2xl font-bold">{allTeamReports?.reduce((s, r) => s + r.summary.tendersSubmitted, 0) || 0}</p>
                    </div>
                    <Send className="w-8 h-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>
              <Card data-testid="card-presentations">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Presentations</p>
                      <p className="text-2xl font-bold">{allTeamReports?.reduce((s, r) => s + r.summary.presentationsScheduled, 0) || 0}</p>
                    </div>
                    <Presentation className="w-8 h-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Team Performance Comparison</CardTitle>
                  <CardDescription>Activity breakdown by team member</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingAll ? (
                    <Skeleton className="h-[300px] w-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="assigned" name="Assigned" fill="#3B82F6" />
                        <Bar dataKey="submitted" name="Submitted" fill="#10B981" />
                        <Bar dataKey="reviewed" name="Reviewed" fill="#8B5CF6" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Team Leaderboard</CardTitle>
                  <CardDescription>Ranked by total actions</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Rank</TableHead>
                          <TableHead>Member</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoadingAll ? (
                          Array(5).fill(0).map((_, i) => (
                            <TableRow key={i}>
                              <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                              <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                            </TableRow>
                          ))
                        ) : (
                          allTeamReports?.map((r, index) => (
                            <TableRow key={r.teamMemberId} data-testid={`row-leaderboard-${r.teamMemberId}`}>
                              <TableCell>
                                {index === 0 && <Trophy className="w-4 h-4 text-yellow-500 inline mr-1" />}
                                #{index + 1}
                              </TableCell>
                              <TableCell className="font-medium">{r.teamMemberName}</TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="capitalize">{r.role}</Badge>
                              </TableCell>
                              <TableCell className="text-right font-bold">{r.summary.totalActions}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Detailed Team Activity</CardTitle>
                <CardDescription>Complete breakdown of all team member activities</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead className="text-center">Not Relevant</TableHead>
                        <TableHead className="text-center">Not Eligible</TableHead>
                        <TableHead className="text-center">Assigned</TableHead>
                        <TableHead className="text-center">Submitted</TableHead>
                        <TableHead className="text-center">Reviewed</TableHead>
                        <TableHead className="text-center">Clarifications</TableHead>
                        <TableHead className="text-center">Presentations</TableHead>
                        <TableHead className="text-center">Results</TableHead>
                        <TableHead className="text-right font-bold">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingAll ? (
                        Array(5).fill(0).map((_, i) => (
                          <TableRow key={i}>
                            {Array(10).fill(0).map((_, j) => (
                              <TableCell key={j}><Skeleton className="h-4 w-12" /></TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : (
                        allTeamReports?.map(r => (
                          <TableRow key={r.teamMemberId} data-testid={`row-detailed-${r.teamMemberId}`}>
                            <TableCell className="font-medium">{r.teamMemberName}</TableCell>
                            <TableCell className="text-center">{r.summary.tendersMarkedNotRelevant}</TableCell>
                            <TableCell className="text-center">{r.summary.tendersMarkedNotEligible}</TableCell>
                            <TableCell className="text-center">{r.summary.tendersAssigned}</TableCell>
                            <TableCell className="text-center">{r.summary.tendersSubmitted}</TableCell>
                            <TableCell className="text-center">{r.summary.tendersReviewed}</TableCell>
                            <TableCell className="text-center">{r.summary.clarificationsCreated}</TableCell>
                            <TableCell className="text-center">{r.summary.presentationsScheduled}</TableCell>
                            <TableCell className="text-center">{r.summary.resultsRecorded}</TableCell>
                            <TableCell className="text-right font-bold">{r.summary.totalActions}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="my" className="space-y-6">
          {isLoadingMy ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {Array(10).fill(0).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-16 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : myReport ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card data-testid="card-my-not-relevant">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Not Relevant</p>
                        <p className="text-xl font-bold">{myReport.summary.tendersMarkedNotRelevant}</p>
                      </div>
                      <XCircle className="w-6 h-6 text-red-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card data-testid="card-my-not-eligible">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Not Eligible</p>
                        <p className="text-xl font-bold">{myReport.summary.tendersMarkedNotEligible}</p>
                      </div>
                      <XCircle className="w-6 h-6 text-yellow-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card data-testid="card-my-assigned">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Assigned</p>
                        <p className="text-xl font-bold">{myReport.summary.tendersAssigned}</p>
                      </div>
                      <User className="w-6 h-6 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card data-testid="card-my-submitted">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Submitted</p>
                        <p className="text-xl font-bold">{myReport.summary.tendersSubmitted}</p>
                      </div>
                      <Send className="w-6 h-6 text-green-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card data-testid="card-my-reviewed">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Reviewed</p>
                        <p className="text-xl font-bold">{myReport.summary.tendersReviewed}</p>
                      </div>
                      <Eye className="w-6 h-6 text-purple-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card data-testid="card-my-clarifications-created">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Clarifications</p>
                        <p className="text-xl font-bold">{myReport.summary.clarificationsCreated}</p>
                      </div>
                      <MessageSquare className="w-6 h-6 text-cyan-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card data-testid="card-my-clarifications-submitted">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Clarif. Submitted</p>
                        <p className="text-xl font-bold">{myReport.summary.clarificationsSubmitted}</p>
                      </div>
                      <CheckCircle className="w-6 h-6 text-teal-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card data-testid="card-my-presentations-scheduled">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Presentations</p>
                        <p className="text-xl font-bold">{myReport.summary.presentationsScheduled}</p>
                      </div>
                      <Presentation className="w-6 h-6 text-indigo-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card data-testid="card-my-presentations-completed">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Pres. Completed</p>
                        <p className="text-xl font-bold">{myReport.summary.presentationsCompleted}</p>
                      </div>
                      <CheckCircle className="w-6 h-6 text-green-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card data-testid="card-my-results">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Results</p>
                        <p className="text-xl font-bold">{myReport.summary.resultsRecorded}</p>
                      </div>
                      <Trophy className="w-6 h-6 text-amber-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Activity Distribution</CardTitle>
                    <CardDescription>Breakdown of your activities</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {pieChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={pieChartData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, value }) => `${name}: ${value}`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {pieChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                        No activities in this period
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Daily Trend</CardTitle>
                    <CardDescription>Activity over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {dailyTrendData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={dailyTrendData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="activities" name="Total" stroke="#3B82F6" strokeWidth={2} />
                          <Line type="monotone" dataKey="assigned" name="Assigned" stroke="#10B981" />
                          <Line type="monotone" dataKey="submitted" name="Submitted" stroke="#F59E0B" />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                        No daily data available
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Daily Breakdown</CardTitle>
                  <CardDescription>Detailed activity by day</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-center">Not Relevant</TableHead>
                          <TableHead className="text-center">Not Eligible</TableHead>
                          <TableHead className="text-center">Assigned</TableHead>
                          <TableHead className="text-center">Submitted</TableHead>
                          <TableHead className="text-center">Reviewed</TableHead>
                          <TableHead className="text-center">Clarifications</TableHead>
                          <TableHead className="text-center">Presentations</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {myReport.dailyBreakdown.map((day, index) => (
                          <TableRow key={day.date} data-testid={`row-daily-${index}`}>
                            <TableCell className="font-medium">{format(new Date(day.date), 'MMM d, yyyy')}</TableCell>
                            <TableCell className="text-center">{day.notRelevant}</TableCell>
                            <TableCell className="text-center">{day.notEligible}</TableCell>
                            <TableCell className="text-center">{day.assigned}</TableCell>
                            <TableCell className="text-center">{day.submitted}</TableCell>
                            <TableCell className="text-center">{day.reviewed}</TableCell>
                            <TableCell className="text-center">{day.clarifications}</TableCell>
                            <TableCell className="text-center">{day.presentations}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No report data available. Make sure you have a team member account.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {isAdmin && (
          <TabsContent value="member" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Select Team Member</CardTitle>
                <CardDescription>View detailed report for a specific team member</CardDescription>
              </CardHeader>
              <CardContent>
                <Select 
                  value={selectedMemberId === 'all' ? 'all' : selectedMemberId.toString()} 
                  onValueChange={(v) => setSelectedMemberId(v === 'all' ? 'all' : parseInt(v))}
                >
                  <SelectTrigger className="w-[300px]" data-testid="select-team-member">
                    <SelectValue placeholder="Select a team member" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">-- Select Member --</SelectItem>
                    {teamMembers?.map(m => (
                      <SelectItem key={m.id} value={m.id.toString()}>
                        {m.fullName || m.username} ({m.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {typeof selectedMemberId === 'number' && selectedMemberReport && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Not Relevant</p>
                          <p className="text-xl font-bold">{selectedMemberReport.summary.tendersMarkedNotRelevant}</p>
                        </div>
                        <XCircle className="w-6 h-6 text-red-500" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Not Eligible</p>
                          <p className="text-xl font-bold">{selectedMemberReport.summary.tendersMarkedNotEligible}</p>
                        </div>
                        <XCircle className="w-6 h-6 text-yellow-500" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Assigned</p>
                          <p className="text-xl font-bold">{selectedMemberReport.summary.tendersAssigned}</p>
                        </div>
                        <User className="w-6 h-6 text-blue-500" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Submitted</p>
                          <p className="text-xl font-bold">{selectedMemberReport.summary.tendersSubmitted}</p>
                        </div>
                        <Send className="w-6 h-6 text-green-500" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Reviewed</p>
                          <p className="text-xl font-bold">{selectedMemberReport.summary.tendersReviewed}</p>
                        </div>
                        <Eye className="w-6 h-6 text-purple-500" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Activity Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {pieChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                          <PieChart>
                            <Pie
                              data={pieChartData}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, value }) => `${name}: ${value}`}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {pieChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                          No activities in this period
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Daily Trend</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {dailyTrendData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                          <LineChart data={dailyTrendData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="activities" name="Total" stroke="#3B82F6" strokeWidth={2} />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                          No daily data available
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Daily Breakdown for {selectedMemberReport.teamMember.fullName}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[300px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-center">Not Relevant</TableHead>
                            <TableHead className="text-center">Not Eligible</TableHead>
                            <TableHead className="text-center">Assigned</TableHead>
                            <TableHead className="text-center">Submitted</TableHead>
                            <TableHead className="text-center">Reviewed</TableHead>
                            <TableHead className="text-center">Clarifications</TableHead>
                            <TableHead className="text-center">Presentations</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedMemberReport.dailyBreakdown.map((day, index) => (
                            <TableRow key={day.date}>
                              <TableCell className="font-medium">{format(new Date(day.date), 'MMM d, yyyy')}</TableCell>
                              <TableCell className="text-center">{day.notRelevant}</TableCell>
                              <TableCell className="text-center">{day.notEligible}</TableCell>
                              <TableCell className="text-center">{day.assigned}</TableCell>
                              <TableCell className="text-center">{day.submitted}</TableCell>
                              <TableCell className="text-center">{day.reviewed}</TableCell>
                              <TableCell className="text-center">{day.clarifications}</TableCell>
                              <TableCell className="text-center">{day.presentations}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
