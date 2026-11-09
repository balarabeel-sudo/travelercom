import { lazy, Suspense, useEffect, useState } from 'react'
import type { ComponentType } from 'react'
import { HashRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from './supabaseClient'
import PushNotificationSetup from './PushNotificationSetup'
import AppLockScreen from './AppLockScreen'
import SplashScreen from './splashScreen'
import AccountType from './AccountType'
import Login from './Login'
import CompanyLayout, { isCompanyDesktopPath } from './CompanyLayout'
import { UserShell } from './UserLayout'
import useIsDesktop from './useIsDesktop'
import PlatformGate from './PlatformGate'

// ---------------------------------------------------------------------------
// Speed: every page below is loaded only when it is opened (code splitting).
// Before this, the phone had to download ALL pages (admin, company, customer)
// before the first screen could appear. Now it downloads only what it needs.
// ---------------------------------------------------------------------------

// After a new deploy, an old open tab can ask for a page file that no longer exists.
// When that happens we reload once to pick up the new version instead of showing a blank screen.
function lazyPage<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const mod = await factory()
      try { sessionStorage.removeItem('tc-chunk-reload') } catch { /* ignore */ }
      return mod
    } catch (err) {
      let alreadyTried = false
      try { alreadyTried = sessionStorage.getItem('tc-chunk-reload') === '1' } catch { /* ignore */ }
      if (!alreadyTried) {
        try { sessionStorage.setItem('tc-chunk-reload', '1') } catch { /* ignore */ }
        window.location.reload()
        return new Promise<never>(() => { /* page is reloading */ })
      }
      try { sessionStorage.removeItem('tc-chunk-reload') } catch { /* ignore */ }
      throw err
    }
  })
}

const loadHome = () => import('./Home')
const loadUserHomeDesktop = () => import('./UserHomeDesktop')
const loadHotels = () => import('./Hotels')
const loadHotelDetails = () => import('./HotelDetails')
const loadServices = () => import('./Services')
const loadServiceDetails = () => import('./ServiceDetails')
const loadSearch = () => import('./Search')
const loadMyBookings = () => import('./MyBookings')
const loadAccount = () => import('./Account')
const loadFlights = () => import('./Flights')
const loadBus = () => import('./Bus')
const loadTrain = () => import('./Train')
const loadTours = () => import('./Tours')
const loadEventCenters = () => import('./EventCenters')
const loadVehicleRentals = () => import('./VehicleRentals')
const loadWallet = () => import('./Wallet')

