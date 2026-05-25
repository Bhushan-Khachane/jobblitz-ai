import health from "./health";
import jobs from "./jobs";
import applications from "./applications";
import approvals from "./approvals";
import resumes from "./resumes";
import research from "./research";
import users from "./users";
import dashboard from "./dashboard";

export const routers = {
  health,
  jobs,
  applications,
  approvals,
  resumes,
  research,
  users,
  dashboard,
};

export type AppRouters = typeof routers;
