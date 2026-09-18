"use client";

import { FileData, StatusStep } from "@/types/workspace";
import { useEffect, useRef, useState } from "react";
import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackPreview,
  SandpackFileExplorer,
  useSandpack,
} from "@codesandbox/sandpack-react";
import { dracula } from "@codesandbox/sandpack-themes";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Code2, Eye } from "lucide-react";

const PLACEHOLDER_FILES = {
  "/App.js": {
    code: `export default function App() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0a",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "system-ui, sans-serif",
    }}>
      <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⚡</div>
        <p style={{ fontSize: 14 }}>Your app will appear here</p>
      </div>
    </div>
  );
}`,
  },
};


const BASE_DEPENDENCIES: Record<string, string> = {
  "react-is": "latest",
  "react-router-dom": "latest",
  "lucide-react": "latest",
  recharts: "latest",
  "date-fns": "latest",
  "framer-motion": "latest",
  "react-hook-form": "latest",
  "@hookform/resolvers": "latest",
  zod: "latest",
  "@radix-ui/react-dialog": "latest",
  "@radix-ui/react-dropdown-menu": "latest",
  "@radix-ui/react-tabs": "latest",
  "@radix-ui/react-tooltip": "latest",
  "@radix-ui/react-accordion": "latest",
  "@radix-ui/react-select": "latest",
  axios: "latest",
  clsx: "latest",
  "class-variance-authority": "latest",
  "tailwind-merge": "latest",
};


type ActiveTab = "preview" | "code";

interface CodePanelProps{
    fileData: FileData | null;
    isGenerating: boolean;
    statusLog: StatusStep[];
    onFilePatch: (patches: FileData) => void;
}

function SandpackInner({
    fileData,
    isGenerating,
    activeTab,
    setActiveTab
}: {
    fileData: FileData | null;
    isGenerating: boolean;
    activeTab: ActiveTab;
    setActiveTab: (t: ActiveTab) => void;
}){
    const {sandpack, listen} = useSandpack();


    const prevFilesRef = useRef<Record<string, { code: string}>> ({});
    useEffect(()=>{
        if(!fileData?.files) return;
        const prev = prevFilesRef.current;

        for(const [path, {code}] of Object.entries(fileData.files)){
            if(prev[path]?.code !== code){
                sandpack.updateFile(path, code);
            }
        }
        prevFilesRef.current = fileData.files;
    }, [fileData?.files]);



    return(
    <Tabs 
      value={activeTab}
      onValueChange={(v)=> setActiveTab(v as ActiveTab)}
      className="flex h-full flex-col gap-0"
    >
      <div className="flex items-center justify-between border-b border-white/6 px-2">
        <TabsList 
        variant="line"
        className="h-auto gap-0 rounded-none bg-transparent p-0"
        >
        <TabsTrigger className="border-b-2 pt-2" value="code">
          <Code2 className="h-3.5 w-3.5"/>
          Code
        </TabsTrigger>
        <TabsTrigger className="border-b-2 pt-2" value="preview">
          <Eye className="h-3.5 w-3.5"/>
          Preview
        </TabsTrigger>
        </TabsList>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {/* {1000: loading overlay} */}

        <SandpackLayout 
        style={{
          height: "100vh",
          border: "none",
          borderRadius: 0,
          background: "transparent",
        }}>

        <TabsContent
        value="preview"
        keepMounted
        className="mt-0 h-full w-full"
        >
          <SandpackPreview
          style={{height: "89%"}}
          showOpenInCodeSandbox={false}
          />
        </TabsContent>
        <TabsContent 
        value="code"
        keepMounted
        className="mt-0 h-full w-full"
        >
          <div style={{ display: "flex", height: "100%", width: "100%" }}>
          <SandpackFileExplorer
          style={{
            height: "90%",
            width: "190px",
            borderRight: "0.5px solid rgba(255, 255, 255, 0.08)",
          }}
          
          />
          <SandpackCodeEditor
          style={{height: "90%", flex: 1}}
          showTabs
          showLineNumbers
          showInlineErrors
          closableTabs
          readOnly
          />
          </div>
        </TabsContent>
        </SandpackLayout>
      </div>
        
    </Tabs>
    )
}

export function CodePanel({
    fileData,
    isGenerating,
    statusLog,
    onFilePatch: _onFilePatch, 
}: CodePanelProps){
    const [activeTab, setActiveTab] = useState<ActiveTab>("preview")

    const files = fileData?.files ?? PLACEHOLDER_FILES;

    const dependencies = {
        ...BASE_DEPENDENCIES,
        ...(fileData?.dependencies ?? {})
    };

    const filePathKey = Object.keys(files).sort().join("|");

    return(
         <div className="flex flex-1 flex-col overflow-hidden">
            <SandpackProvider key={filePathKey}
            template="react"
            theme={dracula}
            files={files}
            customSetup={{dependencies}}
            options={{
                externalResources: ["https://cdn.tailwindcss.com"],
                recompileMode: "delayed",
                recompileDelay: 500,
            }}
            >
                <SandpackInner 
                fileData={fileData}
                isGenerating = {isGenerating}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                />
            </SandpackProvider>
         </div>
    )
}