const ForgotPassword = lazyPage(() => import('./ForgotPassword'))
const Register = lazyPage(() => import('./Ragister'))
const Home = lazyPage(loadHome)
const UserHomeDesktop = lazyPage(loadUserHomeDesktop)
const VerifyOTP = lazyPage(() => import('./VerifyOTP'))
const UploadDocs = lazyPage(() => import('./UploadDocs'))
const PendingApproval = lazyPage(() => import('./PendingApproval'))
const VerifyBooking = lazyPage(() => import('./VerifyBooking'))
const Account = lazyPage(loadAccount)
const AddListing = lazyPage(() => import('./AddListing'))
const AddHotelListing = lazyPage(() => import('./AddHotelListing'))
const AddTourListing = lazyPage(() => import('./AddTourListing'))
const AddEventCenterListing = lazyPage(() => import('./AddEventCenterListing'))
const MyListings = lazyPage(() => import('./MyListings'))
const Hotels = lazyPage(loadHotels)
const Wallet = lazyPage(loadWallet)
const HotelDetails = lazyPage(loadHotelDetails)
const BookingsManagement = lazyPage(() => import('./BookingsManagement'))
const ListingsManagement = lazyPage(() => import('./ListingsManagement'))
const Services = lazyPage(loadServices)
const ServiceDetails = lazyPage(loadServiceDetails)
const UpgradeBusinessSuite = lazyPage(() => import('./UpgradeBusinessSuite'))
const TermsAndConditions = lazyPage(() => import('./TermsAndConditions'))
const Search = lazyPage(loadSearch)
const GuestList = lazyPage(() => import('./GuestList'))
const CompanyMenu = lazyPage(() => import('./CompanyMenu'))
const InventoryManagement = lazyPage(() => import('./InventoryManagement'))
const InventoryDetail = lazyPage(() => import('./InventoryDetail'))
const Analytics = lazyPage(() => import('./Analytics'))
const Promotions = lazyPage(() => import('./Promotions'))
const Ratings = lazyPage(() => import('./Ratings'))
const CompanyProfile = lazyPage(() => import('./CompanyProfile'))
const CompanyStorefront = lazyPage(() => import('./CompanyStorefront'))
const PrivacyPolicy = lazyPage(() => import('./PrivacyPolicy'))
const Terms = lazyPage(() => import('./Terms'))
const CustomerPrivacyPolicy = lazyPage(() => import('./CustomerPrivacyPolicy'))
const CustomerTerms = lazyPage(() => import('./CustomerTerms'))
const CompanyTerms = lazyPage(() => import('./CompanyTerms'))
const About = lazyPage(() => import('./About'))
const Notifications = lazyPage(() => import('./Notifications'))
const Support = lazyPage(() => import('./Support'))
const Settings = lazyPage(() => import('./Settings'))
const CustomerSettings = lazyPage(() => import('./CustomerSettings'))
const AddGuest = lazyPage(() => import('./AddGuest'))
const FlightDetails = lazyPage(() => import('./FlightDetails'))
const MyBookings = lazyPage(loadMyBookings)
const Bus = lazyPage(loadBus)
const BusDetails = lazyPage(() => import('./BusDetails'))
const Train = lazyPage(loadTrain)
const TrainDetails = lazyPage(() => import('./TrainDetails'))
const Tours = lazyPage(loadTours)
const TourDetails = lazyPage(() => import('./TourDetails'))
const EventCenters = lazyPage(loadEventCenters)
const EventCenterDetails = lazyPage(() => import('./EventCenterDetails'))
const CreateRole = lazyPage(() => import('./CreateRole'))
const ManageRoles = lazyPage(() => import('./ManageRoles'))
const PermissionMatrix = lazyPage(() => import('./PermissionMatrix'))
const ActivityLog = lazyPage(() => import('./ActivityLog'))
const AdminDashboard = lazyPage(() => import('./AdminDashboard'))
const CompanyStaffAccess = lazyPage(() => import('./CompanyStaffAccess'))
const StaffDashboard = lazyPage(() => import('./StaffDashboard'))
const AcceptInvite = lazyPage(() => import('./AcceptInvite'))
const Flights = lazyPage(loadFlights)
const Profile = lazyPage(() => import('./Profile'))
const AddListingRouter = lazyPage(() => import('./AddListingRouter'))
const AddBusListing = lazyPage(() => import('./AddBusListing'))
const AddVehicleRentalListing = lazyPage(() => import('./AddVehicleRentalListing'))
const AddFlightListing = lazyPage(() => import('./AddFlightListing'))
const VehicleRentals = lazyPage(loadVehicleRentals)
const VehicleRentalDetails = lazyPage(() => import('./VehicleRentalDetails'))

// Start downloading the Home page right away (while the splash screen is showing),
// so Home appears instantly after the splash.
loadHome().catch(() => { /* the normal lazy load will retry when the page is opened */ })

// Quietly download the customer pages people open most, once the app is idle.
// Skipped on data-saver connections. Company accounts do not get these.
function preloadCustomerPages() {
  const conn = (navigator as any).connection
  if (conn && conn.saveData) return
  const loaders = [loadHotels, loadServices, loadSearch, loadHotelDetails, loadServiceDetails, loadMyBookings, loadAccount, loadFlights, loadBus, loadTrain, loadTours, loadEventCenters, loadVehicleRentals, loadWallet]
  loaders.forEach((load, i) => {
    setTimeout(() => { load().catch(() => { /* ignore, will load normally when opened */ }) }, 800 * (i + 1))
  })
}

function PageLoading() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{`@keyframes tc-page-spin { to { transform: rotate(360deg); } }`}</style>
      <span style={{
        display: 'inline-block', width: '26px', height: '26px', border: '3px solid #E2E8F0',
        borderTopColor: '#0EA5E9', borderRadius: '50%', animation: 'tc-page-spin 0.8s linear infinite',
      }} />
    </div>
  )
}

// Listens for the auth session created when an invited staff member clicks
// their invite email link, and routes them to the Accept Invite page.
function InviteRedirectListener() {
  const navigate = useNavigate()

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user?.user_metadata?.company_invite_id) {
        navigate('/accept-invite', { replace: true })
      }
    })
    return () => listener.subscription.unsubscribe()
  }, [navigate])

  return null
}

// /home is shared by every account type. On a computer, personal accounts get the
// desktop home page; company accounts and phones keep using Home (which already
// handles the company desktop dashboard and the phone layouts).
function HomeRoute() {
  const isDesktop = useIsDesktop()
  const [accountType, setAccountType] = useState<'personal' | 'company' | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAccountType(data.session?.user?.user_metadata?.account_type === 'company' ? 'company' : 'personal')
    })
  }, [])

  if (!isDesktop) return <Home />
  if (accountType === null) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B', fontSize: '14px' }}>
        Loading...
      </div>
    )
  }
  return accountType === 'personal' ? <UserHomeDesktop /> : <Home />
}

