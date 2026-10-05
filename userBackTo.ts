import { useLocation, useNavigate } from 'react-router-dom'

// Shared "go back" helper for pages that can be opened from more than one place.
//
// When a page is opened from the staff workspace, the workspace passes
// { backTo, companyId } in the navigation state. The back arrow then returns to the
// workspace. When there is no such state (company owners opening the page normally),
// it goes to the page's usual fallback, so existing behaviour does not change.
export function useBackTo(fallback = '/home') {
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state || {}) as { backTo?: string; companyId?: string }
  const goBack = () => navigate(state.backTo || fallback)
  return { goBack, backTo: state.backTo, companyId: state.companyId }
}
