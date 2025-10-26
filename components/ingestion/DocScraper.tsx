// /components/ingestion/DocScraper.tsx
"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProgressEnhanced } from "@/components/ui/progress-enhanced";
import { ControlButton } from "@/components/ui/control-button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { TooltipProvider } from "@/components/ui/tooltip"; // Root provider
import { DocTooltip } from "@/components/ui/doc-tooltip"; // Your custom tooltip component
import { CheckCircle2, AlertCircle, Info, SearchCheck, History, RefreshCw, XCircle, ListChecks } from "lucide-react";

import { processSelectedPages, ProcessStatusType } from "@/components/ingestion/processSelectedPages";
import { createClient } from "@/utils/supabase/client"; // Ensure this path is correct
import { SupabaseClient } from "@supabase/supabase-js"; // Import type
import { Database } from "@/lib/database.types";
import {
  DiscoveryStatus,
  ProcessStatusType as LibProcessStatusType,
  ProcessingStatus,
  PageResult,
  SseMessage
} from "@/lib/types";

// --- Constants ---
const AUTO_PROCESS_BATCH_SIZE = 10; // Process URLs in batches of 10
const AUTO_PROCESS_BATCH_DELAY = 3000; // Send batch every 3 seconds if needed

const DocScraper = () => {
  const [baseUrl, setBaseUrl] = useState<string>("");
  const [siteName, setSiteName] = useState<string>("");
  const [discoveredUrls, setDiscoveredUrls] = useState<PageResult[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<Set<number>>(new Set());
  const [discoveryProgress, setDiscoveryProgress] = useState<number>(0);
  const [processProgress, setProcessProgress] = useState<number>(0);
  const [discoveryError, setDiscoveryError] = useState<string>("");
  const [processingError, setProcessingError] = useState<string>("");
  const [discoveryStatus, setDiscoveryStatus] = useState<DiscoveryStatus>("idle");
  const [processStatus, setProcessStatus] = useState<ProcessingStatus>("idle");
  const [infoMessage, setInfoMessage] = useState<string>("");
  const [autoProcess, setAutoProcess] = useState<boolean>(false);
  const [skippedUrlCount, setSkippedUrlCount] = useState<number>(0); // URLs skipped due to already existing in DB
  const [isDiscovering, setIsDiscovering] = useState<boolean>(false); // Added missing state

  // Refs for managing async operations and state without causing re-renders
  const eventSourceRef = useRef<EventSource | null>(null);
  const processIntervalRef = useRef<NodeJS.Timeout | null>(null); // For manual processing progress simulation
  const autoProcessQueueRef = useRef<string[]>([]); // Queue for URLs to auto-process
  const autoProcessBatchTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Timer for sending auto-process batches
  const isAutoProcessingBatchRef = useRef<boolean>(false); // Flag to prevent concurrent batch sends
  const checkedUrlsCacheRef = useRef<Set<string>>(new Set()); // Cache URLs checked against DB in this session
  const nextIdRef = useRef<number>(1); // Simple incrementing ID for discovered URLs list items
  const totalDiscoveredCountRef = useRef<number>(0); // Estimated total from 'done' event

  // Memoize Supabase client creation
  const supabase = useMemo<SupabaseClient<Database> | null>(() => {
     try {
         return createClient(); // Use your client-side factory
     } catch (error) {

         setProcessingError("Configuration Error: Cannot connect to database.");
         return null;
     }
  }, []);

  // --- Cleanup Logic ---
  useEffect(() => {
    // This runs when the component unmounts
    return () => {

      if (eventSourceRef.current) {

        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (processIntervalRef.current) {

        clearInterval(processIntervalRef.current);
        processIntervalRef.current = null;
      }
      if (autoProcessBatchTimeoutRef.current) {

        clearTimeout(autoProcessBatchTimeoutRef.current);
        autoProcessBatchTimeoutRef.current = null;
      }
      // Reset refs associated with active processes
      isAutoProcessingBatchRef.current = false;
      autoProcessQueueRef.current = [];
    };
  }, []); // Empty dependency array ensures this runs only on mount and unmount

  // --- Auto-Process Batch Sending Logic ---
  const sendAutoProcessBatch = useCallback(async () => {
    if (isAutoProcessingBatchRef.current || autoProcessQueueRef.current.length === 0 || !siteName || !baseUrl) {
        if (isAutoProcessingBatchRef.current) console.log("Auto-Process Batch: Send skipped, already in progress.");
        return;
    }

    isAutoProcessingBatchRef.current = true;
    const batchToSend = [...autoProcessQueueRef.current];
    autoProcessQueueRef.current = []; // Clear queue immediately


    setInfoMessage(`Auto-processing batch of ${batchToSend.length}...`);

    try {
        const response = await fetch("/api/scrapeDocsWithPuppeteer", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({ urls: batchToSend, siteName, baseUrl }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: `Server error: ${response.status}` }));
            throw new Error(errorData.error || errorData.details || `Batch processing failed with status ${response.status}`);
        }

        const result = await response.json();

        // You could update a counter for total auto-processed URLs here if needed
        setInfoMessage(`Auto-processed batch. Stored: ${result.summary?.stored ?? 'N/A'}.`);

    } catch (error) {

        setProcessingError(`Auto-process batch failed: ${error instanceof Error ? error.message : "Unknown error"}`);
        // Optional: Add failed URLs back to the queue for retry? (Could lead to loops)
    } finally {
        isAutoProcessingBatchRef.current = false;
        // If queue still has items, schedule next batch immediately
        if (autoProcessQueueRef.current.length > 0) {
             if (autoProcessBatchTimeoutRef.current) clearTimeout(autoProcessBatchTimeoutRef.current);
             autoProcessBatchTimeoutRef.current = setTimeout(sendAutoProcessBatch, 100); // Short delay before next batch
        } else {
             autoProcessBatchTimeoutRef.current = null; // No more items, clear timer
        }
    }
  }, [siteName, baseUrl]);

  // --- Queueing and DB Check Logic for Auto-Process ---
  const queueUrlForAutoProcessing = useCallback(async (url: string) => {
    if (!autoProcess || !supabase) {
        if (!supabase) console.warn("Auto-Process: Supabase client not available for DB check.");
        return; // Skip if auto-process disabled or no DB client
    }

    // 1. Check local cache first
    if (checkedUrlsCacheRef.current.has(url)) {
        return;
    }

    // 2. Check database
    try {
        const { error: checkError, count: existingCount } = await supabase
            .from("nextjs_store")
            .select("id", { count: "exact", head: true })
            .eq("metadata->>url", url);

        checkedUrlsCacheRef.current.add(url);

        if (checkError) {

            setProcessingError(`Error checking URL ${url} in DB: ${checkError.message}`);
            return;
        }

        if (existingCount && existingCount > 0) {
            setSkippedUrlCount((prev) => prev + 1);
            return;
        }


        autoProcessQueueRef.current.push(url);
        setInfoMessage(`Queued: ${url.split('/').pop()} (${autoProcessQueueRef.current.length} in queue)`);

        if (!isAutoProcessingBatchRef.current) {
            if (autoProcessQueueRef.current.length >= AUTO_PROCESS_BATCH_SIZE) {
                if (autoProcessBatchTimeoutRef.current) clearTimeout(autoProcessBatchTimeoutRef.current);

                sendAutoProcessBatch();
            } else if (!autoProcessBatchTimeoutRef.current) {

                autoProcessBatchTimeoutRef.current = setTimeout(sendAutoProcessBatch, AUTO_PROCESS_BATCH_DELAY);
            }
        }

    } catch (error) {

        setProcessingError(`Failed queueing ${url}: ${error instanceof Error ? error.message : "Unknown error"}`);
        checkedUrlsCacheRef.current.add(url);
    }
  }, [autoProcess, supabase, sendAutoProcessBatch]);

  // --- Discovery Handling (SSE) ---
  const handleDiscover = useCallback(() => {
    if (!baseUrl || !siteName) {
      setDiscoveryError("Please enter Base URL and Site Name.");
      return;
    }


    // Reset states
    setDiscoveryError("");
    setProcessingError("");
    setInfoMessage("Initializing discovery...");
    setDiscoveredUrls([]);
    setSelectedUrls(new Set());
    setDiscoveryProgress(0);
    setIsDiscovering(true);
    setDiscoveryStatus("active");
    setProcessStatus("idle");
    setProcessProgress(0);
    autoProcessQueueRef.current = [];
    checkedUrlsCacheRef.current = new Set();
    setSkippedUrlCount(0);
    nextIdRef.current = 1;
    totalDiscoveredCountRef.current = 0;
    if (autoProcessBatchTimeoutRef.current) clearTimeout(autoProcessBatchTimeoutRef.current);
    autoProcessBatchTimeoutRef.current = null;
    isAutoProcessingBatchRef.current = false;

    if (eventSourceRef.current) {

      eventSourceRef.current.close();
    }

    const apiUrl = `/api/scrapeDocsWithPuppeteer?baseUrl=${encodeURIComponent(baseUrl)}`;

    const eventSource = new EventSource(apiUrl);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {

      setInfoMessage("Discovering URLs...");
      setDiscoveryStatus("active");
      setIsDiscovering(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const message: SseMessage = JSON.parse(event.data);

        switch (message.type) {
          case "url":
            if (message.data?.url) {
              const newUrl = message.data.url;
              setDiscoveredUrls((prev) => {
                  if (prev.some(item => item.url === newUrl)) {
                      return prev;
                  }
                  const newEntry = { id: nextIdRef.current++, url: newUrl };
                  const newList = [...prev, newEntry];

                  const currentCount = newList.length;
                  if (totalDiscoveredCountRef.current > 0) {
                    setDiscoveryProgress(
                      Math.min(100, (currentCount / totalDiscoveredCountRef.current) * 100)
                    );
                  } else {
                    setDiscoveryProgress((prevProg) => Math.min(99, prevProg + 0.05));
                  }
                  queueUrlForAutoProcessing(newUrl);

                  return newList;
              });
            }
            break;
          case "info":
            if (message.message && !infoMessage.includes('Auto-processing') && !infoMessage.includes('Queued:') && !infoMessage.includes('Checking DB:')) {
                setInfoMessage(message.message);
            }
            break;
          case "error":

            setDiscoveryError(message.message || "Unknown error during discovery.");
            setDiscoveryStatus("error");
            setIsDiscovering(false);
            if (eventSourceRef.current) eventSourceRef.current.close();
            eventSourceRef.current = null;
            break;
          case "done":
            const finalCount = typeof message.data?.count === "number" ? message.data.count : -1;

            totalDiscoveredCountRef.current = finalCount >= 0 ? finalCount : discoveredUrls.length;

            if (autoProcessQueueRef.current.length > 0) {

                 if (autoProcessBatchTimeoutRef.current) clearTimeout(autoProcessBatchTimeoutRef.current);
                 sendAutoProcessBatch();
            }

            setDiscoveredUrls((currentUrls) => {
                const actualCount = currentUrls.length;
                setInfoMessage(
                    `Discovery finished. Found ${actualCount} URLs.` +
                    (autoProcess ? ` Skipped ${skippedUrlCount} existing.` : '') +
                    (finalCount >= 0 && finalCount !== actualCount ? ` (Server expected ${finalCount})` : '')
                );
                setDiscoveryProgress(100);
                return currentUrls;
            });

            setIsDiscovering(false);
            setDiscoveryStatus("completed");
            if (eventSourceRef.current) eventSourceRef.current.close();
            eventSourceRef.current = null;
            break;
          default:

            break;
        }
      } catch (error) {

      }
    };

    eventSource.onerror = (err) => {

      if (eventSource.readyState === EventSource.CLOSED) {

          if (discoveryStatus === "active") {
              setDiscoveryError("Connection lost during discovery. Please check server logs.");
              setDiscoveryStatus("error");
          } else if (discoveryStatus === "stopping") {
              setDiscoveryStatus("stopped");
          }
           setIsDiscovering(false);
           eventSourceRef.current = null;
           if (autoProcessBatchTimeoutRef.current) clearTimeout(autoProcessBatchTimeoutRef.current);
           autoProcessBatchTimeoutRef.current = null;
           isAutoProcessingBatchRef.current = false;
      } else {
           setDiscoveryError("Network error during discovery. Retrying...");
           setDiscoveryStatus("error");
      }
    };
  }, [baseUrl, siteName, autoProcess, skippedUrlCount, infoMessage, queueUrlForAutoProcessing, sendAutoProcessBatch]);

  // --- Control Actions ---

  const handlePause = () => {
    if (discoveryStatus === "active") {

      setDiscoveryStatus("paused");
      setInfoMessage("Discovery paused.");
      setIsDiscovering(false);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (autoProcessBatchTimeoutRef.current) {
          clearTimeout(autoProcessBatchTimeoutRef.current);
          autoProcessBatchTimeoutRef.current = null;

      }
    } else {

    }
  };

  const handleStop = () => {
    let stoppedSomething = false;


    if (discoveryStatus === "active" || discoveryStatus === "paused") {

      setDiscoveryStatus("stopping");
      setIsDiscovering(false);
      setInfoMessage("Stopping discovery...");
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      autoProcessQueueRef.current = [];
      if (autoProcessBatchTimeoutRef.current) clearTimeout(autoProcessBatchTimeoutRef.current);
      autoProcessBatchTimeoutRef.current = null;
      isAutoProcessingBatchRef.current = false;

      setTimeout(() => {
          setDiscoveryStatus((prevStatus) => {
              if (prevStatus === "stopping") {
                  setInfoMessage("Discovery stopped.");

                  return "stopped";
              }
              return prevStatus;
          });
      }, 200);
      stoppedSomething = true;
    }

    if (["starting", "processing", "paused"].includes(processStatus)) {

      setProcessStatus("stopped");
      if (processIntervalRef.current) {
        clearInterval(processIntervalRef.current);
        processIntervalRef.current = null;
      }
      setInfoMessage("Manual processing stopped.");
      stoppedSomething = true;
    }

    if (stoppedSomething) {
        setDiscoveryError("");
        setProcessingError("");
    } else {

    }
  };

  const handleResume = () => {
    if (discoveryStatus === "paused") {

      setDiscoveryStatus("idle");
      handleDiscover();
    } else if (processStatus === "paused") {
        setInfoMessage("Processing resume not supported. Stop and start manual process again.");
    } else {

    }
  };

  const handleReset = () => {

      handleStop();
      setBaseUrl("");
      setSiteName("");
      setDiscoveredUrls([]);
      setSelectedUrls(new Set());
      setDiscoveryProgress(0);
      setProcessProgress(0);
      setDiscoveryError("");
      setProcessingError("");
      setDiscoveryStatus("idle");
      setProcessStatus("idle");
      setInfoMessage("");
      setIsDiscovering(false);
      setAutoProcess(false);
      autoProcessQueueRef.current = [];
      checkedUrlsCacheRef.current = new Set();
      setSkippedUrlCount(0);
      nextIdRef.current = 1;
      totalDiscoveredCountRef.current = 0;
       if (autoProcessBatchTimeoutRef.current) clearTimeout(autoProcessBatchTimeoutRef.current);
       autoProcessBatchTimeoutRef.current = null;
       isAutoProcessingBatchRef.current = false;
  };

  const handleToggleUrl = (pageId: number) => {
    setSelectedUrls((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(pageId)) {
        newSet.delete(pageId);
      } else {
        newSet.add(pageId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => setSelectedUrls(new Set(discoveredUrls.map((p) => p.id)));
  const handleSelectNone = () => setSelectedUrls(new Set());

  const getSelectionRatio = () => {
    if (discoveredUrls.length === 0) return 0;
    return (selectedUrls.size / discoveredUrls.length) * 100;
  };

  // --- Manual Processing Trigger ---
  const handleProcessSelectedPages = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUrls.size === 0) {
      setProcessingError("Select URLs first.");
      return;
    }
    if (!baseUrl || !siteName) {
        setProcessingError("Base URL and Site Name must be set.");
        return;
    }

    setProcessingError("");
    setInfoMessage(`Starting manual processing of ${selectedUrls.size} URLs...`);
    setProcessStatus("starting");
    setProcessProgress(0);
    if (processIntervalRef.current) clearInterval(processIntervalRef.current);

    const urlsToProcess = discoveredUrls
      .filter((p) => selectedUrls.has(p.id))
      .map((p) => p.url);

    processSelectedPages({
      urls: urlsToProcess,
      baseUrl,
      siteName,
      onProgressUpdate: setProcessProgress,
      onStatusUpdate: (newStatus) => {
        setProcessStatus(newStatus);
        if (newStatus === "completed") {
          setInfoMessage(`Manual processing completed for ${urlsToProcess.length} URLs.`);
        } else if (newStatus === 'error') {
           setInfoMessage("Manual processing failed.");
        }
      },
      onMessageUpdate: (message) => {
         if (message) setInfoMessage(message);
      },
      onErrorUpdate: (error) => {
         if (error) setProcessingError(error);
      },
      processIntervalRef,
      onResultsUpdate: (results) => {

      }
    });
  };

  // --- Derived States for Button Disablement ---
  const isDiscoveringActive = discoveryStatus === "active";
  const isProcessingActive = ["starting", "processing"].includes(processStatus);
  const canStartDiscovery = !isDiscoveringActive && discoveryStatus !== "paused" && !!baseUrl.trim() && !!siteName.trim();
  const canPauseDiscovery = isDiscoveringActive;
  const canStop = isDiscoveringActive || discoveryStatus === "paused" || isProcessingActive || processStatus === "paused";
  const canResumeDiscovery = discoveryStatus === "paused";
  const canProcessSelection = selectedUrls.size > 0 && !isDiscoveringActive && !isProcessingActive && !!baseUrl.trim() && !!siteName.trim();
  const canReset = !isDiscoveringActive && !isProcessingActive;

  // --- Icon Mapping for Info/Error Alerts ---
  const getAlertIcon = (msg?: string | null, isError = false): React.ReactNode => {
      if (isError) return <AlertCircle className="h-4 w-4" />;
      if (!msg) return <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />;

      if (msg.startsWith("Auto-processing batch")) return <RefreshCw className="h-4 w-4 text-indigo-600 dark:text-indigo-400 animate-spin" />;
      if (msg.startsWith("Queued:")) return <ListChecks className="h-4 w-4 text-purple-600 dark:text-purple-400" />;
      if (msg.startsWith("Checking DB:")) return <SearchCheck className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />;
      if (msg.startsWith("Skipped existing:")) return <History className="h-4 w-4 text-gray-600 dark:text-gray-400" />;
      if (msg.startsWith("Discovery finished") || msg.startsWith("Manual processing completed")) return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />;
      if (msg.startsWith("Stopping") || msg.includes("stopped")) return <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />;

      return <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
   };

   const getAlertVariant = (msg?: string | null, isError = false): "default" | "destructive" => {
       if (isError) return "destructive";
       return "default";
   };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Configuration Section */}
        <div className="space-y-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 shadow">
          <h2 className="text-xl font-semibold mb-3 text-gray-800 dark:text-gray-100">
            Scraper Configuration
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="baseUrl" className="text-gray-700 dark:text-gray-300 font-medium">Base URL</Label>
              <Input
                id="baseUrl" type="url" placeholder="https://docs.example.com" value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                disabled={isDiscoveringActive || discoveryStatus === "paused"}
                className="border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-indigo-500 focus:border-indigo-500"
                aria-describedby="baseUrlHelp"
              />
              <p id="baseUrlHelp" className="text-xs text-gray-500 dark:text-gray-400">The starting URL for discovery (e.g., homepage or docs root).</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="siteName" className="text-gray-700 dark:text-gray-300 font-medium">Site Name</Label>
              <Input
                id="siteName" placeholder="e.g., MyProduct Docs" value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                disabled={isDiscoveringActive || discoveryStatus === "paused"}
                className="border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-indigo-500 focus:border-indigo-500"
                aria-describedby="siteNameHelp"
              />
              <p id="siteNameHelp" className="text-xs text-gray-500 dark:text-gray-400">Used for categorizing data (e.g., in metadata).</p>
            </div>
          </div>
            <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="autoProcess"
              checked={autoProcess}
              onCheckedChange={(checked: boolean | "indeterminate") => setAutoProcess(checked === true)}
              disabled={isDiscoveringActive}
              className="text-indigo-600 focus:ring-indigo-500 dark:focus:ring-indigo-400 border-gray-300 dark:border-gray-600"
            />
            <Label htmlFor="autoProcess" className="text-gray-700 dark:text-gray-300 font-medium">
              Auto-Process New URLs (checks DB, processes in batches)
            </Label>
            </div>
          {/* Discovery Progress & Status */}
          <div className="space-y-2 pt-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Discovery Progress</span>
              <Badge variant={
                  discoveryStatus === 'active' ? 'default' :
                  discoveryStatus === 'completed' ? 'success' :
                  discoveryStatus === 'error' ? 'destructive' :
                  discoveryStatus === 'paused' ? 'warning' :
                  discoveryStatus === 'stopped' || discoveryStatus === 'stopping' ? 'secondary' : 'outline'
              }>
                  {discoveryStatus.charAt(0).toUpperCase() + discoveryStatus.slice(1)}
                   {discoveryStatus === 'completed' && ` (${discoveredUrls.length} found)`}
                   {autoProcess && skippedUrlCount > 0 && ` (${skippedUrlCount} skipped)`}
              </Badge>
            </div>
            <ProgressEnhanced
              value={discoveryProgress}
              indicatorColor={
                discoveryStatus === "active" ? "bg-blue-500" :
                discoveryStatus === "paused" ? "bg-amber-500" :
                discoveryStatus === "stopping" || discoveryStatus === "stopped" ? "bg-gray-500" :
                discoveryStatus === "error" ? "bg-red-500" :
                discoveryStatus === "completed" ? "bg-green-500" :
                "bg-gray-300 dark:bg-gray-600"
              }
              animate={isDiscoveringActive}
            />
          </div>
          {/* Control Buttons */}
          <div className="flex flex-wrap justify-between items-center pt-4 gap-2">
            <div className="flex space-x-2">
              <DocTooltip content={canResumeDiscovery ? "Resume Discovery" : canStartDiscovery ? "Start Discovery" : "Enter URL/Name or Already Running"}>
                <ControlButton variant="play" onClick={canResumeDiscovery ? handleResume : handleDiscover} disabled={!(canResumeDiscovery || canStartDiscovery)} aria-label={canResumeDiscovery ? "Resume Discovery" : "Start Discovery"} />
              </DocTooltip>
              <DocTooltip content="Pause Discovery">
                <ControlButton variant="pause" onClick={handlePause} disabled={!canPauseDiscovery} aria-label="Pause Discovery" />
              </DocTooltip>
              <DocTooltip content="Stop Discovery & Processing">
                <ControlButton variant="stop" onClick={handleStop} disabled={!canStop} aria-label="Stop Scraper" />
              </DocTooltip>
            </div>
            <DocTooltip content={canReset ? "Reset All Fields & Stop Processes" : "Cannot reset while active"}>
                <Button variant="outline" size="sm" onClick={handleReset} disabled={!canReset} className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700">
                    Reset All
                </Button>
            </DocTooltip>
          </div>
          {/* Info and Error Alerts */}
          <div className="pt-3 space-y-2">
             {infoMessage && (
                  <Alert variant={getAlertVariant(infoMessage)} className="transition-opacity duration-300">
                      {getAlertIcon(infoMessage)}
                      <AlertTitle>{infoMessage.split(':')[0] || 'Info'}</AlertTitle>
                      <AlertDescription>{infoMessage.substring(infoMessage.indexOf(':') + 1).trim() || infoMessage}</AlertDescription>
                  </Alert>
              )}
             {discoveryError && (
                 <Alert variant="destructive" className="transition-opacity duration-300">
                     {getAlertIcon(discoveryError, true)}
                     <AlertTitle>Discovery Error</AlertTitle>
                     <AlertDescription>{discoveryError}</AlertDescription>
                 </Alert>
             )}
             {processingError && (
                 <Alert variant="destructive" className="transition-opacity duration-300">
                      {getAlertIcon(processingError, true)}
                      <AlertTitle>Processing Error</AlertTitle>
                      <AlertDescription>{processingError}</AlertDescription>
                 </Alert>
             )}
          </div>
        </div>
        {/* Discovered URLs & Manual Processing Section */}
        {discoveredUrls.length > 0 && (
          <div className="mt-6 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4 bg-white/50 dark:bg-gray-800/50 shadow">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 flex items-center gap-2">
                Discovered URLs
                <Badge variant="secondary">{discoveredUrls.length}</Badge>
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Select URLs below for manual processing.
              </p>
            </div>
            {/* Selection Progress */}
            <div className="space-y-2">
                <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Selection Progress</span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedUrls.size} of {discoveredUrls.length} ({Math.round(getSelectionRatio())}%)
                    </span>
                </div>
                <ProgressEnhanced value={getSelectionRatio()} indicatorColor="bg-indigo-500" />
            </div>
             {/* Select All/None Buttons */}
            <div className="flex justify-start space-x-2 pt-2">
              <Button variant="outline" size="sm" onClick={handleSelectAll} disabled={selectedUrls.size === discoveredUrls.length || discoveredUrls.length === 0} className="text-xs">Select All</Button>
              <Button variant="outline" size="sm" onClick={handleSelectNone} disabled={selectedUrls.size === 0} className="text-xs">Select None</Button>
            </div>
            {/* URL List */}
            <div className="max-h-60 overflow-y-auto border rounded-lg p-3 bg-white dark:bg-gray-900/30 border-gray-200 dark:border-gray-700 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
              <div className="space-y-1">
                {discoveredUrls.map((page) => (
                  <div key={page.id} className="flex items-center space-x-3 hover:bg-gray-100 dark:hover:bg-gray-800/50 p-1.5 rounded transition-colors duration-150">
                    <Checkbox
                      id={`doc-page-${page.id}`}
                      checked={selectedUrls.has(page.id) as boolean}
                      onCheckedChange={() => handleToggleUrl(page.id)}
                      className="text-indigo-600 focus:ring-indigo-500 dark:focus:ring-indigo-400 border-gray-300 dark:border-gray-600 shrink-0"
                      aria-label={`Select URL ${page.url}`}
                    />
                    <Label htmlFor={`doc-page-${page.id}`} className="flex-1 text-sm cursor-pointer truncate text-gray-700 dark:text-gray-300" title={page.url}>
                      {page.url}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            {/* Manual Processing Form */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <h4 className="text-md font-medium mb-3 text-gray-800 dark:text-gray-100">Manual Processing</h4>
              <form onSubmit={handleProcessSelectedPages}>
                {/* Manual Process Progress */}
                {(processStatus !== "idle" || processProgress > 0) && (
                  <div className="mb-4 space-y-2">
                    <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Processing Selected</span>
                         <Badge variant={
                              processStatus === 'starting' || processStatus === 'processing' ? 'default' :
                              processStatus === 'completed' ? 'success' :
                              processStatus === 'error' ? 'destructive' :
                              processStatus === 'paused' ? 'warning' :
                              processStatus === 'stopped' ? 'secondary' : 'outline'
                          }>
                            {processStatus.charAt(0).toUpperCase() + processStatus.slice(1)}
                            {processStatus === 'processing' && ` (${Math.round(processProgress)}%)`}
                          </Badge>
                    </div>
                    <ProgressEnhanced
                      value={processProgress}
                      indicatorColor={
                        processStatus === "processing" || processStatus === "starting" ? "bg-indigo-500" :
                        processStatus === "paused" ? "bg-amber-500" :
                        processStatus === "stopped" ? "bg-gray-500" :
                        processStatus === "error" ? "bg-red-500" :
                        processStatus === "completed" ? "bg-green-500" :
                        "bg-gray-300 dark:bg-gray-600"
                      }
                      animate={isProcessingActive}
                    />
                  </div>
                )}
                 {/* Manual Process Button */}
                <div className="flex items-center space-x-4">
                  <DocTooltip content={
                      !canProcessSelection ? (selectedUrls.size === 0 ? "No URLs selected" : "Discovery/Processing active or URL/Name missing") :
                      "Process selected URLs (no automatic DB pre-check)"
                  }>
                      <Button
                        type="submit"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white"
                        disabled={!canProcessSelection}
                        aria-label={`Process ${selectedUrls.size} selected pages`}
                      >
                        Process {selectedUrls.size > 0 ? `${selectedUrls.size} Selected` : "Selected"} Page{selectedUrls.size !== 1 ? "s" : ""}
                      </Button>
                  </DocTooltip>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Note: Manual processing sends all selected URLs at once and does not pre-check if they already exist in the database.
                </p>
              </form>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

export default DocScraper;