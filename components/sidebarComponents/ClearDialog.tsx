// /components/sidebarComponents/ClearDialog.tsx
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface ClearDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: 'local' | 'remote' | 'all' | null;
  isClearing: boolean;
  onConfirm: () => void;
}

export function ClearDialog({
  open,
  onOpenChange,
  scope,
  isClearing,
  onConfirm
}: ClearDialogProps) {
  const getScopeLabel = () => {
    switch(scope) {
      case 'local': return 'locally stored';
      case 'remote': return 'cloud-saved';
      case 'all': return 'all';
      default: return '';
    }
  };
  
  const getButtonLabel = () => {
    if (isClearing) return 'Deleting...';
    switch(scope) {
      case 'local': return 'Delete Local';
      case 'remote': return 'Delete Cloud';
      case 'all': return 'Delete All';
      default: return 'Confirm';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" /> 
            Confirm Deletion
          </DialogTitle>
          <DialogDescription className="text-sm">
            Are you sure you want to delete <strong>{getScopeLabel()}</strong> conversations? 
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-end">
          <DialogClose asChild>
            <Button type="button" variant="outline" size="sm" disabled={isClearing}>Cancel</Button>
          </DialogClose>
          <Button 
            type="button" 
            variant="destructive" 
            size="sm"
            onClick={onConfirm} 
            disabled={isClearing} 
            aria-label={`Confirm delete ${scope} conversations`}
          >
            {isClearing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : getButtonLabel()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}