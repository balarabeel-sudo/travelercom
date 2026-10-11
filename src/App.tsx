import { useEffect } from 'react'
import { HashRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from './supabaseClient'
import PushNotificationSetup from './PushNotificationSetup'
import AppLockScreen from './AppLockScreen'
import SplashScreen from './splashScreen'
import AccountType from './AccountType'
import Login from './Login'
import ForgotPassword from './ForgotPassword'
import Register from './Ragister'
import Home from './Home'
import VerifyOTP from './VerifyOTP'
import UploadDocs from './UploadDocs'
import PendingApproval from './PendingApproval'
import VerifyBooking from './VerifyBooking'
import Account from './Account'
import AddListing from './AddListing'
import AddHotelListing from './AddHotelListing'
import AddTourListing from './AddTourListing'
import AddEventCenterListing from './AddEventCenterListing'
import MyListings from './MyListings'
import Hotels from './Hotels'
import Wallet from './Wallet'
import HotelDetails from './HotelDetails'
import BookingsManagement from './BookingsManagement'
import ListingsManagement from './ListingsManagement'
import Services from './Services'
import ServiceDetails from './ServiceDetails'
import UpgradeBusinessSuite from './UpgradeBusinessSuite'
import TermsAndConditions from './TermsAndConditions'
import Search from './Search'
import GuestList from './GuestList'
import CompanyMenu from './CompanyMenu'
import InventoryManagement from './InventoryManagement'
import InventoryDetail from './InventoryDetail'
import Analytics from './Analytics'
import Promotions from './Promotions'
import Ratings from './Ratings'
import CompanyProfile from './CompanyProfile'
import CompanyStorefront from './CompanyStorefront'
import PrivacyPolicy from './PrivacyPolicy'
import Terms from './Terms'
import CustomerPrivacyPolicy from './CustomerPrivacyPolicy'
import CustomerTerms from './CustomerTerms'
import CompanyTerms from './CompanyTerms'
import About from './About'
import Notifications from './Notifications'
import Support from './Support'
import Settings from './Settings'
import CustomerSettings from './CustomerSettings'
import AddGuest from './AddGuest'
import FlightDetails from './FlightDetails'
import MyBookings from './MyBookings'
import Bus from './Bus'
import BusDetails from './BusDetails'
import Train from './Train'
import TrainDetails from './TrainDetails'
import Tours from './Tours'
import TourDetails from './TourDetails'
import EventCenters from './EventCenters'
import EventCenterDetails from './EventCenterDetails'
import CreateRole from './CreateRole'
import ManageRoles from './ManageRoles'
import PermissionMatrix from './PermissionMatrix'
import ActivityLog from './ActivityLog'
import AdminDashboard from './AdminDashboard'
import CompanyStaffAccess from './CompanyStaffAccess'
import StaffDashboard from './StaffDashboard'
import AcceptInvite from './AcceptInvite'
import Flights from './Flights'
import Profile from './Profile'
import AddListingRouter from './AddListingRouter'
import AddBusListing from './AddBusListing'
import AddVehicleRentalListing from './AddVehicleRentalListing'
import AddFlightListing from './AddFlightListing'
import VehicleRentals from './VehicleRentals'
import VehicleRentalDetails from './VehicleRentalDetails'
import CompanyLayout, { isCompanyDesktopPath } from './CompanyLayout'
import useIsDesktop from './useIsDesktop'

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

function AppShell() {
  const isDesktop = useIsDesktop()
  const { pathname } = useLocation()
  const wide = isDesktop && isCompanyDesktopPath(pathname)

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
          <Routes>
            <Route path="/" element={<SplashScreen />} />
        <Route path="/account-type" element={<AccountType />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/register" element={<Register />} />
        <Route path="/home" element={<Home />} />
        <Route path="/verify-otp" element={<VerifyOTP />} />
        <Route path="/upload-docs" element={<UploadDocs />} />
        <Route path="/pending-approval" element={<PendingApproval />} />
        <Route path="/verify-booking" element={<VerifyBooking />} />
        <Route path="/account" element={<Account />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/add-listing-router" element={<AddListingRouter />} />
        <Route path="/add-bus-listing" element={<AddBusListing />} />
        <Route path="/add-listing" element={<AddListing />} />
        <Route path="/add-hotel-listing" element={<AddHotelListing />} />
        <Route path="/add-tour-listing" element={<AddTourListing />} />
        <Route path="/add-event-center-listing" element={<AddEventCenterListing />} />
        <Route path="/add-vehicle-rental-listing" element={<AddVehicleRentalListing />} />
        <Route path="/add-flight-listing" element={<AddFlightListing />} />
        <Route path="/my-listings" element={<CompanyLayout><MyListings /></CompanyLayout>} />
        <Route path="/hotels" element={<Hotels />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/hotels/:id" element={<HotelDetails />} />
        <Route path="/bookings-management" element={<CompanyLayout><BookingsManagement /></CompanyLayout>} />
        <Route path="/listings-management" element={<CompanyLayout><ListingsManagement /></CompanyLayout>} />
        <Route path="/services/:category" element={<Services />} />
        <Route path="/services/:category/:id" element={<ServiceDetails />} />
        <Route path="/upgrade-business-suite" element={<UpgradeBusinessSuite />} />
        <Route path="/payment-terms" element={<TermsAndConditions />} />
        <Route path="/search" element={<Search />} />
        <Route path="/guests" element={<CompanyLayout><GuestList /></CompanyLayout>} />
        <Route path="/company-menu" element={<CompanyLayout><CompanyMenu /></CompanyLayout>} />
        <Route path="/inventory" element={<CompanyLayout><InventoryManagement /></CompanyLayout>} />
        <Route path="/inventory/:id" element={<CompanyLayout><InventoryDetail /></CompanyLayout>} />
        <Route path="/analytics" element={<CompanyLayout><Analytics /></CompanyLayout>} />
        <Route path="/promotions" element={<CompanyLayout><Promotions /></CompanyLayout>} />
        <Route path="/reviews" element={<Ratings />} />
        <Route path="/company-profile" element={<CompanyLayout><CompanyProfile /></CompanyLayout>} />
        <Route path="/company/:id" element={<CompanyStorefront />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/customer-privacy" element={<CustomerPrivacyPolicy />} />
        <Route path="/customer-terms" element={<CustomerTerms />} />
        <Route path="/company-terms" element={<CompanyTerms />} />
        <Route path="/about" element={<About />} />
       <Route path="/notifications" element={<Notifications />} />
       <Route path="/support" element={<Support />} />
       <Route path="/settings" element={<Settings />} />
        <Route path="/customer-settings" element={<CustomerSettings />} />
        <Route path="/add-guest" element={<AddGuest />} />
        <Route path="/flights" element={<Flights />} />
        <Route path="/flight/:id" element={<FlightDetails />} />
        <Route path="/bus" element={<Bus />} />
        <Route path="/vehicle-rentals" element={<VehicleRentals />} />
        <Route path="/vehicle-rentals/:id" element={<VehicleRentalDetails />} />
        <Route path="/bus/:id" element={<BusDetails />} />
        <Route path="/train" element={<Train />} />
        <Route path="/train/:id" element={<TrainDetails />} />
        <Route path="/tours" element={<Tours />} />
        <Route path="/tour/:id" element={<TourDetails />} />
        <Route path="/event-centers" element={<EventCenters />} />
        <Route path="/event-center/:id" element={<EventCenterDetails />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/my-bookings" element={<MyBookings />} />
        <Route path="/bookings" element={<MyBookings />} />
        <Route path="/staff/create-role" element={<CompanyLayout><CreateRole onBack={() => window.history.back()} /></CompanyLayout>} />
        <Route path="/staff/manage-roles" element={<CompanyLayout><ManageRoles onBack={() => window.history.back()} onCreateRole={() => window.location.hash = '#/staff/create-role'} /></CompanyLayout>} />
        <Route path="/staff/permission-matrix" element={<CompanyLayout><PermissionMatrix onBack={() => window.history.back()} /></CompanyLayout>} />
        <Route path="/staff/activity-log" element={<CompanyLayout><ActivityLog onBack={() => window.history.back()} /></CompanyLayout>} />
        <Route path="/staff-dashboard" element={<StaffDashboard />} />
        <Route path="/staff" element={<CompanyLayout><CompanyStaffAccess onBack={() => window.history.back()} /></CompanyLayout>} />
        <Route path="/accept-invite" element={<AcceptInvite />} />
      </Routes>
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
