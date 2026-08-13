import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/authStore";
import { useBlogs } from "@/features/blogs/blogStore";
import { toast } from "sonner";

export default function Write() {
  const user = useAuth((s) => s.session!.user);
  const create = useBlogs((s) => s.create);
  const nav = useNavigate();
  const created = useRef(false);

  useEffect(() => {
    if (created.current) return;
    created.current = true;

    create(user.id, user.name, user.avatar)
      .then((blog) => nav(`/edit/${blog.id}`, { replace: true }))
      .catch(() => toast.error("Failed to create story. Check your connection."));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
