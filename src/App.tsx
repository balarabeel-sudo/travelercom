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
      </Routes>
    </Router>
  )
}

export default App
