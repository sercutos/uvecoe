const ADMIN_ROLES = ["administrator", "superadmin"];

function roleNames(user) {
  if (!user) return [];
  if (Array.isArray(user.roles)) return user.roles.map(String);
  if (typeof user.roles === "string") return [user.roles];
  return [];
}

export function isSuperadminUser(user) {
  return user?.is_superadmin === true || roleNames(user).includes("superadmin");
}

export function isAdminUser(user) {
  const role = String(user?.role || "");
  return (
    isSuperadminUser(user) ||
    user?.is_admin === true ||
    roleNames(user).some((name) => ADMIN_ROLES.includes(name)) ||
    ADMIN_ROLES.includes(role)
  );
}

export function saveUserSession(user = {}) {
  const roles = roleNames(user);
  const role = user.role || roles[0] || "";
  const isSuperadmin = isSuperadminUser(user);
  const isAdmin = isAdminUser(user);
  const organizationId = user.id_organization ?? user.organization?.id ?? null;

  sessionStorage.setItem("user_email", user.email || "");
  sessionStorage.setItem(
    "user_role",
    String(role || (isAdmin ? "administrator" : "evaluador"))
  );
  sessionStorage.setItem("user_is_admin", isAdmin ? "true" : "false");
  sessionStorage.setItem("user_is_superadmin", isSuperadmin ? "true" : "false");
  sessionStorage.setItem(
    "user_org_id",
    organizationId === null || organizationId === undefined
      ? ""
      : String(organizationId)
  );
  sessionStorage.setItem(
    "user_org_name",
    user.organization?.name || user.organization_name || ""
  );
}

export function isAdminSession() {
  return sessionStorage.getItem("user_is_admin") === "true";
}

export function isSuperadminSession() {
  return (
    sessionStorage.getItem("user_is_superadmin") === "true" ||
    sessionStorage.getItem("user_role") === "superadmin"
  );
}

export function getSessionOrganizationId() {
  const value = sessionStorage.getItem("user_org_id");
  if (!value) return null;

  const id = Number(value);
  return Number.isFinite(id) ? id : null;
}
