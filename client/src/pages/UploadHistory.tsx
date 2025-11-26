import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  History, 
  FileSpreadsheet,
  Calendar,
  FileStack,
  CheckCircle,
  XCircle,
  Ban,
  FileSearch,
  Clock,
} from "lucide-react";
import type { ExcelUpload } from "@shared/schema";

export default function UploadHistory() {
  const { data: uploads = [], isLoading } = useQuery<ExcelUpload[]>({
    queryKey: ["/api/uploads"],
  });

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <History className="w-6 h-6" />
          Upload History
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          View all previously uploaded Excel files and their processing results
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="w-12 h-12 rounded-lg" />
                  <div className="flex-1">
                    <Skeleton className="h-5 w-48 mb-2" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-8 w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : uploads.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <FileSpreadsheet className="w-12 h-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">No uploads yet</h3>
          <p className="text-sm text-muted-foreground">
            Upload an Excel file from the Dashboard to get started
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {uploads.map((upload) => (
            <Card key={upload.id} className="hover-elevate" data-testid={`card-upload-${upload.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-6 h-6 text-primary" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">
                      {upload.fileName}
                    </h3>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(upload.uploadedAt)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <FileStack className="w-4 h-4" />
                        <span>{upload.totalTenders || 0} tenders</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <Badge 
                        variant="outline" 
                        className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800"
                      >
                        GEM: {upload.gemCount || 0}
                      </Badge>
                      <Badge 
                        variant="outline" 
                        className="bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                      >
                        Non-GEM: {upload.nonGemCount || 0}
                      </Badge>
                      <span className="text-muted-foreground">|</span>
                      <Badge 
                        variant="outline" 
                        className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 flex items-center gap-1"
                      >
                        <CheckCircle className="w-3 h-3" />
                        Eligible: {upload.eligibleCount || 0}
                      </Badge>
                      <Badge 
                        variant="outline" 
                        className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 flex items-center gap-1"
                      >
                        <XCircle className="w-3 h-3" />
                        Not Eligible: {upload.notEligibleCount || 0}
                      </Badge>
                      <Badge 
                        variant="outline" 
                        className="bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 flex items-center gap-1"
                      >
                        <Ban className="w-3 h-3" />
                        Not Relevant: {upload.notRelevantCount || 0}
                      </Badge>
                      <Badge 
                        variant="outline" 
                        className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 flex items-center gap-1"
                      >
                        <FileSearch className="w-3 h-3" />
                        Review: {upload.manualReviewCount || 0}
                      </Badge>
                      {(upload.missedCount || 0) > 0 && (
                        <Badge 
                          variant="outline" 
                          className="bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 flex items-center gap-1"
                        >
                          <Clock className="w-3 h-3" />
                          Missed: {upload.missedCount}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
