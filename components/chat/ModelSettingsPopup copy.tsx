// /components/chat/ModelSettingsPopup.tsx
'use client';

import React from 'react';
import './ModelSettingsPopup.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { RotateCcw, Thermometer, SlidersHorizontal, Repeat, Wand2, BrainCircuit } from 'lucide-react';
import { useChatContext } from '@/components/contexts/ChatProvider';
import {
    DEFAULT_TEMPERATURE, DEFAULT_TOP_P, DEFAULT_FREQUENCY_PENALTY,
    DEFAULT_PRESENCE_PENALTY, DEFAULT_REASONING_LEVEL, ReasoningLevel
} from '@/lib/types';
import { Separator } from '@/components/ui/separator';

interface ModelSettingsPopupProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ModelSettingsPopup({ open, onOpenChange }: ModelSettingsPopupProps) {
    const {
        temperature, topP, frequencyPenalty, presencePenalty, reasoningLevel,
        // --- MODIFIED: Destructure 'llmModel' instead of 'selectedModel' ---
        llmModel,
        // -----------------------------------------------------------------
        actions: {
            setTemperature, setTopP, setFrequencyPenalty, setPresencePenalty,
            setReasoningLevel,
            resetModelParameters
        }
    } = useChatContext();

    // --- MODIFIED: Check the correct model variable ---
    // Check if the current model supports reasoning controls
    const modelSupportsReasoning = (llmModel?.supportsReasoning || /^gpt-5/.test(llmModel?.id || '')) || false;
    // --------------------------------------------------

    // Helper to format slider value display
    const formatValue = (value: number) => value.toFixed(2);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="relative max-w-[min(90vw,56rem)] w-[90vw] h-auto max-h-[90vh] pb-4 overflow-hidden flex flex-col bg-transparent">
                <div className="absolute inset-0 -z-10 dialog-facade-bg" />
                <DialogHeader>
                    <DialogTitle>Model Parameters</DialogTitle>
                </DialogHeader>
                <div className="model-settings-container overflow-y-auto flex-1">
                    <div className="model-settings-content">
                        <div className="model-parameters-grid">
                        {/* Temperature Control */}
                        <div className="model-parameter-group temperature-group">
                            <Label htmlFor="temperature" className="model-parameter-label">
                                <div className="parameter-label-content">
                                    <Thermometer className="parameter-icon temperature-icon" />
                                    <span className="parameter-name">Creativity Level</span>
                                </div>
                                <span className="parameter-technical">Temperature</span>
                            </Label>
                            <div className="parameter-control-section">
                                <Slider 
                                    id="temperature" 
                                    value={[temperature]} 
                                    max={2} 
                                    min={0} 
                                    step={0.01} 
                                    onValueChange={(v) => setTemperature(v[0])} 
                                    className="model-slider temperature-slider" 
                                />
                                <span className="parameter-value">{formatValue(temperature)}</span>
                            </div>
                        </div>

                        {/* Top P Control */}
                        <div className="model-parameter-group top-p-group">
                            <Label htmlFor="top-p" className="model-parameter-label">
                                <div className="parameter-label-content">
                                    <SlidersHorizontal className="parameter-icon top-p-icon" />
                                    <span className="parameter-name">Openness to Ideas</span>
                                </div>
                                <span className="parameter-technical">Top P</span>
                            </Label>
                            <div className="parameter-control-section">
                                <Slider 
                                    id="top-p" 
                                    value={[topP]} 
                                    max={1} 
                                    min={0} 
                                    step={0.01} 
                                    onValueChange={(v) => setTopP(v[0])} 
                                    className="model-slider top-p-slider" 
                                />
                                <span className="parameter-value">{formatValue(topP)}</span>
                            </div>
                        </div>

                        {/* Frequency Penalty Control */}
                        <div className="model-parameter-group frequency-group">
                            <Label htmlFor="frequency-penalty" className="model-parameter-label">
                                <div className="parameter-label-content">
                                    <Repeat className="parameter-icon frequency-icon" />
                                    <span className="parameter-name">Vocabulary Richness</span>
                                </div>
                                <span className="parameter-technical">Frequency Penalty</span>
                            </Label>
                            <div className="parameter-control-section">
                                <Slider 
                                    id="frequency-penalty" 
                                    value={[frequencyPenalty]} 
                                    max={2} 
                                    min={-2} 
                                    step={0.01} 
                                    onValueChange={(v) => setFrequencyPenalty(v[0])} 
                                    className="model-slider frequency-slider" 
                                />
                                <span className="parameter-value">{formatValue(frequencyPenalty)}</span>
                            </div>
                        </div>

                        {/* Presence Penalty Control */}
                        <div className="model-parameter-group presence-group">
                            <Label htmlFor="presence-penalty" className="model-parameter-label">
                                <div className="parameter-label-content">
                                    <Wand2 className="parameter-icon presence-icon" />
                                    <span className="parameter-name">Expression Divergence</span>
                                </div>
                                <span className="parameter-technical">Presence Penalty</span>
                            </Label>
                            <div className="parameter-control-section">
                                <Slider 
                                    id="presence-penalty" 
                                    value={[presencePenalty]} 
                                    max={2} 
                                    min={0} 
                                    step={0.01} 
                                    onValueChange={(v) => setPresencePenalty(v[0])} 
                                    className="model-slider presence-slider" 
                                />
                                <span className="parameter-value">{formatValue(presencePenalty)}</span>
                            </div>
                        </div>

                        {/* Reasoning Level Control */}
                        {modelSupportsReasoning && (
                            <>
                                <Separator className="model-settings-separator" />
                                <div className="model-parameter-group reasoning-group">
                                    <Label className="reasoning-label">
                                        <div className="parameter-label-content">
                                            <BrainCircuit className="parameter-icon reasoning-icon" />
                                            <span className="parameter-name">Reasoning Effort</span>
                                        </div>
                                    </Label>
                                    <RadioGroup
                                        value={reasoningLevel}
                                        onValueChange={(value) => setReasoningLevel(value as ReasoningLevel)}
                                        className="reasoning-radio-group"
                                    >
                                        {(['off', 'low', 'medium', 'high'] as ReasoningLevel[]).map((level) => (
                                            <div key={level} className={`reasoning-option reasoning-${level}`}>
                                                <RadioGroupItem 
                                                    value={level} 
                                                    id={`reasoning-${level}`} 
                                                    className="reasoning-radio"
                                                />
                                                <Label 
                                                    htmlFor={`reasoning-${level}`} 
                                                    className="reasoning-option-label"
                                                >
                                                    {level}
                                                </Label>
                                            </div>
                                        ))}
                                    </RadioGroup>
                                    <p className="reasoning-description">
                                        Controls thinking time and computational effort. 'Off' uses model defaults.
                                    </p>
                                </div>
                            </>
                        )}
                        </div>
                    </div>

                    {/* Reset Button */}
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={resetModelParameters} 
                        className="model-settings-reset-btn"
                    >
                        <RotateCcw className="mr-2 h-4 w-4" /> 
                        Reset to Defaults
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}