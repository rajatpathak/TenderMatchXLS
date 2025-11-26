import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Search } from "lucide-react";
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
import { 
  ClipboardList, 
  Loader2,
  Play,
  Eye,
  Send,
  Clock,
  User,
  Building2,
  Hash,
  ArrowRight,
  IndianRupee,
  Calendar,
  AlertCircle,
  Filter,
  RefreshCw,
  ChevronRight,
  Flag,
  UserPlus,
  CheckCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { AssignTenderDialog } from "@/components/AssignTenderDialog";
import { Link } from "wouter";
import type { TenderAssignment, Tender, TeamMember } from "@shared/schema";

type AssignmentWithDetails = TenderAssignment & {
  tender?: Tender;
  assignee?: Omit<TeamMember, "password">;
  assigner?: Omit<TeamMember, "password">;
};

const stageConfig: Record<string, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  assigned: { label: "Assigned", icon: Clock, color: "text-slate-600 dark:text-slate-400", bgColor: "bg-slate-100 dark:bg-slate-800" },
  in_progress: { label: "In Progress", icon: Play, color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-100 dark:bg-blue-900" },
  ready_for_review: { label: "Ready for Review", icon: Eye, color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-100 dark:bg-amber-900" },
  submitted: { label: "Submitted", icon: Send, color: "text-emerald-600 dark:text-emerald-400", bgColor: "bg-emerald-100 dark:bg-emerald-900" },
};

const priorityConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  low: { label: "Low", color: "text-slate-500", bgColor: "bg-slate-100 dark:bg-slate-800" },
  normal: { label: "Normal", color: "text-blue-500", bgColor: "bg-blue-100 dark:bg-blue-900" },
  high: { label: "High", color: "text-orange-500", bgColor: "bg-orange-100 dark:bg-orange-900" },
  urgent: { label: "Urgent", color: "text-red-500", bgColor: "bg-red-100 dark:bg-red-900" },
};

function formatLakhs(value: string | number | null | undefined): string {
  if (!value) return "-";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "-";
  return `${num.toLocaleString("en-IN")} L`;
}

export default function AssignmentsHub() {
  const { toast } = useToast();
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentWithDetails | null>(null);
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [newStage, setNewStage] = useState("");
  const [stageNote, setStageNote] = useState("");
  const [submissionBudget, setSubmissionBudget] = useState("");
  const [submissionRef, setSubmissionRef] = useState("");
  const [submissionNote, setSubmissionNote] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [tenderToAssign, setTenderToAssign] = useState<Tender | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: assignments = [], isLoading, refetch } = useQuery<AssignmentWithDetails[]>({
    queryKey: ["/api/assignments", activeTab, priorityFilter, assigneeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeTab !== "all") params.set("stage", activeTab);
      if (priorityFilter !== "all") params.set("priority", priorityFilter);
      if (assigneeFilter !== "all") params.set("assignee", assigneeFilter);
      const url = `/api/assignments${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: teamMembers = [] } = useQuery<Omit<TeamMember, "password">[]>({
    queryKey: ["/api/team-members"],
  });

  const { data: currentTeamMember } = useQuery<Omit<TeamMember, "password">>({
    queryKey: ["/api/me/team-member"],
    retry: false,
  });

  const { data: workflowStats } = useQuery<{
    assigned: number;
    inProgress: number;
    readyForReview: number;
    submitted: number;
    totalBudget: number;
  }>({
    queryKey: ["/api/workflow-stats"],
  });

  const { data: eligibleTenders = [] } = useQuery<Tender[]>({
    queryKey: ["/api/tenders/status", "eligible"],
  });

  const assignedTenderIds = new Set(assignments.map(a => a.tenderId));
  const unassignedTenders = eligibleTenders.filter(t => !assignedTenderIds.has(t.id));

  const filteredAssignments = useMemo(() => {
    return assignments.filter(assignment => {
      const searchLower = searchQuery.toLowerCase();
      const tenderTitle = assignment.tender?.title?.toLowerCase() || "";
      const tenderId = assignment.tender?.t247Id?.toLowerCase() || "";
      return tenderTitle.includes(searchLower) || tenderId.includes(searchLower);
    });
  }, [assignments, searchQuery]);

  const handleAssignTender = (tender: Tender) => {
    setTenderToAssign(tender);
    setAssignDialogOpen(true);
  };

  const updateStageMutation = useMutation({
    mutationFn: async (data: { id: number; stage: string; changedBy: number; note?: string }) => {
      return apiRequest("POST", `/api/assignments/${data.id}/stage`, {
        stage: data.stage,
        changedBy: data.changedBy,
        note: data.note,
      });
    },
    onSuccess: () => {
      toast({
        title: "Stage Updated",
        description: "The workflow stage has been updated successfully.",
      });
      setStageDialogOpen(false);
      setSelectedAssignment(null);
      setNewStage("");
      setStageNote("");
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workflow-stats"] });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update the workflow stage.",
        variant: "destructive",
      });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: {
      tenderId: number;
      assignmentId: number;
      submittedBy: number;
      submittedBudget: string;
      submissionDate: string;
      portalReferenceNumber?: string;
      notes?: string;
    }) => {
      return apiRequest("POST", "/api/submissions", data);
    },
    onSuccess: () => {
      toast({
        title: "Bid Submitted",
        description: "The bid submission has been recorded successfully.",
      });
      setSubmitDialogOpen(false);
      setSelectedAssignment(null);
      setSubmissionBudget("");
      setSubmissionRef("");
      setSubmissionNote("");
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workflow-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/submissions"] });
    },
    onError: () => {
      toast({
        title: "Submission Failed",
        description: "Failed to record the bid submission.",
        variant: "destructive",
      });
    },
  });

  const handleQuickStageUpdate = (assignment: AssignmentWithDetails, nextStage: string) => {
    if (!currentTeamMember) {
      toast({
        title: "Error",
        description: "You are not registered as a team member.",
        variant: "destructive",
      });
      return;
    }
    
    if (nextStage === "submitted") {
      setSelectedAssignment(assignment);
      setSubmitDialogOpen(true);
    } else {
      setSelectedAssignment(assignment);
      setNewStage(nextStage);
      setStageDialogOpen(true);
    }
  };

  const confirmStageUpdate = () => {
    if (!selectedAssignment || !newStage || !currentTeamMember) return;
    updateStageMutation.mutate({
      id: selectedAssignment.id,
      stage: newStage,
      changedBy: currentTeamMember.id,
      note: stageNote || undefined,
    });
  };

  const confirmSubmission = () => {
    if (!selectedAssignment || !submissionBudget || !currentTeamMember) return;
    submitMutation.mutate({
      tenderId: selectedAssignment.tenderId,
      assignmentId: selectedAssignment.id,
      submittedBy: currentTeamMember.id,
      submittedBudget: submissionBudget,
      submissionDate: new Date().toISOString(),
      portalReferenceNumber: submissionRef || undefined,
      notes: submissionNote || undefined,
    });
  };

  const getNextStage = (currentStage: string): string | null => {
    const stages = ["assigned", "in_progress", "ready_for_review", "submitted"];
    const currentIndex = stages.indexOf(currentStage);
    if (currentIndex < stages.length - 1) {
      return stages[currentIndex + 1];
    }
    return null;
  };

  const stageCounts = {
    all: filteredAssignments.length,
    assigned: filteredAssignments.filter(a => a.currentStage === "assigned").length,
    in_progress: filteredAssignments.filter(a => a.currentStage === "in_progress").length,
    ready_for_review: filteredAssignments.filter(a => a.currentStage === "ready_for_review").length,
    submitted: filteredAssignments.filter(a => a.currentStage === "submitted").length,
  };

  const overdueCount = useMemo(() => {
    return assignments.filter(a => {
      const deadline = a.tender?.submissionDeadline;
      return deadline && isPast(new Date(deadline));
    }).length;
  }, [assignments]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <ClipboardList className="w-6 h-6" />
              Assignments Hub
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage and track all tender assignments
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-6 gap-4 mt-6">
          {overdueCount > 0 && (
            <Card className="border-red-200 dark:border-red-800 hover-elevate">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Overdue</p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">{overdueCount}</p>
                  </div>
                  <div className="p-3 rounded-full bg-red-100 dark:bg-red-900">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          <Card className={`hover-elevate ${unassignedTenders.length > 0 ? "border-blue-200 dark:border-blue-800" : ""}`}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Unassigned</p>
                  <p className={`text-2xl font-bold ${unassignedTenders.length > 0 ? "text-blue-600 dark:text-blue-400" : "text-foreground"}`}>
                    {unassignedTenders.length}
                  </p>
                </div>
                <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900">
                  <UserPlus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="hover-elevate">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Assigned</p>
                  <p className="text-2xl font-bold text-foreground">{workflowStats?.assigned || 0}</p>
                </div>
                <div className={`p-3 rounded-full ${stageConfig.assigned.bgColor}`}>
                  <Clock className={`w-5 h-5 ${stageConfig.assigned.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="hover-elevate">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                  <p className="text-2xl font-bold text-foreground">{workflowStats?.inProgress || 0}</p>
                </div>
                <div className={`p-3 rounded-full ${stageConfig.in_progress.bgColor}`}>
                  <Play className={`w-5 h-5 ${stageConfig.in_progress.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="hover-elevate">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Ready for Review</p>
                  <p className="text-2xl font-bold text-foreground">{workflowStats?.readyForReview || 0}</p>
                </div>
                <div className={`p-3 rounded-full ${stageConfig.ready_for_review.bgColor}`}>
                  <Eye className={`w-5 h-5 ${stageConfig.ready_for_review.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="hover-elevate">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Submitted</p>
                  <p className="text-2xl font-bold text-foreground">{workflowStats?.submitted || 0}</p>
                </div>
                <div className={`p-3 rounded-full ${stageConfig.submitted.bgColor}`}>
                  <Send className={`w-5 h-5 ${stageConfig.submitted.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {unassignedTenders.length > 0 && (
          <Card className="mt-4 border-blue-200 dark:border-blue-800">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <CardTitle className="text-base">Ready to Assign ({unassignedTenders.length})</CardTitle>
                </div>
                <Link href="/tenders/eligible">
                  <Button variant="outline" size="sm" className="gap-1">
                    View All
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
              <CardDescription>Eligible tenders waiting to be assigned to bidders</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                {unassignedTenders.slice(0, 5).map((tender) => (
                  <div 
                    key={tender.id} 
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    data-testid={`unassigned-tender-${tender.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-mono text-muted-foreground">{tender.t247Id}</span>
                        <span className="text-foreground font-medium truncate">{tender.title}</span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <IndianRupee className="w-3 h-3" />
                          {formatLakhs(tender.estimatedValue)}
                        </span>
                        {tender.submissionDeadline && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(tender.submissionDeadline), "dd MMM yyyy")}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleAssignTender(tender)}
                      className="gap-1 shrink-0"
                      data-testid={`button-assign-${tender.id}`}
                    >
                      <UserPlus className="w-4 h-4" />
                      Assign
                    </Button>
                  </div>
                ))}
                {unassignedTenders.length > 5 && (
                  <p className="text-center text-sm text-muted-foreground pt-2">
                    +{unassignedTenders.length - 5} more tenders available
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="">
            <TabsList>
              <TabsTrigger value="all" data-testid="tab-all">
                All ({stageCounts.all})
              </TabsTrigger>
              <TabsTrigger value="assigned" data-testid="tab-assigned">
                Assigned ({stageCounts.assigned})
              </TabsTrigger>
              <TabsTrigger value="in_progress" data-testid="tab-in-progress">
                In Progress ({stageCounts.in_progress})
              </TabsTrigger>
              <TabsTrigger value="ready_for_review" data-testid="tab-ready-for-review">
                Ready for Review ({stageCounts.ready_for_review})
              </TabsTrigger>
              <TabsTrigger value="submitted" data-testid="tab-submitted">
                Submitted ({stageCounts.submitted})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by title or T247 ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-assignments"
              />
            </div>
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-32" data-testid="filter-priority">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="w-40" data-testid="filter-assignee">
                <SelectValue placeholder="Assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assignees</SelectItem>
                {teamMembers.filter(m => m.isActive).map(member => (
                  <SelectItem key={member.id} value={member.id.toString()}>
                    {member.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <ScrollArea className="flex-1">
          {filteredAssignments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <ClipboardList className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">{searchQuery ? "No assignments match your search" : "No assignments found"}</p>
              <p className="text-sm">{searchQuery ? "Try adjusting your search filters" : "Assign tenders from the Dashboard to get started"}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">T247 ID</TableHead>
                  <TableHead>Tender Title</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssignments.map((assignment) => {
                  const nextStage = getNextStage(assignment.currentStage || "assigned");
                  const config = stageConfig[assignment.currentStage || "assigned"];
                  const prioConfig = priorityConfig[assignment.priority || "normal"];
                  const StageIcon = config?.icon || Clock;
                  const deadline = assignment.tender?.submissionDeadline;
                  const isOverdue = deadline && isPast(new Date(deadline));

                  return (
                    <TableRow key={assignment.id} data-testid={`row-assignment-${assignment.id}`}>
                      <TableCell className="font-mono text-sm">
                        {assignment.tender?.t247Id || "-"}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[300px]">
                          <p className="font-medium text-foreground truncate">
                            {assignment.tender?.title || "Unknown Tender"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {assignment.tender?.department}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{assignment.assignee?.fullName || "Unassigned"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${config?.bgColor} ${config?.color} border-0`}>
                          <StageIcon className="w-3 h-3 mr-1" />
                          {config?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${prioConfig?.bgColor} ${prioConfig?.color} border-0`}>
                          <Flag className="w-3 h-3 mr-1" />
                          {prioConfig?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium">
                          {formatLakhs(assignment.tender?.estimatedValue)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {deadline ? (
                          <div className={`text-sm ${isOverdue ? "text-red-500" : "text-muted-foreground"}`}>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(deadline), "dd MMM yyyy")}
                            </div>
                            <div className="text-xs">
                              {isOverdue ? "Overdue" : formatDistanceToNow(new Date(deadline), { addSuffix: true })}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {nextStage && assignment.currentStage !== "submitted" && (
                          <Button
                            size="sm"
                            onClick={() => handleQuickStageUpdate(assignment, nextStage)}
                            className="gap-1"
                            data-testid={`button-next-stage-${assignment.id}`}
                          >
                            <ArrowRight className="w-4 h-4" />
                            {nextStage === "submitted" ? "Submit" : stageConfig[nextStage]?.label}
                          </Button>
                        )}
                        {assignment.currentStage === "submitted" && (
                          <Badge variant="outline" className="bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400 border-0">
                            Completed
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </div>

      <Dialog open={stageDialogOpen} onOpenChange={setStageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Workflow Stage</DialogTitle>
            <DialogDescription>
              Move "{selectedAssignment?.tender?.title}" to {stageConfig[newStage]?.label}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
              <Badge variant="outline" className={`${stageConfig[selectedAssignment?.currentStage || "assigned"]?.bgColor} ${stageConfig[selectedAssignment?.currentStage || "assigned"]?.color} border-0`}>
                {stageConfig[selectedAssignment?.currentStage || "assigned"]?.label}
              </Badge>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <Badge variant="outline" className={`${stageConfig[newStage]?.bgColor} ${stageConfig[newStage]?.color} border-0`}>
                {stageConfig[newStage]?.label}
              </Badge>
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Textarea
                value={stageNote}
                onChange={(e) => setStageNote(e.target.value)}
                placeholder="Add a note about this stage update..."
                className="mt-1"
                data-testid="input-stage-note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStageDialogOpen(false)}>Cancel</Button>
            <Button onClick={confirmStageUpdate} disabled={updateStageMutation.isPending} data-testid="button-confirm-stage">
              {updateStageMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Update Stage
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Bid Submission</DialogTitle>
            <DialogDescription>
              Record the final submission for "{selectedAssignment?.tender?.title}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Estimated Value:</span>
                <span className="font-medium">{formatLakhs(selectedAssignment?.tender?.estimatedValue)}</span>
              </div>
            </div>
            <div>
              <Label>Submitted Budget (in Lakhs) *</Label>
              <div className="relative mt-1">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.01"
                  value={submissionBudget}
                  onChange={(e) => setSubmissionBudget(e.target.value)}
                  placeholder="Enter budget in Lakhs"
                  className="pl-9"
                  data-testid="input-submission-budget"
                />
              </div>
            </div>
            <div>
              <Label>Portal Reference Number</Label>
              <Input
                value={submissionRef}
                onChange={(e) => setSubmissionRef(e.target.value)}
                placeholder="e.g., GEM/2024/B/12345"
                className="mt-1"
                data-testid="input-submission-ref"
              />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                value={submissionNote}
                onChange={(e) => setSubmissionNote(e.target.value)}
                placeholder="Add any notes about this submission..."
                className="mt-1"
                data-testid="input-submission-note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={confirmSubmission} 
              disabled={!submissionBudget || submitMutation.isPending}
              data-testid="button-confirm-submission"
            >
              {submitMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Record Submission
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AssignTenderDialog
        tender={tenderToAssign}
        open={assignDialogOpen}
        onClose={() => {
          setAssignDialogOpen(false);
          setTenderToAssign(null);
        }}
      />
    </div>
  );
}
