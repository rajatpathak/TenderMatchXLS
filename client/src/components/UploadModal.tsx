import { useState, useCallback, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle,
  X,
  Loader2,
  Clock
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
}

interface ProgressUpdate {
  type: 'progress' | 'complete' | 'error';
  gemCount: number;
  nonGemCount: number;
  failedCount: number;
  totalRows: number;
  currentSheet: string;
  processedRows: number;
  estimatedTimeRemaining: number;
  message?: string;
}

export function UploadModal({ open, onClose }: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

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
        setUploadError(null);
        setUploadComplete(false);
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
      setUploadError(null);
      setUploadComplete(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);
    setProgress(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload-with-progress", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Upload failed");
      }

      const { uploadId } = await response.json();

      eventSourceRef.current = new EventSource(`/api/upload-progress/${uploadId}`);

      eventSourceRef.current.onmessage = (event) => {
        const data: ProgressUpdate = JSON.parse(event.data);
        setProgress(data);

        if (data.type === 'complete') {
          eventSourceRef.current?.close();
          setIsUploading(false);
          setUploadComplete(true);
          toast({
            title: "Upload Successful",
            description: `Processed ${data.gemCount + data.nonGemCount} tenders (${data.gemCount} GEM, ${data.nonGemCount} Non-GEM)${data.failedCount > 0 ? `, ${data.failedCount} failed` : ''}`,
          });
          queryClient.invalidateQueries({ queryKey: ["/api/tenders"] });
          queryClient.invalidateQueries({ queryKey: ["/api/uploads"] });
          queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
        } else if (data.type === 'error') {
          eventSourceRef.current?.close();
          setIsUploading(false);
          setUploadError(data.message || "Processing failed");
        }
      };

      eventSourceRef.current.onerror = () => {
        eventSourceRef.current?.close();
        setIsUploading(false);
        setUploadError("Connection lost during processing");
      };

    } catch (error: any) {
      setIsUploading(false);
      setUploadError(error.message);
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      setFile(null);
      setProgress(null);
      setUploadComplete(false);
      setUploadError(null);
      onClose();
    }
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${Math.ceil(seconds)}s`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.ceil(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const progressPercent = progress && progress.totalRows > 0 
    ? Math.round((progress.processedRows / progress.totalRows) * 100)
    : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Upload Tender Excel
          </DialogTitle>
          <DialogDescription>
            Upload an Excel file with Gem and Non-Gem sheets to analyze tenders
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!file ? (
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
              onClick={() => document.getElementById("file-input")?.click()}
              data-testid="dropzone-excel"
            >
              <input
                id="file-input"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
                data-testid="input-file-upload"
              />
              <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-foreground font-medium mb-1">
                Drag and drop your Excel file
              </p>
              <p className="text-xs text-muted-foreground">
                or click to browse (.xlsx, .xls)
              </p>
            </div>
          ) : (
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                {!isUploading && !uploadComplete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setFile(null)}
                    data-testid="button-remove-file"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {isUploading && progress && (
                <div className="space-y-3 bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">
                      Processing: {progress.currentSheet}
                    </span>
                    <span className="text-foreground font-medium">
                      {progressPercent}%
                    </span>
                  </div>
                  
                  <Progress value={progressPercent} className="h-2" />
                  
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-2 p-2 bg-background rounded">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="text-muted-foreground">GEM:</span>
                      <span className="font-medium text-foreground" data-testid="count-gem">
                        {progress.gemCount}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-background rounded">
                      <div className="w-2 h-2 rounded-full bg-purple-500" />
                      <span className="text-muted-foreground">Non-GEM:</span>
                      <span className="font-medium text-foreground" data-testid="count-non-gem">
                        {progress.nonGemCount}
                      </span>
                    </div>
                  </div>
                  
                  {progress.failedCount > 0 && (
                    <div className="flex items-center gap-2 text-xs p-2 bg-destructive/10 rounded">
                      <AlertCircle className="w-3 h-3 text-destructive" />
                      <span className="text-destructive" data-testid="count-failed">
                        {progress.failedCount} failed to process
                      </span>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>Est. remaining:</span>
                    </div>
                    <span className="font-medium" data-testid="time-remaining">
                      {formatTime(progress.estimatedTimeRemaining)}
                    </span>
                  </div>
                </div>
              )}

              {isUploading && !progress && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Starting upload...</span>
                    <Loader2 className="w-3 h-3 animate-spin" />
                  </div>
                  <Progress value={undefined} className="h-1" />
                </div>
              )}

              {uploadComplete && progress && (
                <div className="space-y-2 bg-emerald-500/10 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="font-medium">Upload Complete!</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">GEM Tenders:</span>
                      <span className="font-medium text-foreground">{progress.gemCount}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Non-GEM:</span>
                      <span className="font-medium text-foreground">{progress.nonGemCount}</span>
                    </div>
                  </div>
                  {progress.failedCount > 0 && (
                    <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                      <AlertCircle className="w-3 h-3" />
                      {progress.failedCount} tenders failed to process
                    </div>
                  )}
                </div>
              )}

              {uploadError && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4" />
                  {uploadError}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={handleClose}
              disabled={isUploading}
              data-testid="button-cancel-upload"
            >
              {uploadComplete ? "Close" : "Cancel"}
            </Button>
            {!uploadComplete && (
              <Button 
                onClick={handleUpload}
                disabled={!file || isUploading}
                data-testid="button-submit-upload"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
