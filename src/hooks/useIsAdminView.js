import { useMatch } from 'react-router-dom';

export function useIsAdminView() {
  return !!useMatch({ path: '/admin/*', end: false });
}
