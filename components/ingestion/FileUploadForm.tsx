// /components/ingestion/FileUploadForm.tsx
"use client";

import React, { useState, useCallback, ChangeEvent, useRef, DragEvent } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Upload, File as FileIcon, X, Loader2, CheckCircle, AlertCircle, Info, ListChecks, Ban } from 'lucide-react'; // Added Ban icon
import { cn } from "@/lib/utils"; // Import cn utility

// --- Types ---
interface FileResult {
    fileName: string;
    status: 'success' | 'skipped_size' | 'skipped_type' | 'skipped_no_content' | 'failed_extraction' | 'failed_chunking' | 'failed_embedding' | 'failed_processing';
    error?: string;
    chunks?: number;
}

interface UploadApiResponse {
    message: string;
    insertedChunks?: number;
    summary?: FileResult[];
    error?: string;
    details?: any;
}

type UploadStatus = "idle" | "validating" | "uploading" | "success" | "error" | "partial_error";

// State for individual files, including validity
interface FileState {
    id: string; // Unique ID for React key prop
    file: File;
    isValid: boolean;
    error?: string; // Reason for invalidity
}

// --- Constants ---
const MAX_FILE_SIZE_MB = 15;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const SUPPORTED_EXTENSIONS = ['pdf', 'docx', 'txt', 'md'];

