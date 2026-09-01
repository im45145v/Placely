export function getAuthRedirectReason(user) {
  if (!user) {
    return "account_not_provisioned";
  }
  if (!user.isActive) {
    return "inactive_user";
  }
  return null;
}
