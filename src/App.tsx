import { HashRouter as Router, Routes, Route } from 'react-router-dom'
import SplashScreen from './splashScreen'
import AccountType from './AccountType'
import Login from './Login'
import Register from './Ragister'
import Home from './Home'
import VerifyOTP from './VerifyOTP'
import UploadDocs from './UploadDocs'
import PendingApproval from './PendingApproval'
import VerifyBooking from './VerifyBooking'
import Account from './Account'
import AddListing from './AddListing'
import Hotels from './Hotels'
import Wallet from './Wallet'
import HotelDetails from './HotelDetails'
import BookingsManagement from './BookingsManagement'
import ListingsManagement from './ListingsManagement'
import Services from './Services'
import ServiceDetails from './ServiceDetails'
import BusinessSuite from './BusinessSuite'
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
import About from './About'
import Notifications from './Notifications'
import Support from './Support'
import Settings from './Settings'
import AddGuest from './AddGuest'
import FlightDetails from './FlightDetails'
import MyBookings from './MyBookings'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<SplashScreen />} />
        <Route path="/account-type" element={<AccountType />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/home" element={<Home />} />
        <Route path="/verify-otp" element={<VerifyOTP />} />
        <Route path="/upload-docs" element={<UploadDocs />} />
        <Route path="/pending-approval" element={<PendingApproval />} />
        <Route path="/verify-booking" element={<VerifyBooking />} />
        <Route path="/account" element={<Account />} />
        <Route path="/add-listing" element={<AddListing />} />
        <Route path="/hotels" element={<Hotels />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/hotels/:id" element={<HotelDetails />} />
        <Route path="/bookings-management" element={<BookingsManagement />} />
        <Route path="/listings-management" element={<ListingsManagement />} />
        <Route path="/services/:category" element={<Services />} />
        <Route path="/services/:category/:id" element={<ServiceDetails />} />
        <Route path="/business-suite" element={<BusinessSuite />} />
        <Route path="/guests" element={<GuestList />} />
        <Route path="/company-menu" element={<CompanyMenu />} />
        <Route path="/inventory" element={<InventoryManagement />} />
        <Route path="/inventory/:id" element={<InventoryDetail />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/promotions" element={<Promotions />} />
        <Route path="/reviews" element={<Ratings />} />
        <Route path="/company-profile" element={<CompanyProfile />} />
        <Route path="/company/:id" element={<CompanyStorefront />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/about" element={<About />} />
       <Route path="/notifications" element={<Notifications />} />
       <Route path="/support" element={<Support />} />
       <Route path="/settings" element={<Settings />} />
        <Route path="/add-guest" element={<AddGuest />} />
        <Route path="/flight/:id" element={<FlightDetails />} />
        <Route path="/my-bookings" element={<MyBookings />} />
        <Route path="/bookings" element={<MyBookings />} />
      </Routes>
    </Router>
  )
}

export default App
