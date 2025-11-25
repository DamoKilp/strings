"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContentGlass, DialogHeaderGlass, DialogFooterGlass, DialogTitle, DialogDescription, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MemoryService, Memory, CreateMemoryInput, UpdateMemoryInput } from '@/lib/memoryService';
import { Trash2, Edit2, Plus, Brain, FileText } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface ProtocolsMemoriesDialogProps {
  triggerClassName?: string;
}

const MEMORY_CATEGORIES = ['personal', 'work', 'family', 'fitness', 'preferences', 'projects', 'protocol', 'protocols', 'other'] as const;

export function ProtocolsMemoriesDialog({ triggerClassName }: ProtocolsMemoriesDialogProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'protocols' | 'memories'>('protocols');
  
  // Protocols state
  const [protocols, setProtocols] = useState<Memory[]>([]);
  const [editingProtocol, setEditingProtocol] = useState<Memory | null>(null);
  const [protocolForm, setProtocolForm] = useState({ name: '', content: '', importance: 7 });
  const [deleteProtocolId, setDeleteProtocolId] = useState<string | null>(null);
  
  // Memories state
  const [memories, setMemories] = useState<Memory[]>([]);
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [memoryForm, setMemoryForm] = useState<CreateMemoryInput>({ content: '', category: 'personal', importance: 5 });
  const [deleteMemoryId, setDeleteMemoryId] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(false);

  // Load protocols (memories with category 'protocol' or 'protocols')
  const loadProtocols = useCallback(async () => {
    try {
      setLoading(true);
      const allMemories = await MemoryService.getMemories({ limit: 1000 });
      const protocolMemories = allMemories.filter(m => 
        m.category === 'protocol' || m.category === 'protocols'
      );
      setProtocols(protocolMemories);
    } catch (error) {
      console.error('[ProtocolsMemoriesDialog] Error loading protocols:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load all memories
  const loadMemories = useCallback(async () => {
    try {
      setLoading(true);
      const allMemories = await MemoryService.getMemories({ limit: 1000 });
      // Filter out protocols from general memories
      const nonProtocolMemories = allMemories.filter(m => 
        m.category !== 'protocol' && m.category !== 'protocols'
      );
      setMemories(nonProtocolMemories);
    } catch (error) {
      console.error('[ProtocolsMemoriesDialog] Error loading memories:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load data when dialog opens
  useEffect(() => {
    if (open) {
      loadProtocols();
      loadMemories();
    }
  }, [open, loadProtocols, loadMemories]);

  // Helper to format protocol content with name and trigger phrase
  const formatProtocolContent = (name: string, content: string): string => {
    const trimmedName = name.trim();
    const trimmedContent = content.trim();
    
    if (!trimmedName) {
      return trimmedContent;
    }
    
    // Format: Protocol name and trigger phrase at the top, then content
    const header = `Protocol Name: ${trimmedName}\nTrigger phrase: When the user says "run the ${trimmedName} protocol" or "run ${trimmedName} protocol", follow these instructions:\n\n`;
    return header + trimmedContent;
  };

  // Helper to extract protocol name from stored content
  const extractProtocolName = (content: string): string => {
    const match = content.match(/^Protocol Name:\s*(.+?)(?:\n|$)/);
    return match ? match[1].trim() : '';
  };

  // Protocol handlers
  const handleCreateProtocol = async () => {
    if (!protocolForm.content.trim()) return;
    try {
      setLoading(true);
      const formattedContent = formatProtocolContent(protocolForm.name, protocolForm.content);
      const memory = await MemoryService.createMemory({
        content: formattedContent,
        category: 'protocol',
        importance: protocolForm.importance
      });
      if (memory) {
        setProtocolForm({ name: '', content: '', importance: 7 });
        await loadProtocols();
      }
    } catch (error) {
      console.error('[ProtocolsMemoriesDialog] Error creating protocol:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProtocol = async () => {
    if (!editingProtocol || !protocolForm.content.trim()) return;
    try {
      setLoading(true);
      const formattedContent = formatProtocolContent(protocolForm.name, protocolForm.content);
      const updated = await MemoryService.updateMemory(editingProtocol.id, {
        content: formattedContent,
        importance: protocolForm.importance
      });
      if (updated) {
        setEditingProtocol(null);
        setProtocolForm({ name: '', content: '', importance: 7 });
        await loadProtocols();
      }
    } catch (error) {
      console.error('[ProtocolsMemoriesDialog] Error updating protocol:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProtocol = async () => {
    if (!deleteProtocolId) return;
    try {
      setLoading(true);
      const success = await MemoryService.deleteMemory(deleteProtocolId);
      if (success) {
        setDeleteProtocolId(null);
        await loadProtocols();
      }
    } catch (error) {
      console.error('[ProtocolsMemoriesDialog] Error deleting protocol:', error);
    } finally {
      setLoading(false);
    }
  };

  const startEditProtocol = (protocol: Memory) => {
    setEditingProtocol(protocol);
    const extractedName = extractProtocolName(protocol.content);
    // Remove the header from content when editing
    const contentWithoutHeader = protocol.content.replace(/^Protocol Name:.*?\nTrigger phrase:.*?\n\n/, '');
    setProtocolForm({ 
      name: extractedName, 
      content: contentWithoutHeader.trim(), 
      importance: protocol.importance 
    });
  };

  const cancelEditProtocol = () => {
    setEditingProtocol(null);
    setProtocolForm({ name: '', content: '', importance: 7 });
  };

  // Memory handlers
  const handleCreateMemory = async () => {
    if (!memoryForm.content.trim()) return;
    try {
      setLoading(true);
      const memory = await MemoryService.createMemory(memoryForm);
      if (memory) {
        setMemoryForm({ content: '', category: 'personal', importance: 5 });
        await loadMemories();
      }
    } catch (error) {
      console.error('[ProtocolsMemoriesDialog] Error creating memory:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMemory = async () => {
    if (!editingMemory || !memoryForm.content.trim()) return;
    try {
      setLoading(true);
      const updated = await MemoryService.updateMemory(editingMemory.id, {
        content: memoryForm.content.trim(),
        category: memoryForm.category,
        importance: memoryForm.importance
      });
      if (updated) {
        setEditingMemory(null);
        setMemoryForm({ content: '', category: 'personal', importance: 5 });
        await loadMemories();
      }
    } catch (error) {
      console.error('[ProtocolsMemoriesDialog] Error updating memory:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMemory = async () => {
    if (!deleteMemoryId) return;
    try {
      setLoading(true);
      const success = await MemoryService.deleteMemory(deleteMemoryId);
      if (success) {
        setDeleteMemoryId(null);
        await loadMemories();
      }
    } catch (error) {
      console.error('[ProtocolsMemoriesDialog] Error deleting memory:', error);
    } finally {
      setLoading(false);
    }
  };

  const startEditMemory = (memory: Memory) => {
    setEditingMemory(memory);
    setMemoryForm({ 
      content: memory.content, 
      category: memory.category || 'personal', 
      importance: memory.importance 
    });
  };

  const cancelEditMemory = () => {
    setEditingMemory(null);
    setMemoryForm({ content: '', category: 'personal', importance: 5 });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            className={triggerClassName || "toolbar-btn text-blue-400/80 dark:text-blue-400/80"}
            aria-label="Manage Protocols & Memories"
          >
            <Brain className="toolbar-icon" />
          </button>
        </DialogTrigger>
        <DialogContentGlass className="max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeaderGlass>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-900" style={{ color: 'rgb(15, 23, 42)' }}>
              <Brain className="h-5 w-5" />
              Protocols & Memories Manager
            </DialogTitle>
            <DialogDescription style={{ color: 'rgb(15, 23, 42)' }}>
              Create, edit, and delete voice protocols and AI memories. Protocols are used in voice chat when you say "run voice protocol".
            </DialogDescription>
          </DialogHeaderGlass>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'protocols' | 'memories')} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="protocols" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Protocols
              </TabsTrigger>
              <TabsTrigger value="memories" className="flex items-center gap-2">
                <Brain className="h-4 w-4" />
                Memories
              </TabsTrigger>
            </TabsList>

            {/* Protocols Tab */}
            <TabsContent value="protocols" className="flex-1 flex flex-col overflow-hidden mt-4">
              <div className="flex-1 overflow-y-auto space-y-4">
                {/* Create/Edit Form */}
                <div className="p-4 rounded-lg border border-white/20 dark:border-white/10 bg-white/20 dark:bg-white/10 backdrop-blur-sm space-y-4">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-900" style={{ color: 'rgb(15, 23, 42)' }}>
                    {editingProtocol ? 'Edit Protocol' : 'Create New Protocol'}
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="protocol-name" className="glass-text-secondary" style={{ color: 'rgb(15, 23, 42)' }}>Protocol Name</Label>
                      <Input
                        id="protocol-name"
                        value={protocolForm.name}
                        onChange={(e) => setProtocolForm({ ...protocolForm, name: e.target.value })}
                        placeholder="e.g., 'work mode', 'fitness coach', 'technical support'"
                        className="mt-1"
                        disabled={loading}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        When you say "run the [name] protocol" in voice chat, this protocol will be activated.
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="protocol-content" className="glass-text-secondary" style={{ color: 'rgb(15, 23, 42)' }}>Protocol Steps/Instructions</Label>
                      <Textarea
                        id="protocol-content"
                        value={protocolForm.content}
                        onChange={(e) => setProtocolForm({ ...protocolForm, content: e.target.value })}
                        placeholder="Enter the protocol instructions/steps (e.g., 'Switch to a professional tone, focus on work topics, use technical terminology')"
                        className="mt-1 min-h-[100px]"
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <Label htmlFor="protocol-importance" className="glass-text-secondary" style={{ color: 'rgb(15, 23, 42)' }}>Importance (1-10)</Label>
                      <Input
                        id="protocol-importance"
                        type="number"
                        min="1"
                        max="10"
                        value={protocolForm.importance}
                        onChange={(e) => setProtocolForm({ ...protocolForm, importance: parseInt(e.target.value) || 7 })}
                        className="mt-1"
                        disabled={loading}
                      />
                    </div>
                    <div className="flex gap-2">
                      {editingProtocol ? (
                        <>
                          <Button onClick={handleUpdateProtocol} disabled={loading || !protocolForm.content.trim()}>
                            <Edit2 className="h-4 w-4 mr-2" />
                            Update Protocol
                          </Button>
                          <Button variant="outline" onClick={cancelEditProtocol} disabled={loading}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button onClick={handleCreateProtocol} disabled={loading || !protocolForm.content.trim()}>
                          <Plus className="h-4 w-4 mr-2" />
                          Create Protocol
                        </Button>
                      )}
                    </div>
                    {protocolForm.name && (
                      <div className="text-xs text-muted-foreground p-2 rounded bg-blue-500/10 border border-blue-500/20">
                        <strong>Trigger phrase:</strong> "run the {protocolForm.name} protocol" or "run {protocolForm.name} protocol"
                      </div>
                    )}
                  </div>
                </div>

                {/* Protocols List */}
                <div className="space-y-2">
                  <h3 className="text-md font-semibold text-slate-900 dark:text-slate-900" style={{ color: 'rgb(15, 23, 42)' }}>Existing Protocols ({protocols.length})</h3>
                  {protocols.length === 0 ? (
                    <div className="space-y-2 p-4 rounded-lg border border-white/20 dark:border-white/10 bg-white/20 dark:bg-white/10 backdrop-blur-sm text-center text-muted-foreground">
                      No protocols yet. Create one above to get started.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {protocols.map((protocol) => {
                        const protocolName = extractProtocolName(protocol.content);
                        const displayContent = protocol.content.replace(/^Protocol Name:.*?\nTrigger phrase:.*?\n\n/, '');
                        return (
                          <div key={protocol.id} className="space-y-2 p-4 rounded-lg border border-white/20 dark:border-white/10 bg-white/20 dark:bg-white/10 backdrop-blur-sm">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  {protocolName && (
                                    <span className="text-sm font-semibold px-2 py-1 rounded bg-green-500/20 text-green-300">
                                      {protocolName}
                                    </span>
                                  )}
                                  <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-300">
                                    Importance: {protocol.importance}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(protocol.created_at).toLocaleDateString()}
                                  </span>
                                </div>
                                {protocolName && (
                                  <p className="text-xs text-muted-foreground mb-2 italic">
                                    Trigger: "run the {protocolName} protocol"
                                  </p>
                                )}
                                <p className="glass-text-primary whitespace-pre-wrap text-slate-900 dark:text-slate-900" style={{ color: 'rgb(15, 23, 42)' }}>{displayContent || protocol.content}</p>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => startEditProtocol(protocol)}
                                  disabled={loading}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setDeleteProtocolId(protocol.id)}
                                  disabled={loading}
                                  className="text-red-400 hover:text-red-300"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Memories Tab */}
            <TabsContent value="memories" className="flex-1 flex flex-col overflow-hidden mt-4">
              <div className="flex-1 overflow-y-auto space-y-4">
                {/* Create/Edit Form */}
                <div className="p-4 rounded-lg border border-white/20 dark:border-white/10 bg-white/20 dark:bg-white/10 backdrop-blur-sm space-y-4">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-900" style={{ color: 'rgb(15, 23, 42)' }}>
                    {editingMemory ? 'Edit Memory' : 'Create New Memory'}
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="memory-content" className="glass-text-secondary" style={{ color: 'rgb(15, 23, 42)' }}>Memory Content</Label>
                      <Textarea
                        id="memory-content"
                        value={memoryForm.content}
                        onChange={(e) => setMemoryForm({ ...memoryForm, content: e.target.value })}
                        placeholder="Enter memory content (e.g., 'User prefers to be called Sir', 'User has two kids: Josh and Troy')"
                        className="mt-1 min-h-[100px]"
                        disabled={loading}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="memory-category" className="glass-text-secondary" style={{ color: 'rgb(15, 23, 42)' }}>Category</Label>
                        <Select
                          value={memoryForm.category}
                          onValueChange={(v) => setMemoryForm({ ...memoryForm, category: v })}
                          disabled={loading}
                        >
                          <SelectTrigger id="memory-category" className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MEMORY_CATEGORIES.map((cat) => (
                              <SelectItem key={cat} value={cat}>
                                {cat.charAt(0).toUpperCase() + cat.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="memory-importance" className="glass-text-secondary" style={{ color: 'rgb(15, 23, 42)' }}>Importance (1-10)</Label>
                        <Input
                          id="memory-importance"
                          type="number"
                          min="1"
                          max="10"
                          value={memoryForm.importance}
                          onChange={(e) => setMemoryForm({ ...memoryForm, importance: parseInt(e.target.value) || 5 })}
                          className="mt-1"
                          disabled={loading}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {editingMemory ? (
                        <>
                          <Button onClick={handleUpdateMemory} disabled={loading || !memoryForm.content.trim()}>
                            <Edit2 className="h-4 w-4 mr-2" />
                            Update Memory
                          </Button>
                          <Button variant="outline" onClick={cancelEditMemory} disabled={loading}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button onClick={handleCreateMemory} disabled={loading || !memoryForm.content.trim()}>
                          <Plus className="h-4 w-4 mr-2" />
                          Create Memory
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Memories List */}
                <div className="space-y-2">
                  <h3 className="text-md font-semibold text-slate-900 dark:text-slate-900" style={{ color: 'rgb(15, 23, 42)' }}>Existing Memories ({memories.length})</h3>
                  {memories.length === 0 ? (
                    <div className="space-y-2 p-4 rounded-lg border border-white/20 dark:border-white/10 bg-white/20 dark:bg-white/10 backdrop-blur-sm text-center text-muted-foreground">
                      No memories yet. Create one above to get started.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {memories.map((memory) => (
                        <div key={memory.id} className="space-y-2 p-4 rounded-lg border border-white/20 dark:border-white/10 bg-white/20 dark:bg-white/10 backdrop-blur-sm">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                {memory.category && (
                                  <span className="text-xs px-2 py-1 rounded bg-purple-500/20 text-purple-300">
                                    {memory.category}
                                  </span>
                                )}
                                <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-300">
                                  Importance: {memory.importance}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(memory.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="glass-text-primary whitespace-pre-wrap text-slate-900 dark:text-slate-900" style={{ color: 'rgb(15, 23, 42)' }}>{memory.content}</p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => startEditMemory(memory)}
                                disabled={loading}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDeleteMemoryId(memory.id)}
                                disabled={loading}
                                className="text-red-400 hover:text-red-300"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooterGlass>
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
          </DialogFooterGlass>
        </DialogContentGlass>
      </Dialog>

      {/* Delete Protocol Confirmation */}
      <AlertDialog open={!!deleteProtocolId} onOpenChange={(open) => !open && setDeleteProtocolId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Protocol?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this protocol? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProtocol} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Memory Confirmation */}
      <AlertDialog open={!!deleteMemoryId} onOpenChange={(open) => !open && setDeleteMemoryId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Memory?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this memory? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMemory} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

