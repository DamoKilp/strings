// Enhanced Chat Input with Table Search Settings
import React, { useState, useRef, useEffect } from 'react';
import { Send, Settings, Database, Zap, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TableSearchSettingsModal } from '@/components/ui/table-search-settings-modal';
import { useTableSearchSettings } from '@/hooks/useTableSearchSettings';

interface EnhancedChatInputProps {
  onSendMessage: (message: string, tableSearchSettings?: any) => void;
  isLoading?: boolean;
  placeholder?: string;
  tableSearchEnabled?: boolean;
  onTableSearchToggle?: (enabled: boolean) => void;
  className?: string;
}

export function EnhancedChatInput({
  onSendMessage,
  isLoading = false,
  placeholder = "Ask a question about your data...",
  tableSearchEnabled = false,
  onTableSearchToggle,
  className = ""
}: EnhancedChatInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { settings, updateSettings, getApiParams, getPerformanceLevel, isLoaded } = useTableSearchSettings();

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading) {
      // Pass table search settings if enabled
      const searchParams = tableSearchEnabled ? getApiParams() : undefined;
      onSendMessage(message.trim(), searchParams);
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const getPerformanceIcon = () => {
    const level = getPerformanceLevel();
    switch (level) {
      case 'fast': return <Zap className="w-3 h-3" />;
      case 'balanced': return <Database className="w-3 h-3" />;
      case 'thorough': return <Database className="w-3 h-3" />;
      case 'intensive': return <Clock className="w-3 h-3" />;
    }
  };

  const getPerformanceColor = () => {
    const level = getPerformanceLevel();
    switch (level) {
      case 'fast': return 'bg-green-500';
      case 'balanced': return 'bg-blue-500';
      case 'thorough': return 'bg-orange-500';
      case 'intensive': return 'bg-red-500';
    }
  };

  const getEstimatedTime = () => {
    const level = getPerformanceLevel();
    switch (level) {
      case 'fast': return '1-2 seconds';
      case 'balanced': return '3-5 seconds';
      case 'thorough': return '5-10 seconds';
      case 'intensive': return '10+ seconds';
    }
  };

  if (!isLoaded) {
    return <div className="animate-pulse h-20 bg-muted rounded-lg" />;
  }

  return (
    <TooltipProvider>
      <div className={`space-y-3 ${className}`}>
        {/* Performance Warning for Intensive Searches */}
        {tableSearchEnabled && getPerformanceLevel() === 'intensive' && (
          <Alert>
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>
              Current table search settings may result in slower response times ({getEstimatedTime()}). 
              Consider using a lower search intensity for faster results.
            </AlertDescription>
          </Alert>
        )}

        {/* Main Input Area */}
        <form onSubmit={handleSubmit} className="relative">
          <div className="flex gap-2">
            {/* Message Input */}
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={isLoading}
                className="min-h-[60px] max-h-[200px] resize-none pr-12"
                rows={1}
              />
              
              {/* Send Button */}
              <Button
                type="submit"
                size="sm"
                disabled={!message.trim() || isLoading}
                className="absolute right-2 bottom-2"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>

            {/* Table Search Settings */}
            {tableSearchEnabled && (
              <div className="flex flex-col gap-2">
                <TableSearchSettingsModal
                  currentSettings={settings}
                  onSettingsChange={updateSettings}
                >
                  <Button variant="outline" size="sm" className="h-fit">
                    <Settings className="w-4 h-4 mr-2" />
                    Table Settings
                  </Button>
                </TableSearchSettingsModal>

                {/* Performance Indicator */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <div className={`w-2 h-2 rounded-full ${getPerformanceColor()}`} />
                      {getPerformanceIcon()}
                      <span className="capitalize">{getPerformanceLevel()}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="space-y-1">
                      <p><strong>Search Mode:</strong> {settings.searchMode}</p>
                      <p><strong>Tables:</strong> {settings.maxTablesSearched}</p>
                      <p><strong>Rows/Table:</strong> {settings.maxRowsPerTable}</p>
                      <p><strong>Est. Time:</strong> {getEstimatedTime()}</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>
        </form>

        {/* Status Indicators */}
        {tableSearchEnabled && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Database className="w-3 h-3" />
            <span>Table search enabled</span>
            <Badge variant="secondary" className="text-xs">
              {settings.maxTablesSearched}×{settings.maxRowsPerTable} = {(settings.maxTablesSearched * settings.maxRowsPerTable).toLocaleString()} data points
            </Badge>
            {settings.enableSemanticMatching && (
              <Badge variant="outline" className="text-xs">
                Smart matching
              </Badge>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

export default EnhancedChatInput;
