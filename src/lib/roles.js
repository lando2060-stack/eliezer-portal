export const ROLES = {
  ADMIN: 'admin',
  AGENT: 'agent',
};

export function isAdmin(user) {
  return user?.role === 'admin';
}

export function isAgent(user) {
  return user?.role === 'agent';
}