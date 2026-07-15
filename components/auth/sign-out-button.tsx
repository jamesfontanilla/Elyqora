import { signOutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return <form action={signOutAction}><Button type="submit" variant="ghost" className="w-full justify-start px-3 text-[#667878]">Sign out</Button></form>;
}
