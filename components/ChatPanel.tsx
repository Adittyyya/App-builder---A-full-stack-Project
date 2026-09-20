"use client"

import { Message, StatusStep } from '@/types/workspace';
import React, { useEffect, useRef, useState } from 'react'
import { BlueTitle } from './reusables';
import { PricingModal } from './PricingModal';
import { cn } from 'cn';
import { ArrowUp, Check, Loader2, Paperclip } from "lucide-react";
import Image from "next/image";
import { Button } from './ui/button';
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
    const canSubmit = input.trim().length > 0 && !isGenerating && !isImproving && !noCredits;
    
    const msgs = [
        {
            role: "user",
            content: "Build me a todo list app with dark themes",
        },
        {
            role: "assistant",
            content: "I've build a **Todo List app** with a clean dark theme. Here's what's included:\n\n-Add and delete todos\n- Mark todos as complete\n- Filter by All / Active / Completed\n- Smooth animations with framer-motion\n\nLet me know if you'd like any changes!",
        },
    ];

    const statuses = [
        {label: "Planning the component structure", status: "done"},
        {label: "Writing App.js and component", status: "done"},
        {label: "Validating packages...", status: "running"},
    ];

    useEffect(()=>{
        const el = textareaRef.current;
        if(!el) return;
        el.style.height = Math.min(el.scrollHeight, 160) + "px";
    }, [input]);

    useEffect(()=>{
        const el = scrollRef.current;
        if(!el) return;
        el.scrollTo({top: el.scrollHeight, behavior: "smooth"});
    }, [messages, isGenerating, isImproving]);

    useEffect(()=>{
        if(!initialPrompt || hasAutoSubmittedRef.current || messages.length > 0)
            return;
        hasAutoSubmittedRef.current = true;
        onGenerate(initialPrompt);
    }, []);

    const handleSubmit = async()=> {
        const trimmed = input.trim();
        if(!trimmed || isGenerating || isImproving || noCredits) return;
        setInput("");

        await onGenerate(trimmed);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if(e.key === "Enter" && !e.shiftKey){
            e.preventDefault();
            handleSubmit();
        }
    };

  return (
    <div className='flex w-[320px] shrink-0 flex-col bg-[#0d0d0d]'>
        <div className='flex items-center justify-between border-b border-white/6 px-4 py-3'>
        <BlueTitle>{appTitle}</BlueTitle>
        <PricingModal reason={noCredits ? "credits" : "upgrade"}>
        <span 
        className={cn (
            "rounded-full px-2 py-0.5 text-[11px] transition-colors",
            noCredits
            ? "bg-red-500/15 text-red-400/80 hover:bg-red-500/25"
            : "bg-white/6 text-white/30 hover:bg-white/10 hover:text-white/50"
        )}
        >
            {noCredits
            ? "No credits . upgrade"
            : `${credits} credit${credits !== 1 ? "s" : ""}`}
        </span>    
        </PricingModal>  
        </div>
        <div ref={scrollRef}
        className='flex-1 overflow-y-auto px-3 py-4 [&::-webkit-scrollbar]:hidden'>
            {messages.length === 0 && !isGenerating && (
                <div className='flex h-full items-center justify-center'>
                    <p className='text-center text-xs text-white/20'>
                    Describe what you want to build
                    </p>
                </div>
            )}

            <div className='space-y-4'>
                {messages.map((msg, i)=>(
                    <div key={i}>
                        {msg.role === "user" ? (
                            <div className='flex items-start justify-end gap-2'>
                                <div className='max-w-[85%] space-y-1.5'>
                                    <div className='rounded-2xl rounded-br-sm bg-white/10 px-3.5 py-3.5'>
                                    <p className='text-[13px] leading-relaxed text-white/80 wrap-break-word'>
                                    {msg.content}
                                    </p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className='flex items-start gap-2'>
                                <Image
                                    src = "/logo-short.jpeg"
                                    alt="Forge"
                                    width={24}
                                    height={24}
                                    className="mt-0.5 h-6 w-6 shrink-0 rounded-md"
                                />
                                <div className='min-w-0 rounded-2xl rounded-tl-sm bg-white/5 px-3.5 py-2.5'>
                                <p className='text-[13px] leading-relaxed text-white/70 wrap-break-word'>
                                {msg.content}
                                </p>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            

            {isGenerating && <div className='flex items-start gap-2'>
                <Image
                    src = "/logo-short.jpeg"
                    alt="Forge"
                    width={24}
                    height={24}
                    className="mt-0.5 h-6 w-6 shrink-0 rounded-md"
                />
                <div className='rounded-2xl rounded-tl-sm bg-white/5 px-3.5 py-3'>
                <div className='space-y-2'>
                    {statusLog.map((step, i)=>(
                        <div key={i} className='flex items-center gap-2.5'>
                            <div className='flex h-4 w-4 shrink-0 items-center justify-center'>
                                {step.status === "running" ? (
                                <Loader2 className='h-3 w-3 animate-spin text-blue-400/80'/>    
                                ): (
                                    <Check className='h-3 w-3 text-white/25'/>
                                )}
                            </div>
                            <span
                            className={cn(
                                "text-[12px] transition-colors duration-300",
                                step.status === "running"
                                    ? "text-white/75"
                                    : "text-white/25"
                            )}
                            >
                                {step.label}
                            </span>
                        </div>
                    ))}
                </div>
                </div>
            </div> }
            </div>
        </div>

        <div className='border-t border-white/6 p-3'>
        
        <div
        className={cn(
            "rounded-xl border bg-white/4 transition-colors",
            isGenerating || isImproving || noCredits
                ? "border-white/4 opacity-60"
                : "border-white/8 hover:border-white/12",
        )}
        >
            <textarea 
                ref={textareaRef}
                value={input}
                onChange={(e)=>setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isGenerating || isImproving || noCredits}
                placeholder={
                    noCredits
                    ? "Upgrade to keep building..."
                    : isImproving
                    ? "Cline is improving your app..."
                    : isGenerating
                    ? "Generating..."
                    :"Ask AI to modify..."
                }
                rows={1}
                className='w-full resize-none bg-transparent px-3.5 pb-2 pt-3 text-[13px] text-white/80 placeholder:text-white/20 focus:outline-none'
                style={{maxHeight: 160}}
            />

            <div className='flex items-center justify-between px-2 pb-2'>
                <Button
                variant="ghost"
                size="icon"
                disabled
                className="h-7 w-7 rounded-lg text-white/25 opacity-40"
                >
                    <Paperclip className='h-3.5 w-3.5'/>
                </Button>

                <Button
                size="icon"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={cn(
                    "h-7 w-7 rounded-lg transition-all",
                    canSubmit
                    ? "bg-white text-black hover:bg-white/90 active:scale-95"
                    : "bg-white/8 text-white/20 shadow-none"
                )}
                >
                    {isGenerating || isImproving ? (
                        <Loader2 className='h-3.5 w-3.5 animate-spin'/>
                    ) : (
                        <ArrowUp className='h-3.5 w-3.5'/>
                    )}
                </Button>
            </div>
        </div>
        </div>
    </div>
  )
}

export default ChatPanel