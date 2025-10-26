// /components/chat/agentManager/AgentEditorForm.tsx
"use client";

import React, { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import AgentIcon from '@/components/ai/AgentIcon';
import { Trash2 } from 'lucide-react';
// Math rules checkbox removed; standardized tool-use preprompt is appended automatically

type Props = {
  mode: 'create' | 'edit';
  initial?: {
    id?: string;
    name?: string;
    description?: string;
    content?: string;
    iconKey?: string;
    colorHex?: string;
  } | null;
  onCancel: () => void;
  onSave: (payload: { id?: string; name: string; description: string; content: string; iconKey: string; colorHex: string; addToEnabled?: boolean }) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
};

const PALETTE = ['#6366F1','#10B981','#F59E0B','#F43F5E','#8B5CF6','#06B6D4'];
const ICONS = ['Bot','Database','BookOpen','Map','Wrench','Settings','Cpu','Code2','Beaker','Gauge','Hammer','FileText','Table','Shield','Brain','Rocket','Layers','Globe','Search','BarChart3'];

export function AgentEditorForm({ mode, initial, onCancel, onSave, onDelete }: Props) {
  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [content, setContent] = useState(initial?.content || '');
  const [iconKey, setIconKey] = useState(initial?.iconKey || 'Bot');
  const [colorHex, setColorHex] = useState(initial?.colorHex || PALETTE[0]);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isValid = useMemo(() => name.trim().length > 0 && content.trim().length > 0 && !!iconKey, [name, content, iconKey]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">
          {mode === 'create' ? 'Create new agent' : 'Edit agent'}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
          <Label>Description</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          <Label>Color</Label>
          <div className="flex gap-2 flex-wrap">
            {PALETTE.map((hex) => (
              <button key={hex} type="button" className="w-6 h-6 rounded border" style={{ backgroundColor: hex, opacity: colorHex === hex ? 1 : 0.5 }} onClick={() => setColorHex(hex)} />
            ))}
          </div>
          <Label>Icon (lucide)</Label>
          <Select value={iconKey} onValueChange={(v) => setIconKey(v)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select icon">
                <span className="flex items-center gap-2">
                  <AgentIcon iconKey={iconKey} colorHex={colorHex} />
                  <span className="truncate">{iconKey}</span>
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent side="bottom" sideOffset={8}>
              {ICONS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  <div className="flex items-center gap-2">
                    <AgentIcon iconKey={opt} colorHex={colorHex} />
                    <span>{opt}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>System prompt</Label>
          <Textarea className="min-h-56" value={content} onChange={(e) => setContent(e.target.value)} />
          {/* Math rules UI removed; handled globally via standardized tool-use preprompt */}
        </div>
        <div className="md:col-span-2 flex gap-2 justify-between">
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!isValid || saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await onSave({ id: initial?.id, name, description, content: content, iconKey, colorHex, addToEnabled: mode === 'create' });
                } finally {
                  setSaving(false);
                }
              }}
            >
              {mode === 'create' ? 'Create' : 'Save'}
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
          </div>
          {onDelete && mode === 'edit' && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowDeleteConfirm(true)}
              className="gap-2"
              disabled={saving}
            >
              <Trash2 className="h-4 w-4" />
              Delete Agent
            </Button>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete custom agent?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <span className="font-semibold">&quot;{name}&quot;</span> and cannot be undone. 
              Built-in agents cannot be deleted, only disabled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setShowDeleteConfirm(false);
                await onDelete?.();
              }}
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              Delete Agent
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default AgentEditorForm;


