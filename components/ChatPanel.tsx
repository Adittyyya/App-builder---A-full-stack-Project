"use client"

import { Message, StatusStep } from '@/types/workspace';
import React, { useRef, useState } from 'react'
import { BlueTitle } from './reusables';
import { PricingModal } from './PricingModal';
import { cn } from 'cn';

interface ChatPanelProps{
    messages: Message[];
    isGenerating: boolean;
    isImproving: boolean;
    statusLog: StatusStep[];
    credits: number;
    initialPrompt: string | null;
    onGenerate: (prompt: string, imageUrl?: string)=> Promise<void>;
    userId: string;
    workspaceId: string | null;
    appTitle: string | null;
}

const ChatPanel = ({
    messages,
    isGenerating,
    isImproving,
    statusLog,
    credits,
    initialPrompt,
    onGenerate,
    userId,
    workspaceId,
    appTitle,
}: ChatPanelProps) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const [input, setInput] = useState("");

    const hasAutoSubmittedRef = useRef(false);
    const noCredits = credits <= 0;
    const sanSubmit = input.trim().length > 0 && !isGenerating && !isImproving && !noCredits;
    

  return (
    <div className='flex w-[320px] shrink-0 flex-col bg-[#0d0d0d]'>
        <div className='flex items-center justify-between border-b border-white/6 px-4 py-3'>
        <BlueTitle>{appTitle}</BlueTitle>
        <PricingModal reason={noCredits > "credits" : "upgrade"}>
        <span 
        className={cn (
            "rounded-full px-2 py-0.5 text-[11px] transition-colors",
            noCredits
            ? "bg-red-500/15 text-red-400/80 hover:bg-red-500/25"
            : "bg-white/6 text-white/30 hover:bg-white/10 hover:text-white/50"
        )}
        >
            
        </span>    
        </PricingModal>  
        </div>
    </div>
  )
}

export default ChatPanel