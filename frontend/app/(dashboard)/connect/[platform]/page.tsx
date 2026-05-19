"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";

export default function PlatformConnectPage() {
  const params = useParams();
  const platform = params.platform as string;

  useEffect(() => {
    window.location.href = `/portals`;
  }, []);

  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-muted-foreground">Redirecting to portals...</div>
    </div>
  );
}
