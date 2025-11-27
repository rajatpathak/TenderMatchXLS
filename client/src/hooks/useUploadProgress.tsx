import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface UploadProgress {
  fileName: string;
  isUploading: boolean;
  progress: number;
  message: string;
  duplicates?: number;
  added?: number;
}

interface UploadProgressContextType {
  upload: UploadProgress | null;
  startUpload: (fileName: string) => void;
  updateProgress: (progress: number, message: string, duplicates?: number, added?: number) => void;
  completeUpload: () => void;
  clearUpload: () => void;
}

const UploadProgressContext = createContext<UploadProgressContextType | undefined>(undefined);

export function UploadProgressProvider({ children }: { children: ReactNode }): JSX.Element {
  const [upload, setUpload] = useState<UploadProgress | null>(null);

  const startUpload = useCallback((fileName: string) => {
    setUpload({
      fileName,
      isUploading: true,
      progress: 0,
      message: "Initializing...",
    });
  }, []);

  const updateProgress = useCallback((progress: number, message: string, duplicates?: number, added?: number) => {
    setUpload((prev) => (prev ? { ...prev, progress: Math.min(progress, 99), message, duplicates, added } : null));
  }, []);

  const completeUpload = useCallback(() => {
    setUpload((prev) => (prev ? { ...prev, progress: 100, isUploading: false, message: "Complete" } : null));
  }, []);

  const clearUpload = useCallback(() => {
    setUpload(null);
  }, []);

  return (
    <UploadProgressContext.Provider value={{ upload, startUpload, updateProgress, completeUpload, clearUpload }}>
      {children}
    </UploadProgressContext.Provider>
  );
}

export function useUploadProgress() {
  const context = useContext(UploadProgressContext);
  if (!context) throw new Error("useUploadProgress must be used within UploadProgressProvider");
  return context;
}
