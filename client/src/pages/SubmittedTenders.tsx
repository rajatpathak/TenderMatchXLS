import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Send, 
  Loader2,
  IndianRupee,
  Calendar,
  FileText,
  User,
  Building2,
  Hash,
} from "lucide-react";
import { format } from "date-fns";
import type { BiddingSubmission, Tender, TenderAssignment, TeamMember } from "@shared/schema";

type SubmissionWithDetails = BiddingSubmission & {
  tender?: Tender;
  assignment?: TenderAssignment;
  submitter?: Omit<TeamMember, "password">;
};

function formatLakhs(value: string | number | null | undefined): string {
  if (!value) return "-";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "-";
  return `${num.toLocaleString("en-IN")} L`;
}

export default function SubmittedTenders() {
  const { data: submissions = [], isLoading } = useQuery<SubmissionWithDetails[]>({
    queryKey: ["/api/submissions"],
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Send className="h-6 w-6" />
            Submitted Tenders
          </h1>
          <p className="text-muted-foreground mt-1">
            View all tenders that have been submitted to the portal
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Submitted</CardDescription>
              <CardTitle className="text-3xl">{submissions.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Budget Submitted</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-1">
                <IndianRupee className="h-6 w-6" />
                {formatLakhs(workflowStats?.totalBudget || 0)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Ready for Review</CardDescription>
              <CardTitle className="text-3xl text-amber-600">
                {workflowStats?.readyForReview || 0}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>In Progress</CardDescription>
              <CardTitle className="text-3xl text-blue-600">
                {workflowStats?.inProgress || 0}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Submission History
            </CardTitle>
            <CardDescription>
              All tender submissions made to the portal
            </CardDescription>
          </CardHeader>
          <CardContent>
            {submissions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Send className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No submissions yet</p>
                <p className="text-sm">Tenders will appear here once submitted to the portal</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tender</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Submitted By</TableHead>
                    <TableHead>Submission Date</TableHead>
                    <TableHead>Budget</TableHead>
                    <TableHead>Portal Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map((submission) => (
                    <TableRow key={submission.id} data-testid={`row-submission-${submission.id}`}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium line-clamp-2">
                            {submission.tender?.title || "Unknown Tender"}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Hash className="h-3 w-3" />
                            {submission.tender?.t247Id || "-"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Building2 className="h-3 w-3" />
                          {submission.tender?.department || submission.tender?.organization || "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {submission.submitter?.fullName || "Unknown"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {submission.submissionDate
                            ? format(new Date(submission.submissionDate), "MMM d, yyyy")
                            : "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="gap-1">
                          <IndianRupee className="h-3 w-3" />
                          {formatLakhs(submission.submittedBudget)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {submission.portalReferenceNumber ? (
                          <Badge variant="outline">
                            {submission.portalReferenceNumber}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground/50">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {submissions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Submission Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {submissions.filter(s => s.notes).map((submission) => (
                  <div key={submission.id} className="p-3 rounded-lg bg-muted/50 border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">
                        {submission.tender?.t247Id}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {submission.submissionDate
                          ? format(new Date(submission.submissionDate), "MMM d, yyyy")
                          : "-"}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{submission.notes}</p>
                  </div>
                ))}
                {submissions.filter(s => s.notes).length === 0 && (
                  <p className="text-muted-foreground text-sm text-center py-4">
                    No notes attached to any submissions
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </ScrollArea>
  );
}
