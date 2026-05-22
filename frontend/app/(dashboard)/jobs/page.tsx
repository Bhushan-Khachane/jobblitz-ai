import JobRecommendationsPage from "@/components/jobs/JobRecommendationsPage";

export const metadata = {
  title: "Job Recommendations — JobBlitz",
};

export default function JobsPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <JobRecommendationsPage />
    </div>
  );
}
