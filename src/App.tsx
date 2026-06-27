import { HashRouter as Router, Routes, Route } from 'react-router-dom'
import SplashScreen from './splashScreen'
import AccountType from './AccountType'
import Login from './Login'
import Register from './Ragister'
import Home from './Home'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<SplashScreen />} />
        <Route path="/account-type" element={<AccountType />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/home" element={<Home />} />
      </Routes>
    </Router>
  )
}

export default App