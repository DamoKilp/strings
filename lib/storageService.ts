// /lib/storageService.ts
'use client'; // This service will be used client-side

import { createClient } from '@/utils/supabase/client'; // Client-side Supabase client
import type { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs

import type {
  IStorageService,
  ConversationSummary,
  Conversation,
  ChatMessage,
  MessageRole,
} from './types';

// Constants for localStorage keys and pagination
const LOCAL_STORAGE_PREFIX = 'strings_local_conversations_';
const MAX_LOCAL_STORAGE_SIZE = 5 * 1024 * 1024; // Example: 5MB limit check
const CONVERSATION_PAGE_LIMIT = 30; // Define a page size

export class StorageService implements IStorageService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient() as unknown as SupabaseClient;
  }

  // --- Private Helper Methods ---

  private getLocalStorageKey(userId: string): string {
    return `${LOCAL_STORAGE_PREFIX}${userId}`;
  }
  // Migrate older conversation records to backfill modelUsed from deprecated "model" field if available.
  private migrateConversation(item: unknown): void {
    const rec = item as { modelUsed?: unknown; model?: unknown };
    if (!rec.modelUsed && rec.model) {
      rec.modelUsed = rec.model;
    }
  }
  // Improved local conversation retrieval with robust date parsing, validation, and migration
  private async getLocalConversations(userId: string): Promise<Conversation[]> {
    if (typeof window === 'undefined') return [];
    const key = this.getLocalStorageKey(userId);
    
    try {
      const storedData = localStorage.getItem(key);
      if (!storedData) {
        return [];
      }

      // Attempt to parse the stored data
      const parsedData = JSON.parse(storedData);
      // Basic validation: check if it's an array
      if (!Array.isArray(parsedData)) {
        localStorage.removeItem(key);
        return [];
      }

      const conversations: Conversation[] = [];
      for (const item of parsedData) {
        // Perform migration if needed
        this.migrateConversation(item);
        // Validate basic structure (presence of id, userId, createdAt, updatedAt, messages)
        if (
          !item ||
          typeof item !== 'object' ||
          typeof item.id !== 'string' ||
          !item.createdAt ||
          !item.updatedAt ||
          !Array.isArray(item.messages)
        ) {
          continue; // Skip invalid item
        }

        // Parse dates robustly
        const createdAt = new Date(item.createdAt);
        const updatedAt = new Date(item.updatedAt);
        // If dates are invalid, default to now
        if (isNaN(createdAt.getTime())) {
          item.createdAt = new Date();
        } else {
          item.createdAt = createdAt;
        }
        if (isNaN(updatedAt.getTime())) {
          item.updatedAt = new Date();
        } else {
          item.updatedAt = updatedAt;
        }
        // Ensure all messages have valid dates and required fields
        item.messages.forEach((msgCandidate: unknown) => {
          const msg = msgCandidate as Partial<ChatMessage> & Record<string, unknown>;
          if (!msg || typeof msg !== 'object' || !msg.createdAt) {
            msg.createdAt = new Date();
            return;
          }
          const msgDate = new Date(msg.createdAt as Date | string);
          if (isNaN(msgDate.getTime())) {
            msg.createdAt = new Date();
          } else {
            msg.createdAt = msgDate;
          }
          // Ensure essential message fields
          msg.id = (msg.id as string | undefined) || this.generateLocalId();
          msg.role = (msg.role as MessageRole | undefined) || 'assistant';
          msg.content = (msg.content as string | undefined) || '';
          msg.conversationId = (msg.conversationId as string | undefined) || item.id;
          msg.userId = (msg.userId as string | undefined) || userId;
        });

        // Sort messages by createdAt to ensure correct order
        const sortedMessages = (item.messages as ChatMessage[]).sort((a, b) => {
          const aTime = a.createdAt instanceof Date && !isNaN(a.createdAt.getTime()) 
            ? a.createdAt.getTime() 
            : new Date(a.createdAt as unknown as string | number).getTime();
          const bTime = b.createdAt instanceof Date && !isNaN(b.createdAt.getTime()) 
            ? b.createdAt.getTime() 
            : new Date(b.createdAt as unknown as string | number).getTime();
          
          // Primary sort: by timestamp (ascending - oldest first)
          if (aTime !== bTime) {
            return aTime - bTime;
          }
          
          // Secondary sort: by message ID for stable sorting when timestamps are equal
          return (a.id || '').localeCompare(b.id || '');
        });

        // Assign defaults and ensure consistency
        const conversation: Conversation = {
          ...item,
          id: item.id,
          title: item.title || 'Untitled Local Chat',
          createdAt: item.createdAt, // Already parsed Date object
          updatedAt: item.updatedAt, // Already parsed Date object
          userId: item.userId || userId,
          isLocal: true,
          messages: sortedMessages,
          modelUsed: item.modelUsed || null,
        };
        conversations.push(conversation);
      }
      return conversations;
    } catch (error) {
      if (error instanceof SyntaxError) {
        localStorage.removeItem(key);
      }
      return [];
    }
  }

  // Improved save with size check
  private async saveLocalConversations(userId: string, conversations: Conversation[]): Promise<void> {
    if (typeof window === 'undefined') return;
    const key = this.getLocalStorageKey(userId);
    try {
      conversations.forEach(conv => {
        conv.isLocal = true;
        conv.userId = userId;
        conv.title = conv.title || 'Untitled Local Chat';
        conv.createdAt = conv.createdAt instanceof Date && !isNaN(conv.createdAt.getTime()) ? conv.createdAt : new Date();
        conv.updatedAt = conv.updatedAt instanceof Date && !isNaN(conv.updatedAt.getTime()) ? conv.updatedAt : new Date();
        // Ensure modelUsed is preserved; if missing, keep null.
        conv.modelUsed = conv.modelUsed || null;

        conv.messages.forEach(msg => {
          msg.id = msg.id || this.generateLocalId();
          msg.conversationId = conv.id;
          msg.userId = userId;
          msg.createdAt = msg.createdAt instanceof Date && !isNaN(msg.createdAt.getTime()) ? msg.createdAt : new Date();
          msg.role = msg.role || 'assistant';
          msg.content = msg.content ?? '';
        });
        
        // Sort messages by createdAt before saving to ensure consistent order
        conv.messages.sort((a, b) => {
          const aTime = a.createdAt instanceof Date && !isNaN(a.createdAt.getTime()) 
            ? a.createdAt.getTime() 
            : new Date(a.createdAt as unknown as string | number).getTime();
          const bTime = b.createdAt instanceof Date && !isNaN(b.createdAt.getTime()) 
            ? b.createdAt.getTime() 
            : new Date(b.createdAt as unknown as string | number).getTime();
          
          if (aTime !== bTime) {
            return aTime - bTime;
          }
          
          // Stable sort by ID when timestamps are equal
          return (a.id || '').localeCompare(b.id || '');
        });
      });
      const dataToStore = JSON.stringify(conversations);
      if (dataToStore.length > MAX_LOCAL_STORAGE_SIZE) {
        // Data size warning - could add custom handling here
      }
      localStorage.setItem(key, dataToStore);
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        alert("Local storage limit reached! Cannot save further changes locally. Please delete some older conversations.");
      } else {
        alert("An error occurred while trying to save conversations locally.");
      }
      throw error;
    }
  }

  public generateLocalId(): string {
    return `local_${uuidv4()}`;
  }

  // --- Public Interface Methods ---

  // *** MODIFIED getConversationList for Pagination ***
  async getConversationList(
    userId: string,
    cursor?: string | null, // Expects an ISO 8601 timestamp string
    limit: number = CONVERSATION_PAGE_LIMIT // Default limit
  ): Promise<{ items: ConversationSummary[], nextCursor: string | null }> {
    
    let localSummaries: ConversationSummary[] = [];
    let remoteSummaries: ConversationSummary[] = [];
    let nextCursor: string | null = null;

    // 1. Fetch Local (only needed for the initial load)
    if (!cursor) { // Only fetch locals on the first page request
        try {
            const localConvos = await this.getLocalConversations(userId);
            localSummaries = localConvos.map(c => ({
                id: c.id,
                title: c.title || 'Untitled Local Chat',
                createdAt: c.createdAt,
                updatedAt: c.updatedAt,
                userId: c.userId,
                isLocal: true,
                modelUsed: c.modelUsed,
                firstMessagePreview: typeof c.messages[0]?.content === 'string' ? c.messages[0].content : null,
            }));            
        } catch {
            // Failed to get or process local conversations
        }
    }

    // 2. Fetch Remote (Paginated)
    try {
      
      let query = this.supabase
        .from('conversations')
        .select('id, title, created_at, updated_at, user_id, model_used')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false }) // Order by most recent first
        .limit(limit);
      // Apply cursor if provided (fetch items OLDER than the cursor's timestamp)
      if (cursor) {
        query = query.lt('updated_at', cursor);
      }
      const { data: remoteConvosData, error: remoteError } = await query;

      if (remoteError) {
        remoteSummaries = []; // Reset on error
      } else if (remoteConvosData) {
        remoteSummaries = remoteConvosData.map(c => ({
          id: c.id,
          title: c.title || 'Untitled Cloud Chat',
          createdAt: new Date(c.created_at),
          updatedAt: new Date(c.updated_at), // Keep as Date object for sorting
          userId: c.user_id,
          isLocal: false,
          modelUsed: c.model_used,
          firstMessagePreview: 'Cloud message preview TBD',
        }));
        // Determine the next cursor if a full page was fetched
        if (remoteSummaries.length === limit) {
          const lastItem = remoteSummaries[remoteSummaries.length - 1];
          nextCursor = lastItem.updatedAt.toISOString(); // Use ISO string for cursor
        } else {
          nextCursor = null; // No more remote items to fetch
        }
      }
    } catch {
      remoteSummaries = []; // Reset on error
    }

    // 3. Prepare return value based on whether it's an initial load or subsequent page
    let finalItems: ConversationSummary[];
    if (!cursor) {
      // Initial load: merge local + first page remote, then sort
      finalItems = [...localSummaries, ...remoteSummaries];
      // Sort the combined initial list by updatedAt descending
      finalItems.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      
    } else {
      // Subsequent load: return ONLY the newly fetched remote items
      // The provider will append these to the existing list.
      finalItems = remoteSummaries;
      
    }

    return { items: finalItems, nextCursor: nextCursor };
  }

  // getConversation: Retrieves a single conversation and maps model_used if remote.
  async getConversation(id: string, userId: string): Promise<Conversation | null> {
    
    try {
      
      const localConvos = await this.getLocalConversations(userId);
      const localConversation = localConvos.find(c => c.id === id);
      if (localConversation) {
        // Ensure messages are sorted by createdAt (should already be sorted, but double-check)
        const sortedMessages = [...localConversation.messages].sort((a, b) => {
          const aTime = a.createdAt instanceof Date && !isNaN(a.createdAt.getTime()) 
            ? a.createdAt.getTime() 
            : new Date(a.createdAt as unknown as string | number).getTime();
          const bTime = b.createdAt instanceof Date && !isNaN(b.createdAt.getTime()) 
            ? b.createdAt.getTime() 
            : new Date(b.createdAt as unknown as string | number).getTime();
          
          if (aTime !== bTime) {
            return aTime - bTime;
          }
          
          // Stable sort by ID when timestamps are equal
          return (a.id || '').localeCompare(b.id || '');
        });
        
        return {
          ...localConversation,
          messages: sortedMessages,
        };
      }

      const { data: convoData, error: convoError } = await this.supabase
        .from('conversations')
        .select('*') // Includes model_used column
        .eq('id', id)
        .eq('user_id', userId)
        .maybeSingle();

      if (convoError) {
        return null;
      }
      if (!convoData) {
        return null;
      }
      
      const { data: messagesData, error: messagesError } = await this.supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true });

      if (messagesError) {
        return null;
      }
      
      const conversation: Conversation = {
        id: convoData.id,
        title: convoData.title || 'Untitled Cloud Chat',
        createdAt: new Date(convoData.created_at),
        updatedAt: new Date(convoData.updated_at),
        userId: convoData.user_id,
        isLocal: false,
        modelUsed: convoData.model_used, // Map from DB column
        messages: (messagesData || []).map((m): ChatMessage => ({
          id: m.id,
          role: m.role as MessageRole,
          content: m.content,
          createdAt: new Date(m.created_at),
          conversationId: m.conversation_id,
          userId: m.user_id,
          metadata: m.metadata,
          name: m.name,
          toolInvocations: m.tool_invocations,
          toolResult: m.tool_result,
        })),
      };
      if (isNaN(conversation.createdAt.getTime())) conversation.createdAt = new Date();
      if (isNaN(conversation.updatedAt.getTime())) conversation.updatedAt = new Date();
      conversation.messages.forEach(msg => {
        if (isNaN(msg.createdAt.getTime())) msg.createdAt = new Date();
      });      
      return conversation;
    } catch {
      return null;
    }
  }

  // *** MODIFIED createConversation ***
  async createConversation(
    userId: string,
    isLocal: boolean,
    title?: string,
    firstMessage?: Omit<ChatMessage, 'id' | 'conversationId' | 'createdAt' | 'userId'>,
    modelId?: string | null // ACCEPT modelId parameter
  ): Promise<ConversationSummary | null> {
    
      try {
      if (!modelId) {
        // No valid modelId provided - continuing with null
      }
      const now = new Date();
      const conversationTitle = title?.trim() || `Chat ${now.toLocaleString()}`;
      if (isLocal) {
        const localConvos = await this.getLocalConversations(userId);
        const newId = this.generateLocalId();
        const newConversation: Conversation = {
          id: newId,
          title: conversationTitle,
          createdAt: now,
          updatedAt: now,
          userId: userId,
          isLocal: true,
          modelUsed: modelId || null, // SAVE modelId here
          messages: firstMessage
            ? [
                {
                  ...firstMessage,
                  id: this.generateLocalId(),
                  conversationId: newId,
                  createdAt: now,
                  userId: userId,
                  role: firstMessage.role || 'user',
                  content: firstMessage.content || '',
                },
              ]
            : [],
        };        
        localConvos.push(newConversation);
        await this.saveLocalConversations(userId, localConvos);
        // Return conversation summary without messages
        return {
          id: newConversation.id,
          title: newConversation.title,
          createdAt: newConversation.createdAt,
          updatedAt: newConversation.updatedAt,
          userId: newConversation.userId,
          isLocal: newConversation.isLocal,
          modelUsed: newConversation.modelUsed,
        };
      } else {
        const insertData = {
          user_id: userId,
          title: conversationTitle,
          model_used: modelId || null, // SAVE modelId to DB column
        };
        const { data, error } = await this.supabase
          .from('conversations')
          .insert(insertData)
          .select('id, title, created_at, updated_at, user_id, model_used')
          .single();
        if (error) {
          return null;
        }
        if (!data) {
          return null;
        }
        const conversationId = data.id;        
        if (firstMessage) {
          const messageForDb: Omit<ChatMessage, 'id'> = {
            ...firstMessage,
            conversationId: conversationId,
            userId: userId,
            createdAt: now,
            role: firstMessage.role || 'user',
            content: firstMessage.content || '',
          };
          await this.addMessage(conversationId, messageForDb as ChatMessage, userId, false);
        }
        return {
          id: data.id,
          title: data.title || 'Untitled Cloud Chat',
          createdAt: new Date(data.created_at),          updatedAt: new Date(data.updated_at),
          userId: data.user_id,
          isLocal: false,
          modelUsed: data.model_used, // Ensure modelUsed is in the returned summary
        };
      }
    } catch {
      return null;
    }
  }
  // addMessage (Ensure data consistency, handle remote errors)
  async addMessage(
    conversationId: string,
    message: ChatMessage,
    userId: string,
    isLocal: boolean
  ): Promise<void> {
    const now = new Date();
    // Use the message's createdAt if valid, otherwise use current time
    // For local messages, ensure we have a valid timestamp
    let messageCreatedAt: Date;
    if (message.createdAt instanceof Date && !isNaN(message.createdAt.getTime())) {
      messageCreatedAt = message.createdAt;
    } else if (message.createdAt) {
      const parsed = new Date(message.createdAt as string | number);
      messageCreatedAt = !isNaN(parsed.getTime()) ? parsed : new Date();
    } else {
      messageCreatedAt = new Date();
    }
    
    const messageToAdd: ChatMessage = {
      ...message,
      id: isLocal ? (message.id || this.generateLocalId()) : (message.id || uuidv4()),
      conversationId: conversationId,
      userId: userId,
      createdAt: messageCreatedAt,
      role: message.role || 'assistant',
      content: message.content ?? '',
      metadata: message.metadata,
    };      
      if (isLocal) {
        const localConvos = await this.getLocalConversations(userId);
        const convoIndex = localConvos.findIndex(c => c.id === conversationId);
        if (convoIndex !== -1) {
          if (localConvos[convoIndex].messages.some(m => m.id === messageToAdd.id)) {
            return;
          }
          localConvos[convoIndex].messages.push(messageToAdd);
          // Sort messages after adding to ensure correct order
          localConvos[convoIndex].messages.sort((a, b) => {
            const aTime = a.createdAt instanceof Date && !isNaN(a.createdAt.getTime()) 
              ? a.createdAt.getTime() 
              : new Date(a.createdAt as unknown as string | number).getTime();
            const bTime = b.createdAt instanceof Date && !isNaN(b.createdAt.getTime()) 
              ? b.createdAt.getTime() 
              : new Date(b.createdAt as unknown as string | number).getTime();
            
            if (aTime !== bTime) {
              return aTime - bTime;
            }
            
            // Stable sort by ID when timestamps are equal
            return (a.id || '').localeCompare(b.id || '');
          });
          localConvos[convoIndex].updatedAt = now;
          await this.saveLocalConversations(userId, localConvos);
        } else {
          // Local conversation not found to add message
        }
      } else {
        const messageToSave: Record<string, unknown> = {
          conversation_id: conversationId,
          user_id: userId,
          role: messageToAdd.role,
          content: messageToAdd.content,
          // Note: created_at is auto-generated by Supabase with default now()
          // We don't set it explicitly to avoid conflicts
          ...(messageToAdd.metadata !== null && messageToAdd.metadata !== undefined && { metadata: messageToAdd.metadata }),
          name: messageToAdd.name,
          tool_invocations: messageToAdd.toolInvocations,
          tool_result: messageToAdd.toolResult,        };
        Object.keys(messageToSave).forEach(key => messageToSave[key] === undefined && delete messageToSave[key]);
        const { error } = await this.supabase
          .from('messages')
          .insert(messageToSave)
          .select('id')
          .single();        
        if (error) {
          throw error;
        }
        await this.supabase.from('conversations').update({ updated_at: now.toISOString() }).eq('id', conversationId);      }
  }

  // deleteMessage: remove a message by id from a conversation
  async deleteMessage(
    conversationId: string,
    messageId: string,
    userId: string,
    isLocal: boolean
  ): Promise<void> {
    const now = new Date();
    if (isLocal) {
      const localConvos = await this.getLocalConversations(userId);
      const convoIndex = localConvos.findIndex(c => c.id === conversationId);
      if (convoIndex !== -1) {
        const before = localConvos[convoIndex].messages.length;
        localConvos[convoIndex].messages = localConvos[convoIndex].messages.filter(m => m.id !== messageId);
        if (localConvos[convoIndex].messages.length !== before) {
          localConvos[convoIndex].updatedAt = now;
          await this.saveLocalConversations(userId, localConvos);
        }
      }
      return;
    }

    const { error } = await this.supabase
      .from('messages')
      .delete()
      .eq('id', messageId)
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);
    if (error) throw error;
    await this.supabase.from('conversations').update({ updated_at: now }).eq('id', conversationId).eq('user_id', userId);
  }
  // updateConversationTitle (Improved safety)
  async updateConversationTitle(id: string, title: string, userId: string, isLocal: boolean): Promise<void> {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      throw new Error("Title cannot be empty.");
    }
    const now = new Date();
    if (isLocal) {
        // Local branch: read, update, and re-save localConversations.
        const localConvos = await this.getLocalConversations(userId);
        const convoIndex = localConvos.findIndex(c => c.id === id);
        if (convoIndex !== -1) {
          localConvos[convoIndex].title = trimmedTitle;
          localConvos[convoIndex].updatedAt = now;
          await this.saveLocalConversations(userId, localConvos);
        
        } 
      } else {
        // Remote branch: update via Supabase.
        const { error } = await this.supabase
          .from('conversations')
          .update({ title: trimmedTitle, updated_at: now.toISOString() })
          .eq('id', id)
          .eq('user_id', userId);
        if (error) {
          throw error;
        }
     
      }
  }
  // deleteConversation (Improved safety)
  async deleteConversation(id: string, userId: string, isLocal: boolean): Promise<void> {
   
    if (isLocal) {
        let localConvos = await this.getLocalConversations(userId);
        const initialLength = localConvos.length;
        localConvos = localConvos.filter(c => c.id !== id);
        if (localConvos.length < initialLength) {
          await this.saveLocalConversations(userId, localConvos);
           } else {
          // Local conversation not found for deletion
        }
      } else {
        const { error } = await this.supabase
          .from('conversations')
          .delete()
          .eq('id', id)
          .eq('user_id', userId);
        if (error) {
          throw error;
        }
       
      }
  }

  // *** NEW METHOD *** updateConversationModel
  async updateConversationModel(
    id: string,
    modelId: string,
    userId: string,
    isLocal: boolean
  ): Promise<void> {
   
    if (isLocal) {
      // Read entire array, update the specific conversation's modelUsed, then save back
      const key = this.getLocalStorageKey(userId);
      const storedData = localStorage.getItem(key);
      if (!storedData) {
        return;
      }
      const convos: Conversation[] = JSON.parse(storedData);
      const updatedConvos = convos.map(c => {
        if (c.id === id) {
          return { ...c, modelUsed: modelId, updatedAt: new Date() };
        }
        return c;
      });        
      await this.saveLocalConversations(userId, updatedConvos);
    } else {
      // Update in Supabase database
      const now = new Date();
      const { error } = await this.supabase
        .from('conversations')
        .update({ model_used: modelId, updated_at: now.toISOString() })
        .eq('id', id)
        .eq('user_id', userId);
      if (error) {
        throw error;
      }
    }
  }

  // --- Bulk Clear Operations (Add concurrent execution safety) ---
  async clearLocalConversations(userId: string): Promise<void> {
    if (typeof window === 'undefined') return;

    const key = this.getLocalStorageKey(userId);
    localStorage.removeItem(key);
  }

  async clearRemoteConversations(userId: string): Promise<void> {
   
    const { error } = await this.supabase
      .from('conversations')
      .delete()
      .eq('user_id', userId);
    if (error) {
      throw error;
    }
  }

  // Combined clear operation
  async clearAllConversations(userId: string, scope: 'local' | 'remote' | 'all'): Promise<void> {
   
    const promises: Promise<void>[] = [];
    if (scope === 'local' || scope === 'all') {
      promises.push(this.clearLocalConversations(userId));
    }
    if (scope === 'remote' || scope === 'all') {
      promises.push(this.clearRemoteConversations(userId));
    }
    const results = await Promise.allSettled(promises);
    results.forEach((result) => {
      if (result.status === 'rejected') {
        // capture failure but aggregate after loop
      }
    });
    if (results.some(r => r.status === 'rejected')) {
      throw new Error(
        `One or more clear operations failed during clearAllConversations (scope: ${scope})`
      );
    }
    
  }
}

// Export a singleton instance
export const storageService = new StorageService();

