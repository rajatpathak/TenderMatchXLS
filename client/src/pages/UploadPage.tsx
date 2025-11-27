import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle,
  X,
  Loader2,
  ArrowRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useUploadProgress } from "@/hooks/useUploadProgress";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { upload } = useUploadProgress();
  const { startUpload, updateProgress, completeUpload, clearUpload } = useUploadProgress();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      startUpload(file.name);
      updateProgress(5, "Parsing file...");
      
      const formData = new FormData();
      formData.append("file", file);
      
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Upload failed");
      }
      
      const uploadData = await response.json();
      
      // Connect to SSE for real-time progress
      if (uploadData.uploadId) {
        const eventSource = new EventSource(`/api/upload-progress/${uploadData.uploadId}`);
        
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'complete') {
              completeUpload();
              updateProgress(100, "✓ Upload Complete!", {
                newCount: data.newCount,
                duplicateCount: data.duplicateCount,
                corrigendumCount: data.corrigendumCount,
                gemCount: data.gemCount,
                nonGemCount: data.nonGemCount,
              });
              
              const newCount = data.newCount || 0;
              const duplicates = data.duplicateCount || 0;
              const corrigendum = data.corrigendumCount || 0;
              
              toast({
                title: "Upload Complete",
                description: `New: ${newCount} • Duplicates: ${duplicates} • Updates: ${corrigendum}`,
              });
              
              // Keep progress visible for 15 seconds
              setTimeout(() => clearUpload(), 15000);
              
              // Refresh data
              queryClient.invalidateQueries({ queryKey: ["/api/tenders"] });
              queryClient.invalidateQueries({ queryKey: ["/api/uploads"] });
              queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
              setFile(null);
              
              eventSource.close();
            } else if (data.type === 'processing') {
              const percent = data.percentComplete || Math.round((data.processedRows / Math.max(data.totalRows, 1)) * 100);
              updateProgress(Math.min(percent, 99), `Processing (${percent}%)...`, {
                gemCount: data.gemCount,
                nonGemCount: data.nonGemCount,
                newCount: data.newCount,
                duplicateCount: data.duplicateCount,
                corrigendumCount: data.corrigendumCount,
                timeRemaining: data.estimatedTimeRemaining,
              });
            }
          } catch (err) {
            console.error("Error parsing SSE message:", err);
          }
        };
        
        eventSource.onerror = () => {
          eventSource.close();
        };
      }
      
      return uploadData;
    },
    onSuccess: (data) => {
      // Do NOT call completeUpload() here - wait for SSE to finish
      // Just show that upload started
      updateProgress(10, "Processing upload...", {
        gemCount: 0,
        nonGemCount: 0,
        newCount: 0,
        duplicateCount: 0,
        corrigendumCount: 0,
      });
    },
    onError: (error: Error) => {
      clearUpload();
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith(".xlsx") || droppedFile.name.endsWith(".xls")) {
        setFile(droppedFile);
      } else {
        toast({
          title: "Invalid File",
          description: "Please upload an Excel file (.xlsx or .xls)",
          variant: "destructive",
        });
      }
    }
  }, [toast]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Upload className="w-6 h-6" />
          Upload Excel
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload your tender Excel files for automatic analysis
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Tender Excel File
          </CardTitle>
          <CardDescription>
            Upload an Excel file with "Gem" and "Non-Gem" sheets containing tender data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!file ? (
            <div
              className={`
                relative border-2 border-dashed rounded-lg p-12 text-center
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
              onClick={() => document.getElementById("excel-input")?.click()}
              data-testid="dropzone-excel-page"
            >
              <input
                id="excel-input"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
                data-testid="input-excel-page"
              />
              <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-foreground mb-2">
                Drag and drop your Excel file
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                or click to browse
              </p>
              <p className="text-xs text-muted-foreground">
                Supported formats: .xlsx, .xls
              </p>
            </div>
          ) : (
            <div className="border rounded-lg p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileSpreadsheet className="w-7 h-7 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">
                    {file.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                {!uploadMutation.isPending && !uploadMutation.isSuccess && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setFile(null)}
                    data-testid="button-remove-excel"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                )}
              </div>

              {uploadMutation.isPending && upload && (
                <div className="space-y-4">
                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">{upload.message}</span>
                      <span className="font-bold text-primary">{upload.progress}%</span>
                    </div>
                    <Progress value={upload.progress} className="h-3" />
                  </div>

                  {/* Real-time Metrics Grid */}
                  <div className="grid grid-cols-2 gap-3 p-4 rounded-lg bg-muted/50 border">
                    {/* New Entries */}
                    <div className="text-center p-2 rounded-md bg-background">
                      <div className="text-xl font-bold text-green-600 dark:text-green-400">
                        {upload.newCount ?? 0}
                      </div>
                      <div className="text-xs text-muted-foreground">New Entries</div>
                    </div>

                    {/* Duplicates */}
                    <div className="text-center p-2 rounded-md bg-background">
                      <div className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
                        {upload.duplicateCount ?? 0}
                      </div>
                      <div className="text-xs text-muted-foreground">Duplicates</div>
                    </div>

                    {/* Updates */}
                    <div className="text-center p-2 rounded-md bg-background">
                      <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                        {upload.corrigendumCount ?? 0}
                      </div>
                      <div className="text-xs text-muted-foreground">Updates</div>
                    </div>

                    {/* Total Processing */}
                    <div className="text-center p-2 rounded-md bg-background">
                      <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                        {(upload.newCount ?? 0) + (upload.duplicateCount ?? 0) + (upload.corrigendumCount ?? 0)}
                      </div>
                      <div className="text-xs text-muted-foreground">Total</div>
                    </div>

                    {/* GEM Tenders */}
                    <div className="text-center p-2 rounded-md bg-background">
                      <div className="text-lg font-bold text-blue-500">
                        {upload.gemCount ?? 0}
                      </div>
                      <div className="text-xs text-muted-foreground">GEM Tenders</div>
                    </div>

                    {/* Non-GEM Tenders */}
                    <div className="text-center p-2 rounded-md bg-background">
                      <div className="text-lg font-bold text-slate-600 dark:text-slate-400">
                        {upload.nonGemCount ?? 0}
                      </div>
                      <div className="text-xs text-muted-foreground">Non-GEM</div>
                    </div>
                  </div>

                  {/* Status Message */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing... {upload.timeRemaining && `(~${Math.ceil(upload.timeRemaining / 1000)}s remaining)`}</span>
                  </div>
                </div>
              )}

              {uploadMutation.isSuccess && (
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-200 dark:border-emerald-800 p-4">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-2">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-medium">Upload Successful</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="text-center p-2 rounded-md bg-background">
                      <div className="text-2xl font-bold text-foreground">{uploadMutation.data?.totalTenders || 0}</div>
                      <div className="text-xs text-muted-foreground">Total Tenders</div>
                    </div>
                    <div className="text-center p-2 rounded-md bg-background">
                      <div className="text-2xl font-bold text-blue-600">{uploadMutation.data?.gemCount || 0}</div>
                      <div className="text-xs text-muted-foreground">GEM</div>
                    </div>
                    <div className="text-center p-2 rounded-md bg-background">
                      <div className="text-2xl font-bold text-slate-600">{uploadMutation.data?.nonGemCount || 0}</div>
                      <div className="text-xs text-muted-foreground">Non-GEM</div>
                    </div>
                  </div>
                  <Button 
                    className="w-full mt-4"
                    onClick={() => setLocation("/")}
                    data-testid="button-view-dashboard"
                  >
                    View Dashboard
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              )}

              {uploadMutation.isError && (
                <div className="rounded-lg bg-red-500/10 border border-red-200 dark:border-red-800 p-4">
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                    <AlertCircle className="w-5 h-5" />
                    <span className="font-medium">Upload Failed</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {uploadMutation.error?.message || "Something went wrong"}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3">
            {file && !uploadMutation.isSuccess && (
              <Button 
                onClick={handleUpload}
                disabled={uploadMutation.isPending}
                size="lg"
                data-testid="button-upload-submit"
              >
                {uploadMutation.isPending ? (
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
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Expected File Format</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>Your Excel file should contain:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>A sheet named <span className="font-mono text-foreground">"Gem"</span> for GEM portal tenders</li>
              <li>A sheet named <span className="font-mono text-foreground">"Non-Gem"</span> for other tenders</li>
            </ul>
            <p>Each sheet should include columns for:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>T247 ID (unique tender identifier)</li>
              <li>Tender Title</li>
              <li>Department/Organization</li>
              <li>Estimated Value / Budget</li>
              <li>EMD Amount</li>
              <li>Eligibility Criteria</li>
              <li>Submission Deadline</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
