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
  Award,
  Target,
  Percent,
  FileText,
} from "lucide-react";
import jsPDF from "jspdf";
import "jspdf-autotable";
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
    resultsL1: number;
    resultsAwarded: number;
    resultsLost: number;
    resultsCancelled: number;
    winRatio: number;
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
    resultsL1: number;
    resultsAwarded: number;
    resultsLost: number;
    resultsCancelled: number;
    winRatio: number;
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
    l1: number;
    awarded: number;
    notRelevantIds?: string[];
    notEligibleIds?: string[];
    assignedIds?: string[];
    submittedIds?: string[];
    reviewedIds?: string[];
    clarificationIds?: string[];
    presentationIds?: string[];
    l1Ids?: string[];
    awardedIds?: string[];
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

  const handlePDFDownload = () => {
    const report = myReport;
    if (!report) {
      toast({ title: "No report data available", variant: "destructive" });
      return;
    }

    const doc = new jsPDF();
    const userName = report.teamMember?.fullName || report.user?.username || 'Unknown';
    
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('MIS Report', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`User: ${userName}`, 14, 35);
    doc.text(`Period: ${format(new Date(startDate), 'MMM d, yyyy')} - ${format(new Date(endDate), 'MMM d, yyyy')}`, 14, 42);
    doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy HH:mm')}`, 14, 49);
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Summary', 14, 62);
    
    const summaryData = [
      ['Metric', 'Count'],
      ['Not Relevant', String(report.summary.tendersMarkedNotRelevant)],
      ['Not Eligible', String(report.summary.tendersMarkedNotEligible)],
      ['Assigned', String(report.summary.tendersAssigned)],
      ['Submitted', String(report.summary.tendersSubmitted)],
      ['Reviewed', String(report.summary.tendersReviewed)],
      ['Clarifications Created', String(report.summary.clarificationsCreated)],
      ['Clarifications Submitted', String(report.summary.clarificationsSubmitted)],
      ['Presentations Scheduled', String(report.summary.presentationsScheduled)],
      ['Presentations Completed', String(report.summary.presentationsCompleted)],
      ['Results Recorded', String(report.summary.resultsRecorded)],
      ['L1', String(report.summary.resultsL1 || 0)],
      ['Awarded', String(report.summary.resultsAwarded || 0)],
      ['Lost', String(report.summary.resultsLost || 0)],
      ['Cancelled', String(report.summary.resultsCancelled || 0)],
      ['Win Ratio', `${report.summary.winRatio || 0}%`],
    ];
    
    (doc as any).autoTable({
      startY: 68,
      head: [summaryData[0]],
      body: summaryData.slice(1),
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 40, halign: 'center' },
      },
    });
    
    const finalY1 = (doc as any).lastAutoTable?.finalY || 180;
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Daily Breakdown', 14, finalY1 + 15);
    
    const dailyHeaders = ['Date', 'Not Rel.', 'Not Elig.', 'Assigned', 'Submitted', 'Reviewed', 'Clarif.', 'Pres.', 'L1', 'Awarded'];
    const dailyRows = report.dailyBreakdown.map(day => [
      format(new Date(day.date), 'MMM d'),
      String(day.notRelevant),
      String(day.notEligible),
      String(day.assigned),
      String(day.submitted),
      String(day.reviewed),
      String(day.clarifications),
      String(day.presentations),
      String(day.l1 || 0),
      String(day.awarded || 0),
    ]);
    
    (doc as any).autoTable({
      startY: finalY1 + 20,
      head: [dailyHeaders],
      body: dailyRows,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 18, halign: 'center' },
        2: { cellWidth: 18, halign: 'center' },
        3: { cellWidth: 20, halign: 'center' },
        4: { cellWidth: 20, halign: 'center' },
        5: { cellWidth: 20, halign: 'center' },
        6: { cellWidth: 18, halign: 'center' },
        7: { cellWidth: 16, halign: 'center' },
        8: { cellWidth: 16, halign: 'center' },
        9: { cellWidth: 20, halign: 'center' },
      },
    });
    
    const finalY2 = (doc as any).lastAutoTable?.finalY || 250;
    
    if (report.dailyBreakdown.some(d => 
      (d.notRelevantIds?.length || 0) > 0 || 
      (d.assignedIds?.length || 0) > 0 || 
      (d.submittedIds?.length || 0) > 0 ||
      (d.l1Ids?.length || 0) > 0 ||
      (d.awardedIds?.length || 0) > 0
    )) {
      if (finalY2 > 250) {
        doc.addPage();
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Tender IDs by Activity', 14, 20);
        
        let yPos = 30;
        for (const day of report.dailyBreakdown) {
          const hasIds = (day.notRelevantIds?.length || 0) > 0 || 
                        (day.assignedIds?.length || 0) > 0 || 
                        (day.submittedIds?.length || 0) > 0 ||
                        (day.l1Ids?.length || 0) > 0 ||
                        (day.awardedIds?.length || 0) > 0;
          
          if (hasIds) {
            if (yPos > 270) {
              doc.addPage();
              yPos = 20;
            }
            
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text(format(new Date(day.date), 'MMM d, yyyy'), 14, yPos);
            yPos += 6;
            
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            
            if (day.notRelevantIds?.length) {
              doc.text(`  Not Relevant: ${day.notRelevantIds.join(', ')}`, 14, yPos);
              yPos += 5;
            }
            if (day.notEligibleIds?.length) {
              doc.text(`  Not Eligible: ${day.notEligibleIds.join(', ')}`, 14, yPos);
              yPos += 5;
            }
            if (day.assignedIds?.length) {
              doc.text(`  Assigned: ${day.assignedIds.join(', ')}`, 14, yPos);
              yPos += 5;
            }
            if (day.submittedIds?.length) {
              doc.text(`  Submitted: ${day.submittedIds.join(', ')}`, 14, yPos);
              yPos += 5;
            }
            if (day.reviewedIds?.length) {
              doc.text(`  Reviewed: ${day.reviewedIds.join(', ')}`, 14, yPos);
              yPos += 5;
            }
            if (day.l1Ids?.length) {
              doc.text(`  L1: ${day.l1Ids.join(', ')}`, 14, yPos);
              yPos += 5;
            }
            if (day.awardedIds?.length) {
              doc.text(`  Awarded: ${day.awardedIds.join(', ')}`, 14, yPos);
              yPos += 5;
            }
            yPos += 3;
          }
        }
      }
    }
    
    doc.save(`MIS_Report_${userName.replace(/\s+/g, '_')}_${startDate}_${endDate}.pdf`);
    toast({ title: "PDF report downloaded successfully" });
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
            CSV
          </Button>
          
          <Button 
            variant="outline" 
            onClick={handlePDFDownload}
            disabled={!myReport}
            data-testid="button-download-pdf-report"
          >
            <FileText className="w-4 h-4 mr-2" />
            PDF
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
                        <TableHead className="text-center">Not Rel.</TableHead>
                        <TableHead className="text-center">Not Elig.</TableHead>
                        <TableHead className="text-center">Assigned</TableHead>
                        <TableHead className="text-center">Submitted</TableHead>
                        <TableHead className="text-center">Reviewed</TableHead>
                        <TableHead className="text-center">Clarif.</TableHead>
                        <TableHead className="text-center">Pres.</TableHead>
                        <TableHead className="text-center">Results</TableHead>
                        <TableHead className="text-center">L1</TableHead>
                        <TableHead className="text-center">Awarded</TableHead>
                        <TableHead className="text-center">Win %</TableHead>
                        <TableHead className="text-right font-bold">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingAll ? (
                        Array(5).fill(0).map((_, i) => (
                          <TableRow key={i}>
                            {Array(13).fill(0).map((_, j) => (
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
                            <TableCell className="text-center">{r.summary.resultsL1 || 0}</TableCell>
                            <TableCell className="text-center">{r.summary.resultsAwarded || 0}</TableCell>
                            <TableCell className="text-center">{r.summary.winRatio || 0}%</TableCell>
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
                <Card data-testid="card-my-l1">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">L1</p>
                        <p className="text-xl font-bold">{myReport.summary.resultsL1 || 0}</p>
                      </div>
                      <Target className="w-6 h-6 text-blue-600" />
                    </div>
                  </CardContent>
                </Card>
                <Card data-testid="card-my-awarded">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Awarded</p>
                        <p className="text-xl font-bold">{myReport.summary.resultsAwarded || 0}</p>
                      </div>
                      <Award className="w-6 h-6 text-green-600" />
                    </div>
                  </CardContent>
                </Card>
                <Card data-testid="card-my-lost">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Lost</p>
                        <p className="text-xl font-bold">{myReport.summary.resultsLost || 0}</p>
                      </div>
                      <XCircle className="w-6 h-6 text-red-600" />
                    </div>
                  </CardContent>
                </Card>
                <Card data-testid="card-my-win-ratio">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Win Ratio</p>
                        <p className="text-xl font-bold">{myReport.summary.winRatio || 0}%</p>
                      </div>
                      <Percent className="w-6 h-6 text-emerald-500" />
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
                          <TableHead className="text-center">L1</TableHead>
                          <TableHead className="text-center">Awarded</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {myReport.dailyBreakdown.map((day, index) => (
                          <TableRow key={day.date} data-testid={`row-daily-${index}`}>
                            <TableCell className="font-medium">{format(new Date(day.date), 'MMM d, yyyy')}</TableCell>
                            <TableCell className="text-center">
                              {day.notRelevant > 0 && day.notRelevantIds && day.notRelevantIds.length > 0 ? (
                                <div className="flex flex-col items-center">
                                  <span className="font-medium">{day.notRelevant}</span>
                                  <span className="text-xs text-muted-foreground truncate max-w-[120px]" title={day.notRelevantIds.join(', ')}>
                                    {day.notRelevantIds.slice(0, 2).join(', ')}{day.notRelevantIds.length > 2 ? '...' : ''}
                                  </span>
                                </div>
                              ) : day.notRelevant}
                            </TableCell>
                            <TableCell className="text-center">
                              {day.notEligible > 0 && day.notEligibleIds && day.notEligibleIds.length > 0 ? (
                                <div className="flex flex-col items-center">
                                  <span className="font-medium">{day.notEligible}</span>
                                  <span className="text-xs text-muted-foreground truncate max-w-[120px]" title={day.notEligibleIds.join(', ')}>
                                    {day.notEligibleIds.slice(0, 2).join(', ')}{day.notEligibleIds.length > 2 ? '...' : ''}
                                  </span>
                                </div>
                              ) : day.notEligible}
                            </TableCell>
                            <TableCell className="text-center">
                              {day.assigned > 0 && day.assignedIds && day.assignedIds.length > 0 ? (
                                <div className="flex flex-col items-center">
                                  <span className="font-medium">{day.assigned}</span>
                                  <span className="text-xs text-muted-foreground truncate max-w-[120px]" title={day.assignedIds.join(', ')}>
                                    {day.assignedIds.slice(0, 2).join(', ')}{day.assignedIds.length > 2 ? '...' : ''}
                                  </span>
                                </div>
                              ) : day.assigned}
                            </TableCell>
                            <TableCell className="text-center">
                              {day.submitted > 0 && day.submittedIds && day.submittedIds.length > 0 ? (
                                <div className="flex flex-col items-center">
                                  <span className="font-medium">{day.submitted}</span>
                                  <span className="text-xs text-muted-foreground truncate max-w-[120px]" title={day.submittedIds.join(', ')}>
                                    {day.submittedIds.slice(0, 2).join(', ')}{day.submittedIds.length > 2 ? '...' : ''}
                                  </span>
                                </div>
                              ) : day.submitted}
                            </TableCell>
                            <TableCell className="text-center">
                              {day.reviewed > 0 && day.reviewedIds && day.reviewedIds.length > 0 ? (
                                <div className="flex flex-col items-center">
                                  <span className="font-medium">{day.reviewed}</span>
                                  <span className="text-xs text-muted-foreground truncate max-w-[120px]" title={day.reviewedIds.join(', ')}>
                                    {day.reviewedIds.slice(0, 2).join(', ')}{day.reviewedIds.length > 2 ? '...' : ''}
                                  </span>
                                </div>
                              ) : day.reviewed}
                            </TableCell>
                            <TableCell className="text-center">
                              {day.clarifications > 0 && day.clarificationIds && day.clarificationIds.length > 0 ? (
                                <div className="flex flex-col items-center">
                                  <span className="font-medium">{day.clarifications}</span>
                                  <span className="text-xs text-muted-foreground truncate max-w-[120px]" title={day.clarificationIds.join(', ')}>
                                    {day.clarificationIds.slice(0, 2).join(', ')}{day.clarificationIds.length > 2 ? '...' : ''}
                                  </span>
                                </div>
                              ) : day.clarifications}
                            </TableCell>
                            <TableCell className="text-center">
                              {day.presentations > 0 && day.presentationIds && day.presentationIds.length > 0 ? (
                                <div className="flex flex-col items-center">
                                  <span className="font-medium">{day.presentations}</span>
                                  <span className="text-xs text-muted-foreground truncate max-w-[120px]" title={day.presentationIds.join(', ')}>
                                    {day.presentationIds.slice(0, 2).join(', ')}{day.presentationIds.length > 2 ? '...' : ''}
                                  </span>
                                </div>
                              ) : day.presentations}
                            </TableCell>
                            <TableCell className="text-center">
                              {(day.l1 || 0) > 0 && day.l1Ids && day.l1Ids.length > 0 ? (
                                <div className="flex flex-col items-center">
                                  <span className="font-medium">{day.l1}</span>
                                  <span className="text-xs text-muted-foreground truncate max-w-[120px]" title={day.l1Ids.join(', ')}>
                                    {day.l1Ids.slice(0, 2).join(', ')}{day.l1Ids.length > 2 ? '...' : ''}
                                  </span>
                                </div>
                              ) : (day.l1 || 0)}
                            </TableCell>
                            <TableCell className="text-center">
                              {(day.awarded || 0) > 0 && day.awardedIds && day.awardedIds.length > 0 ? (
                                <div className="flex flex-col items-center">
                                  <span className="font-medium">{day.awarded}</span>
                                  <span className="text-xs text-muted-foreground truncate max-w-[120px]" title={day.awardedIds.join(', ')}>
                                    {day.awardedIds.slice(0, 2).join(', ')}{day.awardedIds.length > 2 ? '...' : ''}
                                  </span>
                                </div>
                              ) : (day.awarded || 0)}
                            </TableCell>
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
                    <CardTitle>Daily Breakdown for {selectedMemberReport.teamMember?.fullName}</CardTitle>
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
                              <TableCell className="text-center">
                                {day.notRelevant > 0 && day.notRelevantIds && day.notRelevantIds.length > 0 ? (
                                  <div className="flex flex-col items-center">
                                    <span className="font-medium">{day.notRelevant}</span>
                                    <span className="text-xs text-muted-foreground truncate max-w-[120px]" title={day.notRelevantIds.join(', ')}>
                                      {day.notRelevantIds.slice(0, 2).join(', ')}{day.notRelevantIds.length > 2 ? '...' : ''}
                                    </span>
                                  </div>
                                ) : day.notRelevant}
                              </TableCell>
                              <TableCell className="text-center">
                                {day.notEligible > 0 && day.notEligibleIds && day.notEligibleIds.length > 0 ? (
                                  <div className="flex flex-col items-center">
                                    <span className="font-medium">{day.notEligible}</span>
                                    <span className="text-xs text-muted-foreground truncate max-w-[120px]" title={day.notEligibleIds.join(', ')}>
                                      {day.notEligibleIds.slice(0, 2).join(', ')}{day.notEligibleIds.length > 2 ? '...' : ''}
                                    </span>
                                  </div>
                                ) : day.notEligible}
                              </TableCell>
                              <TableCell className="text-center">
                                {day.assigned > 0 && day.assignedIds && day.assignedIds.length > 0 ? (
                                  <div className="flex flex-col items-center">
                                    <span className="font-medium">{day.assigned}</span>
                                    <span className="text-xs text-muted-foreground truncate max-w-[120px]" title={day.assignedIds.join(', ')}>
                                      {day.assignedIds.slice(0, 2).join(', ')}{day.assignedIds.length > 2 ? '...' : ''}
                                    </span>
                                  </div>
                                ) : day.assigned}
                              </TableCell>
                              <TableCell className="text-center">
                                {day.submitted > 0 && day.submittedIds && day.submittedIds.length > 0 ? (
                                  <div className="flex flex-col items-center">
                                    <span className="font-medium">{day.submitted}</span>
                                    <span className="text-xs text-muted-foreground truncate max-w-[120px]" title={day.submittedIds.join(', ')}>
                                      {day.submittedIds.slice(0, 2).join(', ')}{day.submittedIds.length > 2 ? '...' : ''}
                                    </span>
                                  </div>
                                ) : day.submitted}
                              </TableCell>
                              <TableCell className="text-center">
                                {day.reviewed > 0 && day.reviewedIds && day.reviewedIds.length > 0 ? (
                                  <div className="flex flex-col items-center">
                                    <span className="font-medium">{day.reviewed}</span>
                                    <span className="text-xs text-muted-foreground truncate max-w-[120px]" title={day.reviewedIds.join(', ')}>
                                      {day.reviewedIds.slice(0, 2).join(', ')}{day.reviewedIds.length > 2 ? '...' : ''}
                                    </span>
                                  </div>
                                ) : day.reviewed}
                              </TableCell>
                              <TableCell className="text-center">
                                {day.clarifications > 0 && day.clarificationIds && day.clarificationIds.length > 0 ? (
                                  <div className="flex flex-col items-center">
                                    <span className="font-medium">{day.clarifications}</span>
                                    <span className="text-xs text-muted-foreground truncate max-w-[120px]" title={day.clarificationIds.join(', ')}>
                                      {day.clarificationIds.slice(0, 2).join(', ')}{day.clarificationIds.length > 2 ? '...' : ''}
                                    </span>
                                  </div>
                                ) : day.clarifications}
                              </TableCell>
                              <TableCell className="text-center">
                                {day.presentations > 0 && day.presentationIds && day.presentationIds.length > 0 ? (
                                  <div className="flex flex-col items-center">
                                    <span className="font-medium">{day.presentations}</span>
                                    <span className="text-xs text-muted-foreground truncate max-w-[120px]" title={day.presentationIds.join(', ')}>
                                      {day.presentationIds.slice(0, 2).join(', ')}{day.presentationIds.length > 2 ? '...' : ''}
                                    </span>
                                  </div>
                                ) : day.presentations}
                              </TableCell>
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
