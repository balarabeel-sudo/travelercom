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
      </Routes>
    </Router>
  )
}

export default App
