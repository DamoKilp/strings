// /components/sidebarComponents/Sidebar.tsx
'use client';

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from 'react';
import { useChatContext } from '@/components/contexts/ChatProvider';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { motion, AnimatePresence } from 'framer-motion';
import { NewChatButtons } from './NewChatButtons';
import { ConversationList } from './ConversationList';
import { SidebarFooter } from './SidebarFooter';
import { DeleteDialog } from './DeleteDialog';
import { ClearDialog } from './ClearDialog';
import { ToggleCollapseButton } from './ToggleCollapseButton';
import { CollapsedSidebar } from './CollapsedSidebar';
import { Button } from '@/components/ui/button';
import { TrashIcon } from './SidebarIcons';
import { ListChecks, XIcon, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { ConversationSummary } from '@/lib/types';

export function Sidebar({ defaultCollapsed = true }: { defaultCollapsed?: boolean } = {}) {
  const router = useRouter();
  const {
    conversationList,
    activeConversationId,
    isLoadingConversationList, // Initial load state
    error,
    user,
    actions,
    // --- ADDED: Get pagination state from context ---
    hasMoreConversations,
    isLoadingMoreConversations,
    // --- END ADDED ---
  } = useChatContext();

  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null!);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<ConversationSummary | null>(null);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [clearScope, setClearScope] = useState<'local' | 'remote' | 'all' | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  // --- Bulk selection state ---
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [multiselectEnabled, setMultiselectEnabled] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const EXPANDED_WIDTH = 252;
  const COLLAPSED_WIDTH = 48;

  // Filtered conversations based on search
  // IMPORTANT: Apply search filter *after* fetching/appending data
  const filteredConversations = useMemo(() => {
      if (!searchQuery.trim()) {
          return conversationList; // Return original list if no search
      }
      return conversationList.filter(convo =>
          (convo.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
           (convo.summary || '').toLowerCase().includes(searchQuery.toLowerCase()) || // Check summary
           (convo.firstMessagePreview || '').toLowerCase().includes(searchQuery.toLowerCase())) // Check preview
      );
  }, [conversationList, searchQuery]);

  // --- useEffect for loadingTimeout ---
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    if (isLoadingConversationList) { // Only timeout on initial load
      timeoutId = setTimeout(() => { setLoadingTimeout(true); }, 10000);
    } else {
      setLoadingTimeout(false); // Reset if loading finishes
    }
    return () => { if (timeoutId) clearTimeout(timeoutId); };
  }, [isLoadingConversationList]);

  // --- useEffect to focus input on rename ---
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  // --- Action Handlers ---
  const handleCreateCloudChat = useCallback(() => { 
    actions.createNewConversation('cloud', true); 
    //setCollapsed(false); 
  }, [actions]);

  const handleCreateLocalChat = useCallback(() => { 
    actions.createNewConversation('local', true); 
    //setCollapsed(false); 
  }, [actions]);

  const handleSelect = useCallback((id: string, isLocal: boolean) => { 
    if (id !== activeConversationId && renamingId !== id) { 
      actions.selectConversation(id, isLocal); 
      setRenamingId(null); 
    } 
  }, [actions, activeConversationId, renamingId]);

  const startRename = useCallback((conversation: ConversationSummary) => { 
    setRenamingId(conversation.id); 
    setNewTitle(conversation.title ?? ''); 
  }, []);

  const cancelRename = useCallback(() => { 
    setRenamingId(null); 
    setNewTitle(''); 
  }, []);

  const submitRename = useCallback(async () => { 
    if (renamingId && newTitle.trim()) { 
      try { 
        await actions.renameConversation(renamingId, newTitle.trim()); 
      } catch (e) { 

      } finally { 
        setRenamingId(null); 
        setNewTitle(''); 
      } 
    } else if (renamingId) { 
      cancelRename(); 
    } 
  }, [renamingId, newTitle, actions, cancelRename]);

  const handleRenameKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => { 
    if (event.key === 'Enter') { 
      event.preventDefault(); 
      submitRename(); 
    } else if (event.key === 'Escape') { 
      cancelRename(); 
    } 
  }, [submitRename, cancelRename]);

  const handleRenameBlur = useCallback(() => { 
    setTimeout(() => { 
      if (renamingId) { 
        submitRename(); 
      } 
    }, 100); 
  }, [renamingId, submitRename]);

  const openDeleteDialog = useCallback((conversation: ConversationSummary) => { 
    setConversationToDelete(conversation); 
    setIsDeleteDialogOpen(true); 
  }, []);

  const confirmDelete = useCallback(async () => { 
    if (conversationToDelete) { 
      try { 
        await actions.deleteConversation(conversationToDelete.id); 
      } catch (e) { 

      } finally { 
        setIsDeleteDialogOpen(false); 
        setConversationToDelete(null); 
      } 
    } 
  }, [conversationToDelete, actions]);

  const openClearDialog = useCallback((scope: 'local' | 'remote' | 'all') => { 
    setClearScope(scope); 
    setIsClearConfirmOpen(true); 
  }, []);

  const confirmClear = useCallback(async () => { 
    if (clearScope && user) { 
      setIsClearing(true); 
      try { 
        await actions.clearConversations(clearScope); 
      } catch (e) { 

      } finally { 
        setIsClearing(false); 
        setIsClearConfirmOpen(false); 
        setClearScope(null); 
      } 
    } 
  }, [clearScope, user, actions]);

  const toggleCollapse = useCallback(() => { 
    setCollapsed(prev => !prev); 
  }, []);

  const handleSearch = useCallback((query: string) => { 
    setSearchQuery(query); 
  }, []);

  // --- Get the load more action ---
  const handleLoadMore = useCallback(() => {
    if (actions.loadMoreConversations) {
      actions.loadMoreConversations();
    } else {

    }
  }, [actions]);
  // --- End load more handler ---
  // --- Bulk selection handlers ---
  const handleSelectConversation = useCallback((id: string, checked: boolean) => {
    setSelectedIds(prev =>
      checked ? [...prev, id] : prev.filter(selId => selId !== id)
    );
  }, []);  const handleSelectRange = useCallback((fromIndex: number, toIndex: number, visibleIds: string[]) => {
    const startIndex = Math.min(fromIndex, toIndex);
    const endIndex = Math.max(fromIndex, toIndex);
    const rangeIds = visibleIds.slice(startIndex, endIndex + 1);
    
    setSelectedIds(prev => {
      // Add all IDs in the range to selection
      const newSelection = Array.from(new Set([...prev, ...rangeIds]));
      return newSelection;
    });
  }, []);

  const handleSelectAll = useCallback((checked: boolean, visibleIds: string[]) => {
    setSelectedIds(prev => {
      if (checked) {
        // Add all visibleIds not already selected
        return Array.from(new Set([...prev, ...visibleIds]));
      } else {
        // Remove all visibleIds from selection
        return prev.filter(id => !visibleIds.includes(id));
      }
    });
  }, []);const handleBulkDelete = useCallback(async () => {
    if (selectedIds.length === 0) return;
    
    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedIds.length} conversation${selectedIds.length > 1 ? 's' : ''}? This action cannot be undone.`
    );
    
    if (!confirmed) return;
    
    setIsBulkDeleting(true);
    try {

      await actions.deleteConversationsBulk(selectedIds);
      setSelectedIds([]);

    } catch (e) {

      // Keep the selection so user can retry if needed
      alert(`Failed to delete conversations: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setIsBulkDeleting(false);
    }
  }, [actions, selectedIds, conversationList]);

  // --- Multiselect toggle ---
  const handleToggleMultiselect = useCallback(() => {
    setMultiselectEnabled((prev) => {
      if (prev) setSelectedIds([]); // Clear selection when turning off
      return !prev;
    });
  }, []);

  // --- Keyboard shortcuts useEffect ---
  useEffect(() => { 
    const handleKeyDown = (e: KeyboardEvent) => { 
      if (e.key === 'Escape' && renamingId) { 
        cancelRename(); 
      } 
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') { 
        e.preventDefault(); 
        handleCreateCloudChat(); 
      } 
    }; 
    window.addEventListener('keydown', handleKeyDown); 
    return () => window.removeEventListener('keydown', handleKeyDown); 
  }, [renamingId, cancelRename, handleCreateCloudChat]);

  // --- Sidebar collapse/expand event useEffect ---
  useEffect(() => { 
    const event = new CustomEvent('sidebarStateChange', { 
      detail: { 
        collapsed, 
        width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH 
      } 
    }); 
    window.dispatchEvent(event); 
  }, [collapsed]);

  // Get visible conversation IDs for select all logic
  const visibleIds = useMemo(
    () => filteredConversations.map(c => c.id),
    [filteredConversations]
  );
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id));
  const anySelected = selectedIds.length > 0;

  return (
    <TooltipProvider delayDuration={100}>
      <div className="relative h-full w-full">
        {/* Main Sidebar */}
        <motion.div
          className="flex flex-col h-full bg-secondary/10 dark:bg-neutral-900/50 border-r border-border/50 text-sm"
          initial={{ width: collapsed ? `${COLLAPSED_WIDTH}px` : `${EXPANDED_WIDTH}px` }}
          animate={{ width: collapsed ? `${COLLAPSED_WIDTH}px` : `${EXPANDED_WIDTH}px` }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          data-sidebar-state={collapsed ? 'collapsed' : 'expanded'}
          data-sidebar-width={collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH}
        >
          <AnimatePresence mode="wait">
            {collapsed ? (
              <motion.div 
                key="collapsed" 
                className="flex flex-col h-full"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center justify-between py-1 px-2 border-b border-border/50">
                  <ToggleCollapseButton isCollapsed={collapsed} onClick={toggleCollapse} />
                </div>
                <CollapsedSidebar onCreateChat={handleCreateCloudChat} onExpand={toggleCollapse} />
              </motion.div>
            ) : (
              <motion.div 
                key="expanded" 
                className="flex flex-col h-full w-full"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center py-1 px-2 border-b border-border/50">
                  <ToggleCollapseButton isCollapsed={collapsed} onClick={toggleCollapse} />
                  <span className="ml-2 text-sm font-semibold">\/\</span>
                  <div className="ml-auto flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={multiselectEnabled ? "secondary" : "outline"}
                          size="icon"
                          className="h-7 w-7"
                          aria-label={multiselectEnabled ? "Disable multi-select" : "Enable multi-select"}
                          onClick={handleToggleMultiselect}
                        >
                          {multiselectEnabled ? <XIcon className="h-4 w-4" /> : <ListChecks className="h-4 w-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {multiselectEnabled ? "Exit multi-select mode" : "Enable multi-select to delete multiple conversations"}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                <NewChatButtons onCreateCloudChat={handleCreateCloudChat} onCreateLocalChat={handleCreateLocalChat} />                {/* Bulk Delete Bar */}
                {multiselectEnabled && anySelected && (
                  <div className="flex items-center gap-2 px-2 py-1 border-b border-border/50 bg-secondary/30">
                    <span className="text-xs">{selectedIds.length} selected</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-7 px-2"
                          onClick={handleBulkDelete}
                          disabled={isBulkDeleting}
                          aria-label="Delete selected conversations"
                        >
                          {isBulkDeleting ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              Deleting...
                            </>
                          ) : (
                            <>
                              <TrashIcon className="h-4 w-4 mr-1" />
                              Delete Selected
                            </>
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {isBulkDeleting ? "Deleting conversations..." : "Delete all selected conversations"}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                )}
                {/* Conversation List container - keeping overflow-hidden here */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  <ConversationList
                    conversations={filteredConversations}
                    activeConversationId={activeConversationId}
                    isLoading={isLoadingConversationList}
                    error={error}
                    loadingTimeout={loadingTimeout}
                    renamingId={renamingId}
                    newTitle={newTitle}
                    setNewTitle={setNewTitle}
                    renameInputRef={renameInputRef}
                    handleSelect={handleSelect}
                    startRename={startRename}
                    cancelRename={cancelRename}
                    submitRename={submitRename}
                    handleRenameKeyDown={handleRenameKeyDown}
                    handleRenameBlur={handleRenameBlur}
                    openDeleteDialog={openDeleteDialog}
                    onRefresh={actions.refreshConversationList}
                    onSearch={handleSearch}
                    searchQuery={searchQuery}
                    onLoadMore={handleLoadMore}
                    hasMore={!!hasMoreConversations}
                    isLoadingMore={!!isLoadingMoreConversations}                    // Bulk selection props
                    selectedIds={selectedIds}
                    onSelectConversation={handleSelectConversation}
                    onSelectRange={handleSelectRange}
                    onSelectAll={handleSelectAll}
                    allVisibleSelected={allVisibleSelected}
                    multiselectEnabled={multiselectEnabled}
                  />
                </div>
                {/* Footer */}
                <SidebarFooter
                  user={user}
                  onClearLocal={() => openClearDialog('local')}
                  onClearCloud={() => openClearDialog('remote')}
                  onClearAll={() => openClearDialog('all')}
                  onSettings={() => router.push('/admin')}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
        {/* Dialogs */}
        <DeleteDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen} conversation={conversationToDelete} onConfirm={confirmDelete} />
        <ClearDialog open={isClearConfirmOpen} onOpenChange={setIsClearConfirmOpen} scope={clearScope} isClearing={isClearing} onConfirm={confirmClear} />
      </div>
    </TooltipProvider>
  );
}