const FileUploadForm = () => {
  const [projectName, setProjectName] = useState<string>("");
  // **CHANGED**: Use FileState array
  const [filesToUpload, setFilesToUpload] = useState<FileState[]>([]);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadResults, setUploadResults] = useState<FileResult[] | null>(null);
  // State for drag-over visual feedback
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- File Validation Logic ---
  const validateFile = (file: File): { isValid: boolean; error?: string } => {
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return { isValid: false, error: `Exceeds ${MAX_FILE_SIZE_MB}MB limit` };
    }
    if (!SUPPORTED_EXTENSIONS.includes(extension)) {
      return { isValid: false, error: `Unsupported type (${extension || 'N/A'})` };
    }
    return { isValid: true };
  };

  // --- Process Selected/Dropped Files ---
  const processFiles = (newFiles: FileList | File[]) => {
    setUploadStatus("idle"); // Reset status on new selection/drop
    setUploadMessage(null);
    setUploadError(null);
    setUploadResults(null);

    const newFileStates: FileState[] = Array.from(newFiles).map(file => {
        const { isValid, error } = validateFile(file);
        return { id: `${file.name}-${file.lastModified}-${file.size}`, file, isValid, error }; // Create a unique-ish ID
    });

    // Avoid duplicates based on the generated ID
    setFilesToUpload(prev => {
        const combined = [...prev, ...newFileStates];
        const uniqueMap = new Map<string, FileState>();
        combined.forEach(fs => uniqueMap.set(fs.id, fs));
        return Array.from(uniqueMap.values());
    });
  };

  // --- Event Handlers ---
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      processFiles(event.target.files);
      // Optional: Clear the input value after processing so the same file can be selected again
      // event.target.value = "";
    }
  };

  const handleClearSelection = () => {
      setFilesToUpload([]);
      if (fileInputRef.current) {
          fileInputRef.current.value = ""; // Clear the actual input element
      }
  };

  // Drag and Drop Handlers
  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDraggingOver(true);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault(); // Necessary to allow drop
      setIsDraggingOver(true); // Keep active while over
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDraggingOver(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDraggingOver(false);
      if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {

          processFiles(event.dataTransfer.files);
          event.dataTransfer.clearData(); // Clean up
      }
  };

  const handleUpload = useCallback(async () => {
    // --- 1. Filter for Valid Files ---
    const validFiles = filesToUpload.filter(fs => fs.isValid);

    if (validFiles.length === 0) {
      setUploadError("No valid files selected for upload.");
      setUploadStatus("error");
      return;
    }
    if (!projectName.trim()) {
      setUploadError("Please enter a project name.");
      setUploadStatus("error");
      return;
    }

    // --- 2. Reset State & Prepare FormData ---
    setUploadStatus("uploading");
    setUploadMessage(`Preparing ${validFiles.length} valid file(s) for upload...`);
    setUploadError(null);
    setUploadResults(null);

    const formData = new FormData();
    formData.append('projectName', projectName.trim());
    validFiles.forEach(fileState => {
      formData.append('files', fileState.file); // Only append valid files
    });

    // --- 3. API Call ---
    try {
      setUploadMessage(`Uploading ${validFiles.length} file(s)...`);
      const response = await fetch('/api/uploadDocuments', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json() as UploadApiResponse;

      if (!response.ok) {
          if (response.status === 400 && result.details) {
              const errorDetails = Object.entries(result.details)
                 .map(([field, errors]) => `${field}: ${(errors as string[]).join(', ')}`)
                 .join('; ');
              throw new Error(result.error ? `${result.error} (${errorDetails})` : `Validation Error: ${errorDetails}`);
          }
          throw new Error(result.error || `Upload failed with status ${response.status}`);
      }

      // --- 4. Process Success Response ---
      setUploadStatus("success");
      setUploadMessage(result.message || "Files processed successfully.");
      setUploadResults(result.summary || null);
      // Clear only the uploaded files after success, keep invalid ones listed? Or clear all?
      // Option: Clear all
      handleClearSelection();
      // Option: Clear only valid ones (more complex state update)
      // setFilesToUpload(prev => prev.filter(fs => !fs.isValid));

    } catch (error: any) {
      // --- 5. Handle Errors ---

      setUploadStatus("error");
      setUploadError(error.message || "An unknown error occurred during upload.");
      setUploadMessage(null);
      setUploadResults(null);
    }
  }, [projectName, filesToUpload]);

  // Calculate count of valid files for upload button logic
  const validFileCount = filesToUpload.filter(fs => fs.isValid).length;
  const canUpload = validFileCount > 0 && projectName.trim() !== "" && uploadStatus !== "uploading";

  return (
    <div className="space-y-6">
      {/* Configuration Area (No Changes) */}
      <div className="space-y-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 shadow-sm">
        {/* ... Project Name Input ... */}
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
          Upload Configuration
        </h3>
        <div className="space-y-2">
          <Label htmlFor="projectName" className="text-gray-700 dark:text-gray-300 font-medium">Project Name</Label>
          <Input
            id="projectName"
            placeholder="e.g., Product Manuals Q3"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            disabled={uploadStatus === "uploading"}
            className="border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-indigo-500 focus:border-indigo-500"
            aria-describedby="projectNameHelp"
          />
          <p id="projectNameHelp" className="text-xs text-gray-500 dark:text-gray-400">
            Helps categorize the uploaded documents.
          </p>
        </div>
      </div>

      {/* File Selection & Drop Zone Area */}
      <div className="space-y-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 shadow-sm">
        <Label htmlFor="fileUpload" className="text-gray-700 dark:text-gray-300 font-medium mb-2 block">Select or Drop Files</Label>
        {/* **CHANGED**: Added Drop Zone Div */}
        <div
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
                "relative flex flex-col items-center justify-center w-full p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-200 ease-in-out",
                "border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500",
                "bg-white/50 dark:bg-gray-900/20 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/30",
                isDraggingOver && "border-indigo-500 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-900/50 ring-2 ring-indigo-300 dark:ring-indigo-600",
                (uploadStatus === "uploading") && "cursor-not-allowed opacity-70"
            )}
            // Wrap input in label for better accessibility click area
            onClick={() => ! (uploadStatus === "uploading") && fileInputRef.current?.click()}
        >
             {/* Visually hidden input, triggered by click on parent */}
             <input
                id="fileUpload"
                type="file"
                multiple
                ref={fileInputRef}
                onChange={handleFileChange}
                disabled={uploadStatus === "uploading"}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" // Hide visually but keep functional
                accept=".pdf,.docx,.txt,.md"
            />
            <div className="text-center pointer-events-none"> {/* Prevent text blocking drop */}
                <Upload className={cn(
                    "mx-auto h-10 w-10 mb-3",
                    isDraggingOver ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400 dark:text-gray-500"
                    )} />
                <p className={cn(
                    "text-sm font-medium",
                     isDraggingOver ? "text-indigo-700 dark:text-indigo-300" : "text-gray-600 dark:text-gray-400"
                     )}>
                   {isDraggingOver ? 'Drop files here!' : 'Drag & drop files here or click to select'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    Supported: PDF, DOCX, TXT, MD (Max {MAX_FILE_SIZE_MB}MB)
                </p>
            </div>
        </div>

        {/* Selected Files Display */}
        {/* **CHANGED**: Iterate over filesToUpload */}
        {filesToUpload.length > 0 && (
          <div className="space-y-3 pt-3">
            <div className="flex justify-between items-center">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Files Queued ({filesToUpload.length}) - {validFileCount} valid for upload
                </h4>
                 <Button variant="outline" size="xs" onClick={handleClearSelection} disabled={uploadStatus === 'uploading'}>
                     <X className="h-3 w-3 mr-1" /> Clear All
                 </Button>
            </div>

            <ScrollArea className="h-32 w-full rounded-md border border-gray-200 dark:border-gray-700 p-2 bg-white dark:bg-gray-900/30">
              <ul className="space-y-1">
                {/* **CHANGED**: Render based on FileState */}
                {filesToUpload.map((fileState) => (
                  <li key={fileState.id} className={cn(
                      "flex items-center justify-between text-xs p-1.5 rounded",
                      !fileState.isValid && "bg-destructive/10 dark:bg-destructive/20"
                  )}>
                    <div className="flex items-center space-x-2 truncate">
                      <FileIcon className={cn(
                          "h-4 w-4 shrink-0",
                          fileState.isValid ? "text-gray-500 dark:text-gray-400" : "text-destructive/80 dark:text-destructive/90"
                       )} />
                      <span className={cn(
                          "truncate",
                          fileState.isValid ? "text-gray-700 dark:text-gray-300" : "text-destructive dark:text-destructive/90"
                      )} title={fileState.file.name}>{fileState.file.name}</span>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0 ml-2">
                         {/* Show error tooltip for invalid files */}
                         {!fileState.isValid && fileState.error && (
                            <TooltipProvider delayDuration={100}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Badge variant="destructive" className="cursor-help text-xs">Invalid</Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>{fileState.error}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                         )}
                         <span className={cn(
                             "text-gray-500 dark:text-gray-400 text-xs",
                             !fileState.isValid && "line-through"
                             )}>
                          {(fileState.file.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </div>
        )}

        {/* Upload Button */}
        {/* **CHANGED**: Update button text/disabled logic */}
        <div className="pt-4 flex justify-end">
            <TooltipProvider>
                <Tooltip delayDuration={100}>
                    <TooltipTrigger asChild>
                         <div> {/* Wrapper for tooltip when disabled */}
                             <Button
                               type="button"
                               onClick={handleUpload}
                               disabled={!canUpload} // Use canUpload derived state
                               className="bg-indigo-600 hover:bg-indigo-700 text-white"
                             >
                               {uploadStatus === "uploading" ? (
                                 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                               ) : (
                                 <Upload className="mr-2 h-4 w-4" />
                               )}
                               {uploadStatus === "uploading" ? "Uploading..." : `Upload ${validFileCount} Valid File(s)`}
                             </Button>
                         </div>
                    </TooltipTrigger>
                    {!canUpload && filesToUpload.length > 0 && (
                        <TooltipContent>
                            <p>{projectName.trim() === "" ? "Project name required. " : ""} No valid files selected.</p>
                        </TooltipContent>
                    )}
                     {!canUpload && filesToUpload.length === 0 && (
                        <TooltipContent>
                            <p>Please select files and enter a project name.</p>
                        </TooltipContent>
                    )}
                </Tooltip>
            </TooltipProvider>
        </div>
      </div>

      {/* Status & Results Area (No Changes Needed Here) */}
      {/* ... Alerts and Results Summary ... */}
        <div className="space-y-4">
            {/* General Status Messages */}
            {uploadStatus === "success" && uploadMessage && (
            <Alert variant="success" className="transition-opacity duration-300">
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Upload Successful</AlertTitle>
                <AlertDescription>{uploadMessage}</AlertDescription>
            </Alert>
            )}
            {uploadStatus === "error" && uploadError && (
            <Alert variant="destructive" className="transition-opacity duration-300">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Upload Failed</AlertTitle>
                <AlertDescription>{uploadError}</AlertDescription>
            </Alert>
            )}
            {/* Intermediate Uploading Message */}
            {uploadStatus === "uploading" && uploadMessage && (
                <Alert variant="default" className="transition-opacity duration-300 border-blue-300 dark:border-blue-700">
                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <AlertTitle>Processing Upload</AlertTitle>
                    <AlertDescription>{uploadMessage}</AlertDescription>
                </Alert>
            )}

            {/* Detailed Results Summary */}
            {uploadResults && uploadResults.length > 0 && (
            <div className="space-y-3 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 shadow-sm">
                <h3 className="text-md font-semibold text-gray-800 dark:text-gray-100 flex items-center">
                <ListChecks className="h-5 w-5 mr-2 text-indigo-600 dark:text-indigo-400" />
                File Processing Summary
                </h3>
                <ScrollArea className="h-40 w-full">
                    <ul className="space-y-2 pr-3">
                        {uploadResults.map((result, index) => (
                        <li key={index} className="flex items-center justify-between text-sm p-2 rounded bg-white dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700/50">
                            <div className="flex items-center space-x-2 truncate">
                            {result.status === 'success' && <CheckCircle className="h-4 w-4 shrink-0 text-green-600 dark:text-green-500" />}
                            {(result.status.startsWith('skipped') || result.status === 'failed_extraction' || result.status === 'failed_processing') && <AlertCircle className="h-4 w-4 shrink-0 text-yellow-600 dark:text-yellow-500" />}
                            {result.status.startsWith('failed_') && !result.status.includes('extraction') && !result.status.includes('processing') && <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-500" />}

                            <span className="truncate text-gray-700 dark:text-gray-300" title={result.fileName}>{result.fileName}</span>
                            </div>
                            <div className='flex items-center space-x-2'>
                                {result.chunks !== undefined && (
                                    <Badge variant="secondary" className="text-xs whitespace-nowrap">
                                        {result.chunks} chunks
                                    </Badge>
                                )}
                                <Badge variant={
                                    result.status === 'success' ? 'success' :
                                    result.status.startsWith('skipped') ? 'warning' :
                                    'destructive'
                                } className="text-xs capitalize whitespace-nowrap">
                                    {result.status.replace(/_/g, ' ')}
                                </Badge>
                                {result.error && (
                                    <TooltipProvider>
                                        <Tooltip delayDuration={100}>
                                            <TooltipTrigger>
                                                <Info className="h-4 w-4 text-muted-foreground hover:text-foreground cursor-help" />
                                            </TooltipTrigger>
                                            <TooltipContent className='max-w-xs'>
                                                <p>{result.error}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                )}
                            </div>
                        </li>
                        ))}
                    </ul>
                </ScrollArea>
            </div>
            )}
      </div>
    </div>
  );
};

export default FileUploadForm;