// Entry screens that use the full desktop width (splash, sign-up and login flow).
const AUTH_WIDE_PATHS = [
  '/',
  '/account-type',
  '/login',
  '/register',
  '/forgot-password',
  '/verify-otp',
  '/upload-docs',
  '/pending-approval',
]

function AppShell() {
  const isDesktop = useIsDesktop()
  const { pathname } = useLocation()
  // Company accounts get the wide desktop dashboard on /home too. /home is shared with
  // personal accounts, so the account type decides (read from the signed-in user).
  const [isCompanyAccount, setIsCompanyAccount] = useState(false)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setIsCompanyAccount(data.session?.user?.user_metadata?.account_type === 'company')
      // Signed-in personal users: quietly get the common pages ready in the background.
      if (data.session && data.session.user?.user_metadata?.account_type !== 'company') preloadCustomerPages()
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsCompanyAccount(session?.user?.user_metadata?.account_type === 'company')
    })
    return () => listener.subscription.unsubscribe()
  }, [])
  const wide = isDesktop && (isCompanyDesktopPath(pathname) || AUTH_WIDE_PATHS.includes(pathname) || pathname === '/staff-dashboard' || pathname === '/admin' || (isCompanyAccount && pathname === '/home'))

  return (
    <>
      <style>{`
        html, body { margin: 0; padding: 0; }
        .tc-app-shell { min-height: 100vh; background: transparent; }
        @media (min-width: 700px) {
          .tc-app-shell {
            display: flex;
            justify-content: center;
            align-items: flex-start;
            background: #0f172a;
            padding: 28px 0;
          }
          .tc-app-frame {
            width: 430px;
            min-height: calc(100vh - 56px);
            max-height: 900px;
            border-radius: 28px;
            overflow-y: auto;
            overflow-x: hidden;
            box-shadow: 0 20px 60px rgba(0,0,0,0.35);
            background: #F8FAFC;
          }
        }
        .tc-app-shell--wide {
          display: block;
          padding: 0;
          background: #F8FAFC;
          /* Pin the wide layout to the whole browser window so it never depends on the
             size of #root/body (those can shrink the page into a narrow centered column). */
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          left: 0;
          overflow-y: auto;
          overflow-x: hidden;
        }
        .tc-app-frame--wide {
          width: 100%;
          max-width: none;
          min-height: 100vh;
          max-height: none;
          border-radius: 0;
          overflow: visible;
          box-shadow: none;
        }
      `}</style>
      <div className={wide ? 'tc-app-shell tc-app-shell--wide' : 'tc-app-shell'}>
        <div className={wide ? 'tc-app-frame tc-app-frame--wide' : 'tc-app-frame'}>
          <InviteRedirectListener />
          <PushNotificationSetup />
          <AppLockScreen />
          <PlatformGate>
          <Suspense fallback={<PageLoading />}>
          <Routes>
            <Route path="/" element={<SplashScreen />} />
        <Route path="/account-type" element={<AccountType />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/register" element={<Register />} />
        <Route path="/home" element={<HomeRoute />} />
        <Route path="/verify-otp" element={<VerifyOTP />} />
        <Route path="/upload-docs" element={<UploadDocs />} />
        <Route path="/pending-approval" element={<PendingApproval />} />
        <Route path="/verify-booking" element={<CompanyLayout><VerifyBooking /></CompanyLayout>} />
        <Route path="/account" element={<UserShell><Account /></UserShell>} />
        <Route path="/profile" element={<UserShell><Profile /></UserShell>} />
        <Route path="/add-listing-router" element={<AddListingRouter />} />
        <Route path="/add-bus-listing" element={<CompanyLayout><AddBusListing /></CompanyLayout>} />
        <Route path="/add-listing" element={<CompanyLayout><AddListing /></CompanyLayout>} />
        <Route path="/add-hotel-listing" element={<CompanyLayout><AddHotelListing /></CompanyLayout>} />
        <Route path="/add-tour-listing" element={<CompanyLayout><AddTourListing /></CompanyLayout>} />
        <Route path="/add-event-center-listing" element={<CompanyLayout><AddEventCenterListing /></CompanyLayout>} />
        <Route path="/add-vehicle-rental-listing" element={<CompanyLayout><AddVehicleRentalListing /></CompanyLayout>} />
        <Route path="/add-flight-listing" element={<CompanyLayout><AddFlightListing /></CompanyLayout>} />
        <Route path="/my-listings" element={<CompanyLayout><MyListings /></CompanyLayout>} />
        <Route path="/hotels" element={<UserShell><Hotels /></UserShell>} />
        <Route path="/wallet" element={<UserShell><Wallet /></UserShell>} />
        <Route path="/hotels/:id" element={<UserShell><HotelDetails /></UserShell>} />
        <Route path="/bookings-management" element={<CompanyLayout><BookingsManagement /></CompanyLayout>} />
        <Route path="/listings-management" element={<CompanyLayout><ListingsManagement /></CompanyLayout>} />
        <Route path="/services/:category" element={<UserShell><Services /></UserShell>} />
        <Route path="/services/:category/:id" element={<UserShell><ServiceDetails /></UserShell>} />
        <Route path="/upgrade-business-suite" element={<CompanyLayout><UpgradeBusinessSuite /></CompanyLayout>} />
        <Route path="/payment-terms" element={<TermsAndConditions />} />
        <Route path="/search" element={<UserShell><Search /></UserShell>} />
        <Route path="/guests" element={<CompanyLayout><GuestList /></CompanyLayout>} />
        <Route path="/company-menu" element={<CompanyLayout><CompanyMenu /></CompanyLayout>} />
        <Route path="/inventory" element={<CompanyLayout><InventoryManagement /></CompanyLayout>} />
        <Route path="/inventory/:id" element={<CompanyLayout><InventoryDetail /></CompanyLayout>} />
        <Route path="/analytics" element={<CompanyLayout><Analytics /></CompanyLayout>} />
        <Route path="/promotions" element={<CompanyLayout><Promotions /></CompanyLayout>} />
        <Route path="/reviews" element={<CompanyLayout><Ratings /></CompanyLayout>} />
        <Route path="/company-profile" element={<CompanyLayout><CompanyProfile /></CompanyLayout>} />
        <Route path="/company/:id" element={<UserShell><CompanyStorefront /></UserShell>} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/customer-privacy" element={<CustomerPrivacyPolicy />} />
        <Route path="/customer-terms" element={<CustomerTerms />} />
        <Route path="/company-terms" element={<CompanyTerms />} />
        <Route path="/about" element={<About />} />
       <Route path="/notifications" element={<UserShell><Notifications /></UserShell>} />
       <Route path="/support" element={<UserShell><Support /></UserShell>} />
       <Route path="/settings" element={<CompanyLayout><Settings /></CompanyLayout>} />
        <Route path="/customer-settings" element={<UserShell><CustomerSettings /></UserShell>} />
        <Route path="/add-guest" element={<CompanyLayout><AddGuest /></CompanyLayout>} />
        <Route path="/flights" element={<UserShell><Flights /></UserShell>} />
        <Route path="/flight/:id" element={<UserShell><FlightDetails /></UserShell>} />
        <Route path="/bus" element={<UserShell><Bus /></UserShell>} />
        <Route path="/vehicle-rentals" element={<UserShell><VehicleRentals /></UserShell>} />
        <Route path="/vehicle-rentals/:id" element={<UserShell><VehicleRentalDetails /></UserShell>} />
        <Route path="/bus/:id" element={<UserShell><BusDetails /></UserShell>} />
        <Route path="/train" element={<UserShell><Train /></UserShell>} />
        <Route path="/train/:id" element={<UserShell><TrainDetails /></UserShell>} />
        <Route path="/tours" element={<UserShell><Tours /></UserShell>} />
        <Route path="/tour/:id" element={<UserShell><TourDetails /></UserShell>} />
        <Route path="/event-centers" element={<UserShell><EventCenters /></UserShell>} />
        <Route path="/event-center/:id" element={<UserShell><EventCenterDetails /></UserShell>} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/my-bookings" element={<UserShell><MyBookings /></UserShell>} />
        <Route path="/bookings" element={<UserShell><MyBookings /></UserShell>} />
        <Route path="/staff/create-role" element={<CompanyLayout><CreateRole onBack={() => window.history.back()} /></CompanyLayout>} />
        <Route path="/staff/manage-roles" element={<CompanyLayout><ManageRoles onBack={() => window.history.back()} onCreateRole={() => window.location.hash = '#/staff/create-role'} /></CompanyLayout>} />
        <Route path="/staff/permission-matrix" element={<CompanyLayout><PermissionMatrix onBack={() => window.history.back()} /></CompanyLayout>} />
        <Route path="/staff/activity-log" element={<CompanyLayout><ActivityLog onBack={() => window.history.back()} /></CompanyLayout>} />
        <Route path="/staff-dashboard" element={<StaffDashboard />} />
        <Route path="/staff" element={<CompanyLayout><CompanyStaffAccess onBack={() => window.history.back()} /></CompanyLayout>} />
        <Route path="/accept-invite" element={<AcceptInvite />} />
      </Routes>
          </Suspense>
          </PlatformGate>
        </div>
      </div>
    </>
  )
}

function App() {
  return (
    <Router>
      <AppShell />
    </Router>
  )
}

export default App
