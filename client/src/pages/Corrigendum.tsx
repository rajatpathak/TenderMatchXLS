import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  FileStack, 
  Building2,
  Calendar,
  ArrowRight,
  Plus,
  Minus,
  RefreshCw,
  Eye
} from "lucide-react";
import type { Tender, CorrigendumChange } from "@shared/schema";

interface CorrigendumWithChanges extends Tender {
  changes: CorrigendumChange[];
  originalTender?: Tender;
}

export default function Corrigendum() {
  const [selectedCorrigendum, setSelectedCorrigendum] = useState<CorrigendumWithChanges | null>(null);

  const { data: corrigendums = [], isLoading } = useQuery<CorrigendumWithChanges[]>({
    queryKey: ["/api/tenders/corrigendum"],
  });

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getChangeIcon = (change: CorrigendumChange) => {
    if (!change.oldValue && change.newValue) {
      return <Plus className="w-4 h-4 text-emerald-500" />;
    }
    if (change.oldValue && !change.newValue) {
      return <Minus className="w-4 h-4 text-red-500" />;
    }
    return <RefreshCw className="w-4 h-4 text-amber-500" />;
  };

  const getChangeColor = (change: CorrigendumChange) => {
    if (!change.oldValue && change.newValue) {
      return "bg-emerald-500/10 border-emerald-200 dark:border-emerald-800";
    }
    if (change.oldValue && !change.newValue) {
      return "bg-red-500/10 border-red-200 dark:border-red-800";
    }
    return "bg-amber-500/10 border-amber-200 dark:border-amber-800";
  };

  const formatFieldName = (name: string) => {
    return name
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <FileStack className="w-6 h-6" />
          Corrigendum
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track changes in updated tenders compared to their original versions
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-6 w-20" />
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : corrigendums.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <FileStack className="w-12 h-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">No corrigendums found</h3>
          <p className="text-sm text-muted-foreground">
            When duplicate T247 IDs are detected in uploads, changes will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {corrigendums.map((corrigendum) => (
            <Card 
              key={corrigendum.id} 
              className="hover-elevate cursor-pointer"
              onClick={() => setSelectedCorrigendum(corrigendum)}
              data-testid={`card-corrigendum-${corrigendum.id}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-muted-foreground">
                        {corrigendum.t247Id}
                      </span>
                      <Badge 
                        variant="outline" 
                        className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                      >
                        Corrigendum
                      </Badge>
                    </div>
                    <CardTitle className="text-sm font-semibold line-clamp-2">
                      {corrigendum.title || "Untitled Tender"}
                    </CardTitle>
                  </div>
                  <Badge variant="outline">
                    {corrigendum.changes?.length || 0} changes
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                  {corrigendum.department && (
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-4 h-4" />
                      <span className="truncate max-w-[200px]">{corrigendum.department}</span>
                    </div>
                  )}
                  {corrigendum.createdAt && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDate(corrigendum.createdAt)}</span>
                    </div>
                  )}
                </div>
                
                {corrigendum.changes && corrigendum.changes.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {corrigendum.changes.slice(0, 3).map((change, idx) => (
                      <Badge 
                        key={idx}
                        variant="outline"
                        className={`text-xs ${getChangeColor(change)}`}
                      >
                        {getChangeIcon(change)}
                        <span className="ml-1">{formatFieldName(change.fieldName)}</span>
                      </Badge>
                    ))}
                    {corrigendum.changes.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{corrigendum.changes.length - 3} more
                      </Badge>
                    )}
                  </div>
                )}

                <div className="flex justify-end mt-3">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCorrigendum(corrigendum);
                    }}
                    data-testid={`button-view-changes-${corrigendum.id}`}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    View Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog 
        open={!!selectedCorrigendum} 
        onOpenChange={(open) => !open && setSelectedCorrigendum(null)}
      >
        <DialogContent className="sm:max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileStack className="w-5 h-5" />
              Corrigendum Changes
            </DialogTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-mono">{selectedCorrigendum?.t247Id}</span>
              <ArrowRight className="w-4 h-4" />
              <span>{selectedCorrigendum?.title || "Untitled"}</span>
            </div>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4">
              {selectedCorrigendum?.changes?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No changes detected
                </div>
              ) : (
                selectedCorrigendum?.changes?.map((change, idx) => (
                  <Card key={idx} className={`border ${getChangeColor(change)}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        {getChangeIcon(change)}
                        <span className="font-medium text-foreground">
                          {formatFieldName(change.fieldName)}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-red-500" />
                            Original
                          </div>
                          <div className="rounded-md bg-red-500/5 p-3 text-sm text-foreground whitespace-pre-wrap min-h-[60px]">
                            {change.oldValue || <span className="text-muted-foreground italic">Empty</span>}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            Updated
                          </div>
                          <div className="rounded-md bg-emerald-500/5 p-3 text-sm text-foreground whitespace-pre-wrap min-h-[60px]">
                            {change.newValue || <span className="text-muted-foreground italic">Removed</span>}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>

          <div className="flex justify-end pt-4 border-t">
            <Button onClick={() => setSelectedCorrigendum(null)} data-testid="button-close-corrigendum">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
