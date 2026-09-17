"use client"

import React, { useCallback, useState } from 'react'
import { CodePanel } from './CodePanel'
import { FileData, StatusStep } from '@/types/workspace';

const WorkspaceClient = () => {
    const [fileData, setFileData] = useState<FileData | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [statusLog, setStatusLog] = useState<StatusStep[]>([]);

    const handleFilePatch = useCallback((patches: FileData) => {
        setFileData(patches);
    }, []);
    
  return (
    <div className='flex h-[calc(100vh-4rem)] overflow-hidden bg-[#0a0a0a]'>
        {/*Chat panel - left */}
        <div className='w-[320px] shrink-0 border-r border-white/60 bg-[#0d0d0d] flex items-center justify-center'>
        <p className='text-xs text-white/20'>Chat panel coming soon</p>
        </div>

        {/*code panel - right*/}
        <CodePanel fileData={fileData}
        isGenerating={isGenerating}
        statusLog={statusLog}
        onFilePatch={handleFilePatch}/>
    </div>

  )
}

export default WorkspaceClient