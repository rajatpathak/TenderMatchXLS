import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  AlertCircle, 
  Upload, 
  FileText,
  Building2,
  Calendar,
  IndianRupee,
  Loader2,
  CheckCircle2,
  X
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { Tender } from "@shared/schema";

export default function UnableToAnalyse() {
  const [selectedTender, setSelectedTender] = useState<Tender | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const { toast } = useToast();

  const { data: tenders = [], isLoading } = useQuery<Tender[]>({
    queryKey: ["/api/tenders", "unable_to_analyze"],
    queryFn: async () => {
      const response = await fetch("/api/tenders?status=unable_to_analyze", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch");
      return response.json();
    },
  });

  const uploadPdfMutation = useMutation({
    mutationFn: async ({ tenderId, file }: { tenderId: number; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("tenderId", tenderId.toString());
      
      const response = await fetch("/api/tenders/upload-pdf", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Upload failed");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "PDF Processed",
        description: "The tender has been re-analyzed with the uploaded document.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tenders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setSelectedTender(null);
      setPdfFile(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === "application/pdf") {
        setPdfFile(droppedFile);
      } else {
        toast({
          title: "Invalid File",
          description: "Please upload a PDF document",
          variant: "destructive",
        });
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPdfFile(e.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (selectedTender && pdfFile) {
      uploadPdfMutation.mutate({ tenderId: selectedTender.id, file: pdfFile });
    }
  };

  const formatCurrency = (value: string | number | null | undefined) => {
    if (!value) return "—";
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (num >= 10000000) {
      return `${(num / 10000000).toFixed(2)} Cr`;
    }
    if (num >= 100000) {
      return `${(num / 100000).toFixed(2)} L`;
    }
    return `${num.toLocaleString('en-IN')}`;
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <AlertCircle className="w-6 h-6 text-amber-500" />
          Unable to Analyse
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          These tenders have missing or unclear eligibility criteria. Upload the tender PDF for detailed analysis.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-full mt-2" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : tenders.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500/50 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">All tenders analyzed</h3>
          <p className="text-sm text-muted-foreground">
            No tenders require manual analysis at this time
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tenders.map((tender) => (
            <Card key={tender.id} className="hover-elevate" data-testid={`card-unable-${tender.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="font-mono text-xs text-muted-foreground">
                      {tender.t247Id}
                    </span>
                    <CardTitle className="text-sm font-semibold mt-1 line-clamp-2">
                      {tender.title || "Untitled Tender"}
                    </CardTitle>
                  </div>
                  <Badge 
                    variant="outline" 
                    className="shrink-0 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                  >
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Needs PDF
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {tender.department && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="w-4 h-4 shrink-0" />
                    <span className="truncate">{tender.department}</span>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <IndianRupee className="w-4 h-4 text-muted-foreground" />
                    <span className="text-foreground font-medium">{formatCurrency(tender.estimatedValue)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-foreground">{formatDate(tender.submissionDeadline)}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-border">
                  <Button 
                    className="w-full" 
                    onClick={() => setSelectedTender(tender)}
                    data-testid={`button-upload-pdf-${tender.id}`}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload PDF
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog 
        open={!!selectedTender} 
        onOpenChange={(open) => {
          if (!open && !uploadPdfMutation.isPending) {
            setSelectedTender(null);
            setPdfFile(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Upload Tender PDF
            </DialogTitle>
            <DialogDescription>
              Upload the tender document for {selectedTender?.t247Id} to extract eligibility criteria
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!pdfFile ? (
              <div
                className={`
                  relative border-2 border-dashed rounded-lg p-8 text-center
                  transition-colors cursor-pointer
                  ${dragActive 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-primary/50'
                  }
                `}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => document.getElementById("pdf-input")?.click()}
                data-testid="dropzone-pdf"
              >
                <input
                  id="pdf-input"
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                  data-testid="input-pdf-upload"
                />
                <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-foreground font-medium mb-1">
                  Drag and drop PDF document
                </p>
                <p className="text-xs text-muted-foreground">
                  or click to browse
                </p>
              </div>
            ) : (
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {pdfFile.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(pdfFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  {!uploadPdfMutation.isPending && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setPdfFile(null)}
                      data-testid="button-remove-pdf"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                {uploadPdfMutation.isPending && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing PDF and extracting criteria...
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setSelectedTender(null);
                  setPdfFile(null);
                }}
                disabled={uploadPdfMutation.isPending}
                data-testid="button-cancel-pdf-upload"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleUpload}
                disabled={!pdfFile || uploadPdfMutation.isPending}
                data-testid="button-submit-pdf-upload"
              >
                {uploadPdfMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload & Analyze
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
