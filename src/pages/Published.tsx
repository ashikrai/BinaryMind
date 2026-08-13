import { Navigate } from "react-router-dom";
export default function Published() {
  return <Navigate to="/my-stories?tab=published" replace />;
}
