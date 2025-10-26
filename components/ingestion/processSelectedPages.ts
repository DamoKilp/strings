// file-5.js

// components/ingestion/processSelectedPages.ts
import React from 'react';
// **CHANGED**: Import types from the shared location
import { ResultsSummary, DetailedResult } from '@/lib/types'; // Adjust path if needed

// Process status types
export type ProcessStatusType =
  | "idle"
  | "starting"
  | "processing"
  | "error"
  | "completed";

// Props for the function
export interface ProcessSelectedPagesProps {
  urls: string[];
  baseUrl: string;
  siteName: string;
  onProgressUpdate: React.Dispatch<React.SetStateAction<number>>;
  onStatusUpdate: (status: ProcessStatusType) => void;
  onMessageUpdate: (message: string | null) => void;
  onErrorUpdate: (error: string | null) => void;
  // **CHANGED**: Use imported types directly, remove '| any' fallback
  onResultsUpdate?: (results: { summary: ResultsSummary, details: DetailedResult[] }) => void;
  // Pass the ref to manage the simulation interval
  processIntervalRef: React.MutableRefObject<NodeJS.Timeout | null>;
}

/**
 * Client-side function to trigger backend processing of URLs via the
 * POST /api/scrapeDocsWithPuppeteer endpoint. Updates UI state via callbacks.
 */
export async function processSelectedPages({
  urls,
  baseUrl,
  siteName,
  onProgressUpdate,
  onStatusUpdate,
  onMessageUpdate,
  onErrorUpdate,
  onResultsUpdate,
  processIntervalRef,
}: ProcessSelectedPagesProps): Promise<void> {

    // --- Start State ---
    onStatusUpdate("starting");
    onProgressUpdate(0);
    onMessageUpdate(`Initializing processing for ${urls.length} selected URLs...`);
    onErrorUpdate(null);

    // --- Validation ---
    if (!urls || urls.length === 0 || !siteName || !baseUrl) {
        onErrorUpdate("Missing required parameters (URLs, Site Name, Base URL).");
        onStatusUpdate("error");
        onMessageUpdate(null);
        return;
    }

    // --- Clear previous interval ---
    if (processIntervalRef.current) {
        clearInterval(processIntervalRef.current);
        processIntervalRef.current = null;
    }

    // --- Progress Simulation ---
    let progress = 0;
    const progressInterval = setInterval(() => {
        progress = Math.min(95, progress + Math.random() * 3 + 1);
        onProgressUpdate(progress);
    }, 700);
    processIntervalRef.current = progressInterval;

    try {
        onStatusUpdate("processing");
        onMessageUpdate(`Backend processing ${urls.length} URLs... (This may take time)`);

        // --- API Call ---
        const response = await fetch("/api/scrapeDocsWithPuppeteer", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({ urls, siteName, baseUrl }),
        });

        // --- Stop Simulation ---
        clearInterval(progressInterval);
        processIntervalRef.current = null;

        // --- Response Handling ---
        let responseData: any = null; // Keep as any initially for parsing flexibility
        try {
            responseData = await response.json();
        } catch (jsonError) {
             if (!response.ok) {
                  throw new Error(`Server error: ${response.status} (${response.statusText}). Failed to parse error response.`);
             } else {
                 throw new Error("Received OK status but failed to parse JSON response.");
             }
        }

        if (!response.ok) {
            const errorMessage = responseData?.error || responseData?.details || `Request failed: ${response.status} (${response.statusText})`;
            throw new Error(errorMessage);
        }

        // --- Success Case ---
        onProgressUpdate(100);
        onStatusUpdate("completed");
        const successMessage = responseData?.message || `Processing complete. Processed ${responseData?.summary?.processed || 'N/A'}, Stored: ${responseData?.summary?.stored || 'N/A'}.`;
        onMessageUpdate(successMessage);
        onErrorUpdate(null);

        // Pass back detailed results if callback provided
        // **CHANGED**: Types are now correctly inferred or asserted
        if (onResultsUpdate && responseData && responseData.summary && responseData.details) {
            // Assuming responseData structure matches { summary: ResultsSummary, details: DetailedResult[] }
            onResultsUpdate({
                summary: responseData.summary as ResultsSummary, // Optional: assert type if needed
                details: responseData.details as DetailedResult[] // Optional: assert type if needed
             });
        }


    } catch (error: unknown) {
        // --- Error Case ---
        if (processIntervalRef.current) {
            clearInterval(processIntervalRef.current);
            processIntervalRef.current = null;
        }

        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during processing.";

        onStatusUpdate("error");
        onErrorUpdate(errorMessage);
        onMessageUpdate("Processing encountered an error. Check details.");
        onProgressUpdate(0);
    }
}