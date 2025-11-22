// /components/chat/AgentManagerDialog.tsx
// Architecture note:
// - This dialog implements a two-pane Agent Manager.
// - Left pane: enabled agents with drag-and-drop reordering and enable/disable toggles.
// - Right pane: editor form to create or edit custom agents (name/description/content/icon/color) and delete.
// - State, optimistic updates, and API persistence are centralized in `useAgentManagerState`.
// - Integration: emits `agents-updated` window event after mutations so `ChatProvider` reloads data, keeping `AgentSelector` in sync.
'use client';

import React, { useEffect, useState } from 'react';
import { Dialog, DialogContentGlass, DialogHeaderGlass, DialogFooterGlass, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { AgentDefinition, AgentPreference } from '@/lib/types';
import { AgentManagerLayout } from '@/components/chat/agentManager/AgentManagerLayout';
import { EnabledAgentsList } from '@/components/chat/agentManager/EnabledAgentsList';
import { AgentEditorForm } from '@/components/chat/agentManager/AgentEditorForm';
import { useAgentManagerState } from '@/components/chat/agentManager/useAgentManagerState';
import { Button } from '@/components/ui/button';
import { Plus, BookOpen } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface AgentManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  builtins: Array<{ id: string; name: string; description: string; content: string }>; // from prePrompts
  initialCustomAgents?: AgentDefinition[];
  initialPreferences?: AgentPreference[];
}

