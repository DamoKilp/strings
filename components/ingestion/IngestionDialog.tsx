// IngestionDialog
// /components/ingestion/IngestionDialog.tsx
"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContentGlass,
  DialogDescription,
  DialogHeaderGlass,
  DialogFooterGlass,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Globe, Upload, FileText, X } from 'lucide-react';

import DocScraper from './DocScraper';
import FileUploadForm from './FileUploadForm';
import './IngestionDialog.css';

export function IngestionDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContentGlass className="max-w-[90vw] w-[90vw] sm:w-[800px] h-[90vh] max-h-[90vh]">
        <DialogHeaderGlass>
          <div className="flex items-center justify-between gap-3">
            <div>
              <DialogTitle className="text-lg sm:text-xl font-semibold glass-text-primary">
                Knowledge Base Management
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm glass-text-secondary mt-1">
                Add documents using scraping, file uploads, or manual input.
              </DialogDescription>
            </div>
            <DialogClose asChild>
              <Button 
                variant="ghost" 
                size="sm"
                className="dialog-close-btn-enhanced"
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </div>
        </DialogHeaderGlass>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6">
          <Tabs defaultValue="automatic_scraper" className="ingestion-tabs-container">
            {/* Enhanced Tab List */}
            <TabsList className="ingestion-tabs-list">
              <TabsTrigger value="automatic_scraper" className="ingestion-tab-trigger">
                <div className="tab-content">
                  <Globe className="tab-icon" />
                  <span className="tab-label">Scraper</span>
                </div>
              </TabsTrigger>
              <TabsTrigger value="file_upload" className="ingestion-tab-trigger">
                <div className="tab-content">
                  <Upload className="tab-icon" />
                  <span className="tab-label">File Upload</span>
                </div>
              </TabsTrigger>
              <TabsTrigger 
                value="manual_input" 
                disabled 
                className="ingestion-tab-trigger tab-disabled"
              >
                <div className="tab-content">
                  <FileText className="tab-icon" />
                  <span className="tab-label">Manual Input</span>
                </div>
              </TabsTrigger>
            </TabsList>

            {/* Tab Content Areas */}
            <TabsContent
              value="automatic_scraper"
              forceMount
              className="ingestion-tab-content"
            >
              <div className="tab-content-wrapper">
                <DocScraper />
              </div>
            </TabsContent>

            <TabsContent
              value="file_upload"
              className="ingestion-tab-content"
            >
              <div className="tab-content-wrapper">
                <FileUploadForm />
              </div>
            </TabsContent>

            <TabsContent
              value="manual_input"
              className="ingestion-tab-content"
            >
              <div className="tab-content-wrapper">
                <div className="coming-soon-container">
                  <div className="coming-soon-badge">
                    <FileText className="h-6 w-6 text-purple-500" />
                    <p className="coming-soon-text">Manual Input Feature Coming Soon!</p>
                    <p className="coming-soon-description">
                      Direct text input and rich editing capabilities
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <DialogFooterGlass>
          <DialogClose asChild>
            <Button 
              variant="glass" 
              className="glass-small glass-interactive px-6 rounded-xl"
            >
              Close
            </Button>
          </DialogClose>
        </DialogFooterGlass>
      </DialogContentGlass>
    </Dialog>
  );
}