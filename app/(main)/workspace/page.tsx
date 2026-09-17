import WorkspaceClient from "@/components/WorkspaceClient";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import React from "react"

interface WorkspacePageProps {
  searchParams: Promise<{ prompt?: string; id?: string }>;
}

const WorkspacePage = async ({searchParams}: WorkspacePageProps) => {

  const user = await auth();
  if(!user) redirect("/");

  const {prompt, id} = await searchParams;


  return <WorkspaceClient/>
}

export default WorkspacePage