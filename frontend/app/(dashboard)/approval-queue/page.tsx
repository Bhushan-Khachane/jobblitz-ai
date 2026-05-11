"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, Clock, Building2, MapPin, ExternalLink, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useApprovalQueue } from "@/hooks/useApprovalQueue";
import api from "@/lib/api";
import { formatDate, getPlatformBadgeColor } from "@/lib/utils";

interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string | null;
  platform: string;
  apply_url: string | null;
  salary: string | null;
  match_score: number | null;
  match_explanation: Record<string, any> | null;
}

export default function ApprovalQueuePage() {
  const { queue, loading, error, refetch, approve, reject } = useApprovalQueue();
  const [listings, setListings] = useState<Record<string, JobListing>>({});
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    const loadListings = async () => {
      try {
        const { data } = await api.get("/job-listings/", { params: { page_size: 200 } });
        const map: Record<string, JobListing> = {};
        (data.items || []).forEach((l: any) => {
          map[l.id] = l;
        });
        setListings(map);
      } catch {
        // ignore
      }
    };
    loadListings();
  }, []);

  const handleApprove = async (id: string) => {
    setActing(id);
    try {
      await approve(id);
    } finally {
      setActing(null);
    }
  };

  const handleReject = async (id: string) => {
    setActing(id);
    try {
      await reject(id);
    } finally {
      setActing(null);
    }
  };

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <XCircle className="w-12 h-12 text-red-400 mb-3" />
        <p className="text-muted-foreground font-medium">Failed to load approval queue</p>
        <p className="text-sm text-muted-foreground/70 mt-1">{error}</p>
        <Button variant="outline" className="mt-4" onClick={refetch}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Approval Queue</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review and approve job applications before they are submitted
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {queue.length} pending
        </Badge>
      </div>

      {queue.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <CheckCircle className="w-16 h-16 text-green-300 mb-4" />
          <p className="text-lg font-medium text-muted-foreground">All caught up!</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            No applications are waiting for your approval
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          <AnimatePresence>
            {queue.map((app) => {
              const listing = listings[app.job_listing_id];
              const isActing = acting === app.id;

              return (
                <motion.div
                  key={app.id}
                  initial={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        {/* Job info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-foreground truncate">
                              {listing?.title || "Unknown Position"}
                            </h3>
                            <Badge
                              variant="outline"
                              className={`text-[10px] shrink-0 ${getPlatformBadgeColor(listing?.platform || "")}`}
                            >
                              {listing?.platform || "—"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            {listing?.company && (
                              <span className="flex items-center gap-1">
                                <Building2 className="w-3.5 h-3.5" />
                                {listing.company}
                              </span>
                            )}
                            {listing?.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5" />
                                {listing.location}
                              </span>
                            )}
                          </div>

                          {/* Match score */}
                          {listing?.match_score != null && (
                            <div className="mt-2 flex items-center gap-2">
                              <div className="flex-1 max-w-32 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    listing.match_score >= 0.7
                                      ? "bg-green-500"
                                      : listing.match_score >= 0.4
                                        ? "bg-yellow-500"
                                        : "bg-red-400"
                                  }`}
                                  style={{ width: `${Math.round(listing.match_score * 100)}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground font-medium">
                                {Math.round(listing.match_score * 100)}% match
                              </span>
                            </div>
                          )}

                          {/* Salary */}
                          {listing?.salary && (
                            <p className="text-xs text-muted-foreground/70 mt-1">{listing.salary}</p>
                          )}

                          {/* Applied date */}
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70 mt-2">
                            <Clock className="w-3 h-3" />
                            <span>Queued {formatDate(app.created_at)}</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2 shrink-0">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            disabled={isActing}
                            onClick={() => handleApprove(app.id)}
                          >
                            {isActing ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle className="w-4 h-4" />
                            )}
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-400 border-red-500/20 hover:bg-red-500/10"
                            disabled={isActing}
                            onClick={() => handleReject(app.id)}
                          >
                            {isActing ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <XCircle className="w-4 h-4" />
                            )}
                            Skip
                          </Button>
                          {listing?.apply_url && (
                            <a
                              href={listing.apply_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary-500 hover:text-primary-500 text-center"
                            >
                              <ExternalLink className="w-3 h-3 inline mr-0.5" />
                              View job
                            </a>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}