// Minimal scaffold, actual data wiring will be added later
export function AgentManagerDialog({ open, onOpenChange, builtins, initialCustomAgents = [], initialPreferences = [] }: AgentManagerDialogProps) {
  // Architecture notes: Two-pane dialog shell. Left shows enabled agents with DnD reordering and toggle. Right provides editor for custom agents.
  // State and persistence are handled by useAgentManagerState to centralize optimistic updates and API calls.
  const manager = useAgentManagerState({ builtins, initialCustomAgents, initialPreferences });
  const { unifiedEnabledList, allUnifiedList, disabledList, selectByKey, selectedUnified, toggleEnabled, saveCustomAgent, deleteCustomAgent, customAgents } = manager;
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  useEffect(() => {
    const handler = () => onOpenChange(true);
    window.addEventListener('open-agent-manager', handler);
    return () => window.removeEventListener('open-agent-manager', handler);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContentGlass className="h-[90vh] max-h-[90vh]">
        <DialogHeaderGlass>
          <div className="flex items-center justify-between gap-3">
            <div>
              <DialogTitle className="text-lg sm:text-xl font-semibold glass-text-primary">
                Agent Manager
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm glass-text-secondary mt-1">
                Create and configure custom AI agents
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="glass"
                className="glass-small glass-interactive h-9 px-3 rounded-xl"
                onClick={() => setIsGuideOpen(true)}
              >
                <BookOpen className="mr-2 h-4 w-4" />
                How to create great agents
              </Button>
              <Button
                variant="glass"
                className="glass-small glass-interactive h-9 px-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 hover:from-blue-500/30 hover:to-blue-600/30"
                onClick={() => {
                  selectByKey(null);
                  try {
                    const el = document.getElementById('agent-create-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  } catch {}
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add New Agent
              </Button>
            </div>
          </div>
        </DialogHeaderGlass>
        
        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto min-h-0">
        <AgentManagerLayout
          left={(
            <EnabledAgentsList
              items={unifiedEnabledList.map((ua: { key: string; name: string; description: string; iconKey?: string; colorHex?: string }) => ({ key: ua.key, name: ua.name, description: ua.description, iconKey: ua.iconKey, colorHex: ua.colorHex }))}
              onToggle={(key: string, enabled: boolean) => toggleEnabled(key, enabled)}
              isEnabled={(key: string) => !!allUnifiedList.find((x: { key: string; isEnabled?: boolean }) => x.key === key)?.isEnabled}
              onSelect={(key: string) => selectByKey(key)}
              selectedKey={selectedUnified?.key || null}
            />
          )}
          right={(
            <div className="space-y-6">
              <div>
                <div className="rightpane-card-title mb-1">Available agents (disabled)</div>
                <div className="rightpane-card-subtitle mb-3">Enable by toggling or drag back in future iteration.</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {disabledList.map((ua) => (
                    <div key={ua.key} className="p-2 border rounded-md bg-background/60 flex items-center gap-2">
                      <span className="text-xs font-medium truncate flex-1">{ua.name}</span>
                      <button
                        className="text-xs underline"
                        onClick={() => toggleEnabled(ua.key, true)}
                        aria-label={`Enable ${ua.name}`}
                      >Enable</button>
                    </div>
                  ))}
                  {disabledList.length === 0 && (
                    <div className="text-xs text-muted-foreground">No disabled agents.</div>
                  )}
                </div>
              </div>

              <div>
                <div className="rightpane-card-title mb-1">Create or edit a custom agent</div>
                <div className="rightpane-card-subtitle mb-3">Full control over name, description, system prompt, icon and color.</div>
                <div id="agent-create-section" />
                {!selectedUnified && (
                  <AgentEditorForm
                    mode="create"
                    initial={null}
                    onCancel={() => selectByKey(allUnifiedList[0]?.key || '')}
                    onSave={async (p) => { await saveCustomAgent(p, true); }}
                  />
                )}
                {selectedUnified && selectedUnified.kind === 'custom' && (
                  <AgentEditorForm
                    key={selectedUnified.id}
                    mode="edit"
                    initial={{
                      id: selectedUnified.id,
                      name: selectedUnified.name,
                      description: selectedUnified.description,
                      iconKey: selectedUnified.iconKey,
                      colorHex: selectedUnified.colorHex,
                      content: (customAgents?.find((a) => a.id === selectedUnified.id)?.content) || ''
                    }}
                    onCancel={() => selectByKey(null)}
                    onSave={async (p) => { await saveCustomAgent(p, false); }}
                    onDelete={async () => { await deleteCustomAgent(selectedUnified.id); selectByKey(null); }}
                  />
                )}
                {selectedUnified && selectedUnified.kind === 'builtin' && (
                  <div className="space-y-3">
                    <div className="text-sm text-muted-foreground">
                      Built-in agent. You can enable/disable and reorder on the left. The system prompt below is read-only.
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">System Prompt (Read-only)</Label>
                      <Textarea 
                        value={selectedUnified.content || 'No content available'}
                        readOnly
                        className="min-h-96 font-mono text-xs bg-muted/30 cursor-default resize-none"
                        style={{ userSelect: 'text' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        />
        </div>
        
        {/* Footer */}
        <DialogFooterGlass>
          <Button 
            variant="glass" 
            onClick={() => onOpenChange(false)}
            className="glass-small glass-interactive px-6 rounded-xl"
          >
            Close
          </Button>
        </DialogFooterGlass>
        
        {/* Guidance Panel: Prompt engineering + advanced features */}
        <Sheet open={isGuideOpen} onOpenChange={setIsGuideOpen}>
          <SheetContent side="right" className="w-[90vw] sm:max-w-xl">
            <SheetHeader>
              <SheetTitle>How to create great agents</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-5 pr-1 custom-scrollbar overflow-y-auto h-[calc(100dvh-9rem)]">
              <section className="space-y-2">
                <h3 className="text-base font-semibold">Prompt engineering essentials (2025)</h3>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  <li><span className="font-medium">Define the outcome:</span> Clearly state the agent’s role, goal, audience, and constraints.</li>
                  <li><span className="font-medium">Be specific and structured:</span> Use sections like “Context”, “Task”, “Constraints”, “Output format”.</li>
                  <li><span className="font-medium">Provide canonical examples:</span> Add 1–3 short in-domain examples with expected outputs.</li>
                  <li><span className="font-medium">Set guardrails:</span> List do/don’t rules; prefer positive instructions.</li>
                  <li><span className="font-medium">Iterate:</span> Test, review outputs, and refine the prompt. Small edits can yield large gains.</li>
                </ul>
              </section>
              <section className="space-y-2">
                <h3 className="text-base font-semibold">Research‑backed techniques (2024–2025)</h3>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  <li><span className="font-medium">Self‑consistency decoding:</span> Generate multiple concise candidates, then synthesize a final answer. Boosts reliability without long chain‑of‑thought.</li>
                  <li><span className="font-medium">Chain‑of‑verification:</span> After answering, run a short verification pass (facts, units, citations). Improves factuality.</li>
                  <li><span className="font-medium">Decomposition:</span> Structure prompts as Plan → Solve → Review with brief steps; avoid exposing internal chains unnecessarily.</li>
                  <li><span className="font-medium">Tool‑use criteria:</span> Specify when to invoke calculator, vector search, or table search (e.g., “if calculation spans &gt;3 steps, use calculator”).</li>
                  <li><span className="font-medium">Style constraints:</span> Control tone, length, headings, and bullet density explicitly; modern LLMs follow these well.</li>
                </ul>
              </section>
              <section className="space-y-2">
                <h3 className="text-base font-semibold">Output formatting</h3>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  <li><span className="font-medium">Use concise headings and bullets:</span> Improves readability in chat.</li>
                  <li><span className="font-medium">Prefer deterministic formats:</span> Define JSON or markdown sections when the consumer is strict.</li>
                  <li><span className="font-medium">Avoid leaking chain-of-thought:</span> Ask for final reasoning summaries, not step-by-step internal thoughts.</li>
                </ul>
              </section>
              <section className="space-y-2">
                <h3 className="text-base font-semibold">Math and rendering</h3>
                <p className="text-sm">Math output rules are included automatically via the standardized tool-use preprompt. They match our renderer documented in <code>docs/components/math-rendering.md</code>. Key rules:</p>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  <li>Inline math: use \( ... \); display math: use \[ ... \].</li>
                  <li>Prefer matrix and aligned environments where appropriate.</li>
                  <li>Add a brief explanatory sentence after important formulas.</li>
                </ul>
              </section>
              <section className="space-y-2">
                <h3 className="text-base font-semibold">Vector search (knowledge grounding)</h3>
                <p className="text-sm">When your agent relies on external knowledge, instruct it to reference retrieved snippets. In chats, you can toggle vector search; your prompt can include guidance like:</p>
                <pre className="text-xs p-2 bg-muted rounded" style={{whiteSpace:'pre-wrap'}}>{`If vector search results are provided, cite them explicitly and prefer grounded answers over speculation.`}</pre>
                <p className="text-xs text-muted-foreground">Relevant modules: <code>lib/vector/vectorSearch.ts</code>, <code>app/api/ai-services/utils/enhancedVectorSearch.ts</code>.</p>
              </section>
              <section className="space-y-2">
                <h3 className="text-base font-semibold">Table search (structured data)</h3>
                <p className="text-sm">For structured data, prompts should specify how to use table search, summarizing and quoting relevant rows. In the app, users can toggle and configure table search limits.</p>
                <pre className="text-xs p-2 bg-muted rounded" style={{whiteSpace:'pre-wrap'}}>{`When table search results are included, summarize key fields, cite row counts, and avoid fabricating columns.`}</pre>
                <p className="text-xs text-muted-foreground">See <code>hooks/useTableSearchSettings.ts</code> and usage in <code>components/contexts/ChatProvider.tsx</code>.</p>
              </section>
              <section className="space-y-2">
                <h3 className="text-base font-semibold">Agent prompt template</h3>
                <pre className="text-xs p-3 bg-muted rounded" style={{whiteSpace:'pre-wrap'}}>{`ROLE: You are a [domain] assistant for [audience].
CONTEXT: [datasets, policies, constraints, tone]
TASKS:
  - Task 1 …
  - Task 2 …
RULES:
  - Prefer grounded answers (vector/table results when present)
  - Be concise; use headings and bullets
  - For math: use LaTeX (inline \( … \), display \[ … \])
  - After answering, perform a brief verification checklist (facts, units, citations)
OUTPUT FORMAT:
  - Sections: Summary, Details, Citations
  - Use markdown; include code blocks where appropriate
EXAMPLES:
  Q: …
  A: … (formatted as above)`}</pre>
              </section>
              <section className="space-y-2">
                <h3 className="text-base font-semibold">Pro tips</h3>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  <li>Pin critical rules near the top; models weigh earlier text more.</li>
                  <li>Use short, strong verbs; avoid ambiguous adjectives.</li>
                  <li>Keep prompts concise; use retrieval (vector/table) for large context.</li>
                  <li>For high‑stakes outputs, include a verification pass with a compact checklist.</li>
                </ul>
              </section>
            </div>
          </SheetContent>
        </Sheet>
      </DialogContentGlass>
    </Dialog>
  );
}

export default AgentManagerDialog;


