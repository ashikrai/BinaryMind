import { Link, Outlet } from "react-router-dom";
import { APP_NAME } from "@/constants";

import bg from "../media/images/BMind.png"

export function AuthLayout() {
  return (
    <div className="grid min-h-dvh grid-cols-1 md:grid-cols-2">
      <div className="hidden items-center justify-center bg-primary/5 p-12 md:flex">
        <div className="max-w-md space-y-6">
          {/* <img src={bg}/> */}
          <Link to="/" className="font-serif text-3xl font-bold">
            {APP_NAME}
          </Link>
          <h2 className="font-serif text-4xl leading-tight">
            Human stories & ideas — read, write, and share what matters.
          </h2>
          <p className="text-muted-foreground">
            Discover thoughtful writing on the topics you care about, from voices you won't hear
            anywhere else. <br/>
            Read all bits of Binary Mind 😜
          </p>
        <img src={bg}/>
        </div>
      </div>
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
