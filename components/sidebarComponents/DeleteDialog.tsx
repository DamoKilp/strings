// /components/sidebarComponents/DeleteDialog.tsx
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
import { Trash2 } from 'lucide-react';
import type { ConversationSummary } from '@/lib/types';

interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: ConversationSummary | null;
  onConfirm: () => void;
}

export function DeleteDialog({
  open,
  onOpenChange,
  conversation,
  onConfirm
}: DeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Trash2 className="h-5 w-5 text-destructive" />
            Delete Conversation
          </DialogTitle>
          <DialogDescription className="text-sm">
            Are you sure you want to delete &quot;{conversation?.title || 'Untitled Chat'}&quot;? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-end">
          <DialogClose asChild>
            <Button type="button" variant="outline" size="sm">Cancel</Button>
          </DialogClose>
          <Button type="button" variant="destructive" size="sm" onClick={onConfirm} aria-label="Confirm deletion">
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}