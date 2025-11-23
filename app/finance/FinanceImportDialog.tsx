'use client'

import React, { useState, useCallback } from 'react'
import {
  Dialog,
  DialogContentGlass,
  DialogHeaderGlass,
  DialogFooterGlass,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'

interface FinanceImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImportComplete: () => void
}

/**
 * Finance Import Dialog Component
 * Allows users to upload Excel/CSV files to import historical financial data
 */
export default function FinanceImportDialog({
  open,
  onOpenChange,
  onImportComplete,
}: FinanceImportDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [dragActive, setDragActive] = useState(false)

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0]
      const fileName = droppedFile.name.toLowerCase()
      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
        setFile(droppedFile)
      } else {
        toast.error('Please upload an Excel (.xlsx, .xls) or CSV file')
      }
    }
  }, [])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }, [])

  const handleImport = useCallback(async () => {
    if (!file) {
      toast.error('Please select a file to import')
      return
    }

    setIsUploading(true)
    setProgress(0)

    try {
      const formData = new FormData()
      formData.append('file', file)

      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90))
      }, 200)

      const response = await fetch('/api/finance/import', {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)
      setProgress(100)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Upload failed' }))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const result = await response.json()
      
      if (result.success) {
        toast.success(result.message || `Successfully imported ${result.inserted} projection(s)`)
        setFile(null)
        setProgress(0)
        onOpenChange(false)
        onImportComplete()
      } else {
        throw new Error(result.error || 'Import failed')
      }
    } catch (error) {
      console.error('Import error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to import file')
      setProgress(0)
    } finally {
      setIsUploading(false)
    }
  }, [file, onOpenChange, onImportComplete])

  const handleClose = useCallback(() => {
    if (!isUploading) {
      setFile(null)
      setProgress(0)
      onOpenChange(false)
    }
  }, [isUploading, onOpenChange])

  const handleDownloadTemplate = useCallback(() => {
    // Create a link and trigger download
    const link = document.createElement('a')
    link.href = '/api/finance/import/template'
    link.download = 'finance-import-template.xlsx'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Template download started')
  }, [])

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContentGlass className="sm:max-w-[500px]">
        <DialogHeaderGlass>
          <DialogTitle>Import Historical Data</DialogTitle>
          <DialogDescription>
            Upload an Excel (.xlsx, .xls) or CSV file containing your historical financial projections.
            The template includes all your current accounts as columns.
          </DialogDescription>
        </DialogHeaderGlass>

        <div className="space-y-4">
          {/* Download Template Button */}
          <div className="flex items-center justify-center">
            <Button
              variant="outline"
              onClick={handleDownloadTemplate}
              className="glass-small"
            >
              📥 Download Template
            </Button>
          </div>

          {/* File Drop Zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center transition-colors
              ${dragActive 
                ? 'border-blue-400 bg-blue-500/10' 
                : 'border-white/20 hover:border-white/30'
              }
              ${isUploading ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}
            `}
            onClick={() => !isUploading && document.getElementById('file-input')?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileInput}
              className="hidden"
              disabled={isUploading}
            />
            
            {file ? (
              <div className="space-y-2">
                <p className="glass-text-primary font-medium">{file.name}</p>
                <p className="glass-text-secondary text-sm">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="glass-text-primary font-medium">
                  Drag and drop your file here
                </p>
                <p className="glass-text-secondary text-sm">
                  or click to browse
                </p>
                <p className="glass-text-tertiary text-xs mt-2">
                  Supports .xlsx, .xls, and .csv files
                </p>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          {isUploading && (
            <div className="space-y-2">
              <Progress value={progress} className="w-full" />
              <p className="glass-text-secondary text-xs text-center">
                Uploading and processing...
              </p>
            </div>
          )}
        </div>

        <DialogFooterGlass>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isUploading}
            className="glass-small"
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!file || isUploading}
            className="glass-small"
          >
            {isUploading ? 'Importing...' : 'Import'}
          </Button>
        </DialogFooterGlass>
      </DialogContentGlass>
    </Dialog>
  )
}

