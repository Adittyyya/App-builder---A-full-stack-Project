import WorkspaceClient from "@/components/WorkspaceClient";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import React from "react"

interface WorkspacePageProps {
  searchParams: Promise<{ prompt?: string; id?: string }>;
}

const WorkspacePage = async ({searchParams}: WorkspacePageProps) => {

  const { userId }= await auth();
  if(!userId) redirect("/");

  const {prompt, id} = await searchParams;


  return <WorkspaceClient
  initialPrompt={prompt ?? null}
  userCredits={10}
  userId={userId}
  userPlan="free"
  />
}

export default WorkspacePage