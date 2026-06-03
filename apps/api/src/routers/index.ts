import health from "./health";
import jobs from "./jobs";
import applications from "./applications";
import approvals from "./approvals";
import resumes from "./resumes";
import research from "./research";
import users from "./users";
import dashboard from "./dashboard";
import memory from "./memory";
import observability from "./observability";
import ops from "./ops";
import admin from "./admin";

export const routers = {
  health,
  jobs,
  applications,
  approvals,
  resumes,
  research,
  users,
  dashboard,
  memory,
  observability,
  ops,
  admin,
};

export type AppRouters = typeof routers;
