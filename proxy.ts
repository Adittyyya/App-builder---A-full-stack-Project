import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  const pathname = req.nextUrl.pathname;

  const isProtectedRoute =
    pathname.startsWith("/workspace") ||
    pathname.startsWith("/projects");

  if (isProtectedRoute && !userId) {
    const { redirectToSignIn } = await auth();
    return redirectToSignIn();  // ✅ actually call it
  }

  return NextResponse.next();
},
{
    signInUrl: "/auth/sign-in",
    signUpUrl: "/auth/sign-up",
  }
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/__clerk/:path*",
    "/(api|trpc)(.*)",
  ],
};