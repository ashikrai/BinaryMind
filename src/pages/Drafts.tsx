import { Navigate } from "react-router-dom";
export default function Drafts() {
  return <Navigate to="/my-stories?tab=draft" replace />;
}
